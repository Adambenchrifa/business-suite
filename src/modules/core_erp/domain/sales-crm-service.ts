import { eq } from 'drizzle-orm';
import {
  salesOrders,
  salesOrderItems,
  stockMovements,
  stockMovementItems,
  inventoryItems,
  warehouses,
  numberSequences
} from '../infrastructure/db-schemas';
import { AuditService } from '../../../shared/services/audit-service';
import { Request } from 'express';
import { NotFoundError } from '../../../shared/utils/errors';

export interface ConfirmSalesOrderDTO {
  orderId: string;
  warehouseId?: string | null;
}

export class SalesCrmService {
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

  static async confirmOrderAndReserveStock(db: any, req: Request, dto: ConfirmSalesOrderDTO) {
    const orders = await db.select().from(salesOrders).where(eq(salesOrders.id, dto.orderId)).limit(1);
    const order = orders[0];
    if (!order) {
      throw new NotFoundError('Sales order not found');
    }

    const previousStatus = order.status;

    // Update status to confirmed
    const updated = await db.update(salesOrders)
      .set({ status: 'confirmed', updatedAt: new Date() })
      .where(eq(salesOrders.id, dto.orderId))
      .returning();

    // Automatic Stock Reservation
    if (previousStatus !== 'confirmed') {
      const orderItems = await db.select().from(salesOrderItems).where(eq(salesOrderItems.salesOrderId, dto.orderId));
      const targetWhId = dto.warehouseId || (await db.select().from(warehouses).limit(1))[0]?.id;

      if (targetWhId && orderItems.length > 0) {
        const refCode = await SalesCrmService.generateNextCode(db, 'StockMovement-OUT', 'RSV-');
        const movement = await db.insert(stockMovements).values({
          type: 'OUT',
          sourceWarehouseId: targetWhId,
          referenceNumber: refCode,
          notes: `Auto Stock Reservation for Order ${order.orderNumber}`,
          performedBy: req.user?.id || null
        }).returning();

        for (const item of orderItems) {
          const pId = item.productId || (item as any).product_id;
          const vId = item.variantId || (item as any).variant_id;
          const qty = item.quantity !== undefined ? item.quantity : 1;

          await db.insert(stockMovementItems).values({
            movementId: movement[0].id,
            productId: pId,
            variantId: vId || null,
            quantity: qty,
            unitCost: '0.00'
          });

          let currentStocks = await db.select().from(inventoryItems);
          let matched = currentStocks.find((ii: any) => {
            const iiPid = ii.productId || ii.product_id;
            const iiWid = ii.warehouseId || ii.warehouse_id;
            const iiVid = ii.variantId || ii.variant_id;
            return iiPid === pId && iiWid === targetWhId && (vId ? iiVid === vId : true);
          });

          if (matched) {
            const matchedQty = matched.quantity !== undefined ? matched.quantity : 0;
            await db.update(inventoryItems)
              .set({ quantity: Math.max(0, matchedQty - qty), updatedAt: new Date() })
              .where(eq(inventoryItems.id, matched.id));
          } else {
            await db.insert(inventoryItems).values({
              productId: pId,
              variantId: vId || null,
              warehouseId: targetWhId,
              quantity: -qty,
            });
          }
        }
      }
    }

    await AuditService.log(db, req, {
      action: 'CONFIRM_SALES_ORDER',
      module: 'Sales',
      details: `Confirmed sales order ${order.orderNumber} with automatic stock reservation`,
      metadata: { orderId: dto.orderId, orderNumber: order.orderNumber }
    });

    return updated[0];
  }
}
