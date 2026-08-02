import { Request, Response, NextFunction } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import {
  users,
  activityLogs,
  notifications,
  numberSequences,
  products,
  productVariants,
  inventoryItems,
  stockMovements,
  stockMovementItems,
  crmCompanies,
  crmContacts,
  crmLeads,
  crmOpportunities,
  crmActivities,
  salesOrders,
  salesOrderItems,
  deliveryOrders,
  deliveryOrderItems,
  invoices,
  invoiceItems,
  warehouses
} from '../infrastructure/db-schemas';

// ----------------------------------------------------
// VALIDATION SCHEMAS
// ----------------------------------------------------
const crmCompanySchema = z.object({
  name: z.string().min(2, 'Company name is required'),
  industry: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
});

const crmContactSchema = z.object({
  companyId: z.string().uuid().optional().nullable(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).default('active'),
});

const crmLeadSchema = z.object({
  title: z.string().min(2, 'Lead title/description is required'),
  source: z.string().optional().nullable(),
  status: z.enum(['new', 'contacted', 'qualified', 'unqualified']).default('new'),
  value: z.string().default('0.00'),
  notes: z.string().optional().nullable(),
  companyId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
});

const crmOpportunitySchema = z.object({
  title: z.string().min(2, 'Opportunity title is required'),
  companyId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  stage: z.enum(['qualification', 'proposal', 'negotiation', 'won', 'lost']).default('qualification'),
  value: z.string().default('0.00'),
  probability: z.number().int().min(0).max(100).default(10),
  expectedCloseDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
});

const crmActivitySchema = z.object({
  entityType: z.enum(['lead', 'opportunity', 'company', 'contact']),
  entityId: z.string().uuid(),
  type: z.enum(['note', 'email', 'call', 'meeting', 'task']),
  title: z.string().min(1, 'Activity title is required'),
  description: z.string().optional().nullable(),
  status: z.enum(['planned', 'completed']).default('completed'),
  dueDate: z.string().optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
});

const salesOrderSchema = z.object({
  type: z.enum(['quotation', 'sales_order']),
  companyId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  orderDate: z.string().min(1, 'Order date is required'),
  expirationDate: z.string().optional().nullable(),
  status: z.enum(['draft', 'sent', 'confirmed', 'delivered', 'invoiced', 'cancelled']).default('draft'),
  currency: z.string().min(1).default('USD'),
  paymentTerms: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid().optional().nullable(),
    quantity: z.number().int().min(1),
    unitPrice: z.string().min(1),
    discountAmount: z.string().default('0.00'),
    taxAmount: z.string().default('0.00'),
  })).min(1, 'Order must contain at least one product item'),
});

const deliveryOrderSchema = z.object({
  salesOrderId: z.string().uuid(),
  warehouseId: z.string().uuid().optional().nullable(),
  status: z.enum(['pending', 'shipped', 'delivered', 'cancelled']).default('pending'),
  shippedDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(z.object({
    salesOrderItemId: z.string().uuid(),
    productId: z.string().uuid(),
    quantityShipped: z.number().int().min(0),
  })).min(1),
});

const invoiceSchema = z.object({
  salesOrderId: z.string().uuid(),
  status: z.enum(['draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled']).default('draft'),
  issueDate: z.string().min(1),
  dueDate: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
});

// ----------------------------------------------------
// LOCAL HELPER UTILS
// ----------------------------------------------------
async function logActivity(db: any, req: Request, action: string, module: string, details: string) {
  try {
    const userId = req.user?.id || null;
    const userName = req.user?.email || 'System';
    const ipAddress = req.ip || String(req.headers['x-forwarded-for']) || null;

    await db.insert(activityLogs).values({
      userId,
      userName,
      action,
      module,
      details,
      ipAddress,
    });
  } catch (err) {
    console.error('Failed to write activity log:', err);
  }
}

