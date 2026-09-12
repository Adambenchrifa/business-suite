import { eq } from 'drizzle-orm';
import {
  products,
  inventoryItems,
  stockMovements,
  stockMovementItems,
  notifications,
  numberSequences
} from '../infrastructure/db-schemas';
import { AuditService } from '../../../shared/services/audit-service';
import { Request } from 'express';
import { ValidationError, NotFoundError } from '../../../shared/utils/errors';

export interface CreateMovementDTO {
  type: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT';
  sourceWarehouseId?: string | null;
  sourceLocationId?: string | null;
  destWarehouseId?: string | null;
  destLocationId?: string | null;
  notes?: string | null;
  referenceNumber?: string | null;
  items: Array<{
    productId: string;
    variantId?: string | null;
    quantity: number;
    unitCost?: string;
    batchNumber?: string | null;
    serialNumber?: string | null;
    expirationDate?: string | null;
  }>;
}

export class InventoryService {
  private static async generateNextCode(db: any, module: string, defaultPrefix: string): Promise<string> {
    let seqs = await db.select().from(numberSequences).where(eq(numberSequences.module, module)).limit(1);
    let seq = seqs[0];

    if (!seq) {
      const inserted = await db.insert(numberSequences).values({
        module,
        prefix: defaultPrefix,
        nextNumber: 1,
        digits: 4,
      }).returning();
      seq = inserted[0];
    }

    const currentNum = seq.nextNumber !== undefined ? seq.nextNumber : seq.next_number;
    const currentDigits = seq.digits !== undefined ? seq.digits : seq.digits;
    const currentPrefix = seq.prefix !== undefined ? seq.prefix : seq.prefix;

    const formattedNum = String(currentNum).padStart(currentDigits, '0');
    const code = `${currentPrefix}${formattedNum}`;

    await db.update(numberSequences)
      .set({ nextNumber: currentNum + 1 })
      .where(eq(numberSequences.id, seq.id));

    return code;
  }

  static async processStockMovement(db: any, req: Request, dto: CreateMovementDTO) {
    if (dto.type === 'IN' && !dto.destWarehouseId) {
      throw new ValidationError('Destination warehouse is required for IN stock movements');
    }
    if (dto.type === 'OUT' && !dto.sourceWarehouseId) {
      throw new ValidationError('Source warehouse is required for OUT stock movements');
    }
    if (dto.type === 'TRANSFER' && (!dto.sourceWarehouseId || !dto.destWarehouseId)) {
      throw new ValidationError('Both source and destination warehouses are required for TRANSFER movements');
    }

    const prefix = dto.type === 'IN' ? 'REC-' : dto.type === 'OUT' ? 'SHP-' : dto.type === 'TRANSFER' ? 'TRF-' : 'ADJ-';
    const refNumber = dto.referenceNumber || await InventoryService.generateNextCode(db, `StockMovement-${dto.type}`, prefix);

    // Create main stock movement
    const movementInserted = await db.insert(stockMovements).values({
      type: dto.type,
      sourceWarehouseId: dto.sourceWarehouseId || null,
      sourceLocationId: dto.sourceLocationId || null,
      destWarehouseId: dto.destWarehouseId || null,
      destLocationId: dto.destLocationId || null,
      referenceNumber: refNumber,
      notes: dto.notes || null,
      performedBy: req.user?.id || null
    }).returning();

    const movement = movementInserted[0];

    // Helper to adjust stock
    const adjustStock = async (warehouseId: string, locationId: string | null, item: CreateMovementDTO['items'][0], increment: boolean) => {
      let items = await db.select().from(inventoryItems);

      let matched = items.find((ii: any) => {
        const pId = ii.productId || ii.product_id;
        const wId = ii.warehouseId || ii.warehouse_id;
        const lId = ii.locationId || ii.location_id;
        const vId = ii.variantId || ii.variant_id;
        const bNum = ii.batchNumber || ii.batch_number;
        const sNum = ii.serialNumber || ii.serial_number;

        return pId === item.productId &&
               wId === warehouseId &&
               (locationId ? lId === locationId : true) &&
               (item.variantId ? vId === item.variantId : true) &&
               (item.batchNumber ? bNum === item.batchNumber : true) &&
               (item.serialNumber ? sNum === item.serialNumber : true);
      });

      if (matched) {
        const curQty = matched.quantity !== undefined ? matched.quantity : 0;
        const newQty = increment ? (curQty + item.quantity) : (curQty - item.quantity);
        await db.update(inventoryItems)
          .set({ quantity: newQty, updatedAt: new Date() })
          .where(eq(inventoryItems.id, matched.id));
      } else {
        await db.insert(inventoryItems).values({
          productId: item.productId,
          variantId: item.variantId || null,
          warehouseId,
          locationId: locationId || null,
          quantity: increment ? item.quantity : -item.quantity,
          batchNumber: item.batchNumber || null,
          serialNumber: item.serialNumber || null,
          expirationDate: item.expirationDate ? new Date(item.expirationDate) : null
        });
      }
    };

    // Process movement detail items
    for (const item of dto.items) {
      await db.insert(stockMovementItems).values({
        movementId: movement.id,
        productId: item.productId,
        variantId: item.variantId || null,
        quantity: item.quantity,
        unitCost: item.unitCost || '0.00',
        batchNumber: item.batchNumber || null,
        serialNumber: item.serialNumber || null
      });

      if (dto.type === 'IN') {
        await adjustStock(dto.destWarehouseId!, dto.destLocationId || null, item, true);
      } else if (dto.type === 'OUT') {
        await adjustStock(dto.sourceWarehouseId!, dto.sourceLocationId || null, item, false);
      } else if (dto.type === 'TRANSFER') {
        await adjustStock(dto.sourceWarehouseId!, dto.sourceLocationId || null, item, false);
        await adjustStock(dto.destWarehouseId!, dto.destLocationId || null, item, true);
      } else if (dto.type === 'ADJUSTMENT') {
        if (dto.destWarehouseId) {
          await adjustStock(dto.destWarehouseId, dto.destLocationId || null, item, true);
        } else if (dto.sourceWarehouseId) {
          await adjustStock(dto.sourceWarehouseId, dto.sourceLocationId || null, item, false);
        }
      }
    }

    // Check low stock triggers
    const allStocks = await db.select().from(inventoryItems);
    const allProds = await db.select().from(products);

    for (const prod of allProds) {
      const prodId = prod.id;
      const totalQty = allStocks
        .filter((s: any) => (s.productId === prodId || s.product_id === prodId))
        .reduce((sum: number, current: any) => sum + (current.quantity || 0), 0);

      if (totalQty <= prod.lowStockThreshold && prod.alertEnabled) {
        await db.insert(notifications).values({
          userId: req.user?.id || null,
          title: 'Low Stock Alert!',
          message: `Product ${prod.name} has dropped to ${totalQty} units on hand (Threshold: ${prod.lowStockThreshold})`,
          type: 'warning',
          isRead: false
        });
      }
    }

    await AuditService.log(db, req, {
      action: 'CREATE_STOCK_MOVEMENT',
      module: 'Inventory',
      details: `Processed stock movement ${dto.type} - Ref ${refNumber}`,
      metadata: { type: dto.type, referenceNumber: refNumber, itemCount: dto.items.length }
    });

    return movement;
  }
}