async function notifyUser(db: any, userId: string | null, title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
  try {
    await db.insert(notifications).values({
      userId,
      title,
      message,
      type,
      isRead: false,
    });
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}

async function generateNextCode(db: any, module: string, defaultPrefix: string): Promise<string> {
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

  const currentNum = seq.nextNumber !== undefined ? seq.nextNumber : (seq as any).next_number;
  const currentDigits = seq.digits !== undefined ? seq.digits : (seq as any).digits;
  const currentPrefix = seq.prefix !== undefined ? seq.prefix : (seq as any).prefix;

  const formattedNum = String(currentNum).padStart(currentDigits, '0');
  const code = `${currentPrefix}${formattedNum}`;

  await db.update(numberSequences)
    .set({ nextNumber: currentNum + 1 })
    .where(eq(numberSequences.id, seq.id));

  return code;
}

// ----------------------------------------------------
// CONTROLLER CLASS
// ----------------------------------------------------
export class SalesCrmController {

  // ----------------------------------------------------
  // CRM COMPANIES
  // ----------------------------------------------------
  static async getCompanies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const data = await db.select().from(crmCompanies).order(desc(crmCompanies.createdAt));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async createCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const body = crmCompanySchema.parse(req.body);
      const inserted = await db.insert(crmCompanies).values({
        ...body,
        updatedAt: new Date()
      }).returning();
      await logActivity(db, req, 'CREATE_CRM_COMPANY', 'CRM', `Created company ${body.name}`);
      res.status(201).json({ success: true, data: inserted[0] });
    } catch (err) {
      next(err);
    }
  }

  static async updateCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      const body = crmCompanySchema.parse(req.body);
      const updated = await db.update(crmCompanies)
        .set({
          ...body,
          updatedAt: new Date()
        })
        .where(eq(crmCompanies.id, id))
        .returning();

      if (updated.length === 0) {
        res.status(404).json({ success: false, message: 'Company not found' });
        return;
      }
      await logActivity(db, req, 'UPDATE_CRM_COMPANY', 'CRM', `Updated company ${body.name}`);
      res.json({ success: true, data: updated[0] });
    } catch (err) {
      next(err);
    }
  }

  static async deleteCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      const deleted = await db.delete(crmCompanies).where(eq(crmCompanies.id, id)).returning();
      if (deleted.length === 0) {
        res.status(404).json({ success: false, message: 'Company not found' });
        return;
      }
      await logActivity(db, req, 'DELETE_CRM_COMPANY', 'CRM', `Deleted company ID ${id}`);
      res.json({ success: true, message: 'Company deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // CRM CONTACTS
  // ----------------------------------------------------
  static async getContacts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const contacts = await db.select().from(crmContacts).order(desc(crmContacts.createdAt));
      const companies = await db.select().from(crmCompanies);

      const data = contacts.map((c: any) => {
        const compId = c.companyId || c.company_id;
        return {
          ...c,
          company: companies.find((co: any) => co.id === compId) || null
        };
      });

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async createContact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const body = crmContactSchema.parse(req.body);
      const inserted = await db.insert(crmContacts).values({
        ...body,
        updatedAt: new Date()
      }).returning();
      await logActivity(db, req, 'CREATE_CRM_CONTACT', 'CRM', `Created contact ${body.firstName} ${body.lastName}`);
      res.status(201).json({ success: true, data: inserted[0] });
    } catch (err) {
      next(err);
    }
  }

  static async updateContact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      const body = crmContactSchema.parse(req.body);
      const updated = await db.update(crmContacts)
        .set({
          ...body,
          updatedAt: new Date()
        })
        .where(eq(crmContacts.id, id))
        .returning();

      if (updated.length === 0) {
        res.status(404).json({ success: false, message: 'Contact not found' });
        return;
      }
      await logActivity(db, req, 'UPDATE_CRM_CONTACT', 'CRM', `Updated contact ${body.firstName} ${body.lastName}`);
      res.json({ success: true, data: updated[0] });
    } catch (err) {
      next(err);
    }
  }

  static async deleteContact(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      const deleted = await db.delete(crmContacts).where(eq(crmContacts.id, id)).returning();
      if (deleted.length === 0) {
        res.status(404).json({ success: false, message: 'Contact not found' });
        return;
      }
      await logActivity(db, req, 'DELETE_CRM_CONTACT', 'CRM', `Deleted contact ID ${id}`);
      res.json({ success: true, message: 'Contact deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // CRM LEADS
  // ----------------------------------------------------
  static async getLeads(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const leads = await db.select().from(crmLeads).order(desc(crmLeads.createdAt));
      const companies = await db.select().from(crmCompanies);
      const contacts = await db.select().from(crmContacts);
      const userList = await db.select().from(users);

      const data = leads.map((l: any) => {
        const compId = l.companyId || l.company_id;
        const contId = l.contactId || l.contact_id;
        const assignedId = l.assignedTo || l.assigned_to;

        return {
          ...l,
          company: companies.find((co: any) => co.id === compId) || null,
          contact: contacts.find((ct: any) => ct.id === contId) || null,
          assignedUser: userList.find((u: any) => u.id === assignedId) || null
        };
      });

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async createLead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const body = crmLeadSchema.parse(req.body);
      const inserted = await db.insert(crmLeads).values({
        ...body,
        updatedAt: new Date()
      }).returning();
      await logActivity(db, req, 'CREATE_CRM_LEAD', 'CRM', `Created Lead: ${body.title}`);
      res.status(201).json({ success: true, data: inserted[0] });
    } catch (err) {
      next(err);
    }
  }

  static async updateLead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      const body = crmLeadSchema.parse(req.body);
      const updated = await db.update(crmLeads)
        .set({
          ...body,
          updatedAt: new Date()
        })
        .where(eq(crmLeads.id, id))
        .returning();

      if (updated.length === 0) {
        res.status(404).json({ success: false, message: 'Lead not found' });
        return;
      }
      await logActivity(db, req, 'UPDATE_CRM_LEAD', 'CRM', `Updated Lead: ${body.title}`);
      res.json({ success: true, data: updated[0] });
    } catch (err) {
      next(err);
    }
  }

  static async deleteLead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      const deleted = await db.delete(crmLeads).where(eq(crmLeads.id, id)).returning();
      if (deleted.length === 0) {
        res.status(404).json({ success: false, message: 'Lead not found' });
        return;
      }
      await logActivity(db, req, 'DELETE_CRM_LEAD', 'CRM', `Deleted Lead ID ${id}`);
      res.json({ success: true, message: 'Lead deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // CRM OPPORTUNITIES
  // ----------------------------------------------------
  static async getOpportunities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const opps = await db.select().from(crmOpportunities).order(desc(crmOpportunities.createdAt));
      const companies = await db.select().from(crmCompanies);
      const contacts = await db.select().from(crmContacts);
      const userList = await db.select().from(users);

      const data = opps.map((o: any) => {
        const compId = o.companyId || o.company_id;
        const contId = o.contactId || o.contact_id;
        const assignedId = o.assignedTo || o.assigned_to;

        return {
          ...o,
          company: companies.find((co: any) => co.id === compId) || null,
          contact: contacts.find((ct: any) => ct.id === contId) || null,
          assignedUser: userList.find((u: any) => u.id === assignedId) || null
        };
      });

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async createOpportunity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const body = crmOpportunitySchema.parse(req.body);
      const inserted = await db.insert(crmOpportunities).values({
        ...body,
        updatedAt: new Date()
      }).returning();
      await logActivity(db, req, 'CREATE_CRM_OPPORTUNITY', 'CRM', `Created Opportunity: ${body.title}`);
      res.status(201).json({ success: true, data: inserted[0] });
    } catch (err) {
      next(err);
    }
  }

  static async updateOpportunity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      const body = crmOpportunitySchema.parse(req.body);
      const updated = await db.update(crmOpportunities)
        .set({
          ...body,
          updatedAt: new Date()
        })
        .where(eq(crmOpportunities.id, id))
        .returning();

      if (updated.length === 0) {
        res.status(404).json({ success: false, message: 'Opportunity not found' });
        return;
      }
      await logActivity(db, req, 'UPDATE_CRM_OPPORTUNITY', 'CRM', `Updated Opportunity: ${body.title}`);
      res.json({ success: true, data: updated[0] });
    } catch (err) {
      next(err);
    }
  }

  static async deleteOpportunity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      const deleted = await db.delete(crmOpportunities).where(eq(crmOpportunities.id, id)).returning();
      if (deleted.length === 0) {
        res.status(404).json({ success: false, message: 'Opportunity not found' });
        return;
      }
      await logActivity(db, req, 'DELETE_CRM_OPPORTUNITY', 'CRM', `Deleted Opportunity ID ${id}`);
      res.json({ success: true, message: 'Opportunity deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // CRM ACTIVITIES & TIMELINE
  // ----------------------------------------------------
  static async getActivities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { entityType, entityId } = req.query;

      let query = db.select().from(crmActivities);
      if (entityType && entityId) {
        query = db.select().from(crmActivities).where(
          and(
            eq(crmActivities.entityType, String(entityType)),
            eq(crmActivities.entityId, String(entityId))
          )
        );
      }
      const activities = await query.order(desc(crmActivities.createdAt));
      const userList = await db.select().from(users);

      const data = activities.map((act: any) => {
        const assignedId = act.assignedTo || act.assigned_to;
        return {
          ...act,
          assignedUser: userList.find((u: any) => u.id === assignedId) || null
        };
      });

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async createActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const body = crmActivitySchema.parse(req.body);
      const inserted = await db.insert(crmActivities).values({
        ...body,
      }).returning();
      await logActivity(db, req, 'CREATE_CRM_ACTIVITY', 'CRM', `Logged CRM Activity/Task: ${body.title}`);
      res.status(201).json({ success: true, data: inserted[0] });
    } catch (err) {
      next(err);
    }
  }

  static async deleteActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      const deleted = await db.delete(crmActivities).where(eq(crmActivities.id, id)).returning();
      if (deleted.length === 0) {
        res.status(404).json({ success: false, message: 'Activity not found' });
        return;
      }
      res.json({ success: true, message: 'Activity deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // SALES ORDERS & QUOTATIONS
  // ----------------------------------------------------
  static async getSalesOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const orders = await db.select().from(salesOrders).order(desc(salesOrders.createdAt));
      const companies = await db.select().from(crmCompanies);
      const contacts = await db.select().from(crmContacts);
      const orderItems = await db.select().from(salesOrderItems);
      const productList = await db.select().from(products);

      const data = orders.map((so: any) => {
        const compId = so.companyId || so.company_id;
        const contId = so.contactId || so.contact_id;

        const items = orderItems
          .filter((item: any) => (item.salesOrderId || item.sales_order_id) === so.id)
          .map((item: any) => {
            const pId = item.productId || item.product_id;
            return {
              ...item,
              product: productList.find((p: any) => p.id === pId) || null
            };
          });

        return {
          ...so,
          company: companies.find((co: any) => co.id === compId) || null,
          contact: contacts.find((ct: any) => ct.id === contId) || null,
          items
        };
      });

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async createSalesOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const body = salesOrderSchema.parse(req.body);

      // Sequence numbers based on type
      const prefix = body.type === 'quotation' ? 'QT-' : 'SO-';
      const orderNo = await generateNextCode(db, `Sales-${body.type}`, prefix);

      // Calculate totals
      let subtotal = 0;
      let taxTotal = 0;
      let discountTotal = 0;

      body.items.forEach(item => {
        const qty = item.quantity;
        const price = parseFloat(item.unitPrice);
        const disc = parseFloat(item.discountAmount);
        const tax = parseFloat(item.taxAmount);

        subtotal += qty * price;
        discountTotal += disc;
        taxTotal += tax;
      });

      const totalAmountVal = (subtotal - discountTotal + taxTotal).toFixed(2);

      const inserted = await db.insert(salesOrders).values({
        orderNumber: orderNo,
        type: body.type,
        companyId: body.companyId || null,
        contactId: body.contactId || null,
        orderDate: body.orderDate,
        expirationDate: body.expirationDate || null,
        status: body.status,
        totalAmount: totalAmountVal,
        taxAmount: taxTotal.toFixed(2),
        discountAmount: discountTotal.toFixed(2),
        currency: body.currency,
        paymentTerms: body.paymentTerms || null,
        notes: body.notes || null,
        updatedAt: new Date()
      }).returning();

      const order = inserted[0];

      // Add order items
      for (const item of body.items) {
        const itemSub = item.quantity * parseFloat(item.unitPrice);
        const itemTot = itemSub - parseFloat(item.discountAmount) + parseFloat(item.taxAmount);

        await db.insert(salesOrderItems).values({
          salesOrderId: order.id,
          productId: item.productId,
          variantId: item.variantId || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount,
          taxAmount: item.taxAmount,
          totalAmount: itemTot.toFixed(2)
        });
      }

      await logActivity(db, req, 'CREATE_SALES_ORDER', 'Sales', `Created ${body.type} ${orderNo}`);
      res.status(201).json({ success: true, data: order });
    } catch (err) {
      next(err);
    }
  }

  static async updateOrderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      const { status, warehouseId } = z.object({
        status: z.enum(['draft', 'sent', 'confirmed', 'delivered', 'invoiced', 'cancelled']),
        warehouseId: z.string().uuid().optional().nullable()
      }).parse(req.body);

      // Get current order state
      const orders = await db.select().from(salesOrders).where(eq(salesOrders.id, id)).limit(1);
      const order = orders[0];
      if (!order) {
        res.status(404).json({ success: false, message: 'Sales order not found' });
        return;
      }

      const previousStatus = order.status || (order as any).status;

      // Update status
      const updated = await db.update(salesOrders)
        .set({ status, updatedAt: new Date() })
        .where(eq(salesOrders.id, id))
        .returning();

      // AUTOMATIC STOCK RESERVATION
      // If transitioned to 'confirmed' and it was a quotation or draft before -> subtract stock!
      if (status === 'confirmed' && previousStatus !== 'confirmed') {
        const orderItems = await db.select().from(salesOrderItems).where(eq(salesOrderItems.salesOrderId, id));
        
        // Pick warehouse
        const targetWhId = warehouseId || (await db.select().from(warehouses).limit(1))[0]?.id;

        if (targetWhId && orderItems.length > 0) {
          // Log stock movement Out
          const refCode = await generateNextCode(db, 'StockMovement-OUT', 'RSV-');
          const movement = await db.insert(stockMovements).values({
            type: 'OUT',
            sourceWarehouseId: targetWhId,
            referenceNumber: refCode,
            notes: `Auto Stock Reservation for Order ${order.orderNumber || (order as any).order_number}`,
            performedBy: req.user?.id || null
          }).returning();

          for (const item of orderItems) {
            const pId = item.productId || (item as any).product_id;
            const vId = item.variantId || (item as any).variant_id;
            const qty = item.quantity !== undefined ? item.quantity : (item as any).quantity;

            await db.insert(stockMovementItems).values({
              movementId: movement[0].id,
              productId: pId,
              variantId: vId || null,
              quantity: qty,
              unitCost: '0.00'
            });

            // Subtract from inventory items
            let currentStocks = await db.select().from(inventoryItems);
            let matched = currentStocks.find((ii: any) => {
              const iiPid = ii.productId || ii.product_id;
              const iiWid = ii.warehouseId || ii.warehouse_id;
              const iiVid = ii.variantId || ii.variant_id;
              return iiPid === pId && iiWid === targetWhId && (vId ? iiVid === vId : true);
            });

            if (matched) {
              const matchedQty = matched.quantity !== undefined ? matched.quantity : (matched as any).quantity;
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

          await logActivity(db, req, 'STOCK_RESERVATION', 'Inventory', `Auto-reserved stock items for confirmed order`);
          await notifyUser(db, req.user?.id || null, 'Stock Items Reserved', `Physical stock quantities were successfully reserved from default Warehouse for Sales Order ${order.orderNumber || (order as any).order_number}.`, 'success');
        }
      }

      await logActivity(db, req, 'UPDATE_SALES_ORDER_STATUS', 'Sales', `Updated status of order ${order.orderNumber || (order as any).order_number} to ${status}`);
      res.json({ success: true, data: updated[0] });
    } catch (err) {
      next(err);
    }
  }

  static async deleteSalesOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      const deleted = await db.delete(salesOrders).where(eq(salesOrders.id, id)).returning();
      if (deleted.length === 0) {
        res.status(404).json({ success: false, message: 'Sales order not found' });
        return;
      }
      res.json({ success: true, message: 'Sales order/quotation removed successfully' });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // DELIVERY ORDERS (SHIPMENTS)
  // ----------------------------------------------------
  static async getDeliveryOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const deliveries = await db.select().from(deliveryOrders).order(desc(deliveryOrders.createdAt));
      const orders = await db.select().from(salesOrders);
      const companies = await db.select().from(crmCompanies);
      const deliveryItems = await db.select().from(deliveryOrderItems);
      const productList = await db.select().from(products);

      const data = deliveries.map((d: any) => {
        const soId = d.salesOrderId || d.sales_order_id;
        const linkedOrder = orders.find((o: any) => o.id === soId) || null;
        const compId = linkedOrder ? (linkedOrder.companyId || (linkedOrder as any).company_id) : null;

        const items = deliveryItems
          .filter((item: any) => (item.deliveryOrderId || item.delivery_order_id) === d.id)
          .map((item: any) => {
            const pId = item.productId || item.product_id;
            return {
              ...item,
              product: productList.find((p: any) => p.id === pId) || null
            };
          });

        return {
          ...d,
          salesOrder: linkedOrder,
          company: companies.find((co: any) => co.id === compId) || null,
          items
        };
      });

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async createDeliveryOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const body = deliveryOrderSchema.parse(req.body);
      const code = await generateNextCode(db, 'DeliveryOrder', 'DO-');

      const inserted = await db.insert(deliveryOrders).values({
        deliveryNumber: code,
        salesOrderId: body.salesOrderId,
        warehouseId: body.warehouseId || null,
        status: body.status,
        shippedDate: body.shippedDate || null,
        notes: body.notes || null,
        updatedAt: new Date()
      }).returning();

      const delivery = inserted[0];

      for (const item of body.items) {
        await db.insert(deliveryOrderItems).values({
          deliveryOrderId: delivery.id,
          salesOrderItemId: item.salesOrderItemId,
          productId: item.productId,
          quantityShipped: item.quantityShipped
        });
      }

      await logActivity(db, req, 'CREATE_DELIVERY_ORDER', 'Sales', `Generated delivery shipment ${code}`);
      res.status(201).json({ success: true, data: delivery });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // INVOICES PREPARATION & TRACKING
  // ----------------------------------------------------
  static async getInvoices(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const invoiceList = await db.select().from(invoices).order(desc(invoices.createdAt));
      const orders = await db.select().from(salesOrders);
      const companies = await db.select().from(crmCompanies);
      const items = await db.select().from(invoiceItems);
      const productList = await db.select().from(products);

      const data = invoiceList.map((inv: any) => {
        const soId = inv.salesOrderId || inv.sales_order_id;
        const linkedOrder = orders.find((o: any) => o.id === soId) || null;
        const compId = linkedOrder ? (linkedOrder.companyId || (linkedOrder as any).company_id) : null;

        const invItems = items
          .filter((item: any) => (item.invoiceId || item.invoice_id) === inv.id)
          .map((item: any) => {
            const pId = item.productId || item.product_id;
            return {
              ...item,
              product: productList.find((p: any) => p.id === pId) || null
            };
          });

        return {
          ...inv,
          salesOrder: linkedOrder,
          company: companies.find((co: any) => co.id === compId) || null,
          items: invItems
        };
      });

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async createInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const body = invoiceSchema.parse(req.body);
      
      // Get linked order info
      const orders = await db.select().from(salesOrders).where(eq(salesOrders.id, body.salesOrderId)).limit(1);
      const order = orders[0];
      if (!order) {
        res.status(404).json({ success: false, message: 'Referenced Sales order not found' });
        return;
      }

      const code = await generateNextCode(db, 'Invoice', 'INV-');
      const orderItems = await db.select().from(salesOrderItems).where(eq(salesOrderItems.salesOrderId, order.id));

      const inserted = await db.insert(invoices).values({
        invoiceNumber: code,
        salesOrderId: body.salesOrderId,
        status: body.status,
        issueDate: body.issueDate,
        dueDate: body.dueDate || null,
        totalAmount: order.totalAmount,
        taxAmount: order.taxAmount,
        discountAmount: order.discountAmount,
        currency: order.currency,
        paymentTerms: body.paymentTerms || order.paymentTerms || null,
        updatedAt: new Date()
      }).returning();

      const invoice = inserted[0];

      // Add invoice items linked to sales order items
      for (const item of orderItems) {
        await db.insert(invoiceItems).values({
          invoiceId: invoice.id,
          salesOrderItemId: item.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount,
          taxAmount: item.taxAmount,
          totalAmount: item.totalAmount
        });
      }

      await logActivity(db, req, 'CREATE_INVOICE', 'Sales', `Created financial invoice billing ${code}`);
      res.status(201).json({ success: true, data: invoice });
    } catch (err) {
      next(err);
    }
  }

  static async updateInvoiceStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      const { status } = z.object({
        status: z.enum(['draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled'])
      }).parse(req.body);

      const updated = await db.update(invoices)
        .set({ status, updatedAt: new Date() })
        .where(eq(invoices.id, id))
        .returning();

      if (updated.length === 0) {
        res.status(404).json({ success: false, message: 'Invoice not found' });
        return;
      }

      await logActivity(db, req, 'UPDATE_INVOICE_STATUS', 'Sales', `Updated invoice ${updated[0].invoiceNumber} to ${status}`);
      res.json({ success: true, data: updated[0] });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // INTEGRATED ANALYTICS / DASHBOARD
  // ----------------------------------------------------
  static async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;

      // 1. Core counters
      const leads = await db.select().from(crmLeads);
      const opportunities = await db.select().from(crmOpportunities);
      const orders = await db.select().from(salesOrders);
      const companies = await db.select().from(crmCompanies);
      const contacts = await db.select().from(crmContacts);
      const invoiceList = await db.select().from(invoices);

      // 2. Revenue charts (Aggregated confirmed sales)
      let totalRevenueValue = 0;
      let targetPipelineValue = 0;
      let wonOppsValue = 0;

      orders.forEach((so: any) => {
        if (so.status === 'confirmed' || so.status === 'delivered' || so.status === 'invoiced') {
          totalRevenueValue += parseFloat(so.totalAmount || '0');
        }
      });

      opportunities.forEach((o: any) => {
        const val = parseFloat(o.value || '0');
        targetPipelineValue += val;
        if (o.stage === 'won') {
          wonOppsValue += val;
        }
      });

      // 3. Funnel conversion rates
      const pipelineFunnel = {
        qualification: opportunities.filter((o: any) => o.stage === 'qualification').length,
        proposal: opportunities.filter((o: any) => o.stage === 'proposal').length,
        negotiation: opportunities.filter((o: any) => o.stage === 'negotiation').length,
        won: opportunities.filter((o: any) => o.stage === 'won').length,
        lost: opportunities.filter((o: any) => o.stage === 'lost').length,
      };

      // 4. Best Selling Products (Aggregated orders)
      const orderItems = await db.select().from(salesOrderItems);
      const productList = await db.select().from(products);
      const productSalesMap: Record<string, { name: string; sku: string; qty: number; total: number }> = {};

      orderItems.forEach((item: any) => {
        const pId = item.productId || item.product_id;
        const matchingProd = productList.find((p: any) => p.id === pId);
        if (matchingProd) {
          if (!productSalesMap[pId]) {
            productSalesMap[pId] = {
              name: matchingProd.name,
              sku: matchingProd.sku,
              qty: 0,
              total: 0
            };
          }
          productSalesMap[pId].qty += item.quantity || 0;
          productSalesMap[pId].total += parseFloat(item.totalAmount || '0');
        }
      });

      const bestSellers = Object.values(productSalesMap)
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

      // 5. Top Customers (by revenue contribution)
      const customerRevenueMap: Record<string, { name: string; count: number; revenue: number }> = {};
      orders.forEach((so: any) => {
        const compId = so.companyId || so.company_id;
        const matchingComp = companies.find((c: any) => c.id === compId);
        if (matchingComp) {
          if (!customerRevenueMap[compId]) {
            customerRevenueMap[compId] = {
              name: matchingComp.name,
              count: 0,
              revenue: 0
            };
          }
          customerRevenueMap[compId].count += 1;
          if (so.status === 'confirmed' || so.status === 'delivered' || so.status === 'invoiced') {
            customerRevenueMap[compId].revenue += parseFloat(so.totalAmount || '0');
          }
        }
      });

      const topCustomers = Object.values(customerRevenueMap)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      res.json({
        success: true,
        data: {
          stats: {
            totalLeadsCount: leads.length,
            totalOppsCount: opportunities.length,
            totalAccountsCount: companies.length,
            totalContactsCount: contacts.length,
            totalOrdersCount: orders.length,
            grossRevenueCollected: totalRevenueValue.toFixed(2),
            salesPipelineTiedValue: targetPipelineValue.toFixed(2),
            invoicesPrepared: invoiceList.length,
            completedDealsValue: wonOppsValue.toFixed(2)
          },
          funnel: pipelineFunnel,
          topCustomers,
          bestSellers
        }
      });
    } catch (err) {
      next(err);
    }
  }

}
