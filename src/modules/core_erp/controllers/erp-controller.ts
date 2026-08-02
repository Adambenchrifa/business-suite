import { Request, Response, NextFunction } from 'express';
import { eq, and, or, desc, like } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';
import {
  organizations,
  branches,
  warehouses,
  departments,
  positions,
  employees,
  userInvitations,
  currencies,
  taxConfigurations,
  numberSequences,
  files,
  activityLogs,
  notifications,
  users,
  productCategories,
  brands,
  unitsOfMeasure,
  products,
  productVariants,
  stockLocations,
  inventoryItems,
  stockMovements,
  stockMovementItems
} from '../infrastructure/db-schemas';

// ----------------------------------------------------
// VALIDATION SCHEMAS
// ----------------------------------------------------
const organizationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  taxId: z.string().optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable(),
  phone: z.string().optional().nullable(),
  website: z.string().url('Invalid website URL').optional().nullable(),
  address: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  baseCurrency: z.string().min(1).default('USD'),
  timezone: z.string().min(1).default('UTC'),
  dateFormat: z.string().min(1).default('YYYY-MM-DD'),
  language: z.string().min(1).default('en'),
});

const branchSchema = z.object({
  name: z.string().min(2, 'Branch name must be at least 2 characters'),
  code: z.string().min(2, 'Code must be at least 2 characters'),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable(),
  status: z.enum(['active', 'inactive']).default('active'),
});

const warehouseSchema = z.object({
  branchId: z.string().uuid('Invalid branch reference'),
  name: z.string().min(2, 'Warehouse name must be at least 2 characters'),
  code: z.string().min(2, 'Code must be at least 2 characters'),
  address: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).default('active'),
});

const departmentSchema = z.object({
  name: z.string().min(2, 'Department name must be at least 2 characters'),
  code: z.string().min(2, 'Code must be at least 2 characters'),
  managerName: z.string().optional().nullable(),
});

const positionSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  departmentId: z.string().uuid('Invalid department reference'),
  grade: z.string().optional().nullable(),
  salaryRange: z.string().optional().nullable(),
});

const employeeSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional().nullable(),
  departmentId: z.string().uuid('Invalid department reference').optional().nullable(),
  positionId: z.string().uuid('Invalid position reference').optional().nullable(),
  hireDate: z.string().optional().nullable(),
  status: z.enum(['active', 'terminated', 'suspended']).default('active'),
  salary: z.string().optional().nullable(),
});

const invitationSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['admin', 'member']).default('member'),
});

const currencySchema = z.object({
  code: z.string().min(2).max(10),
  name: z.string().min(2),
  symbol: z.string().min(1),
  exchangeRate: z.string().default('1.0'),
  isBase: z.boolean().default(false),
  status: z.enum(['active', 'inactive']).default('active'),
});

const taxSchema = z.object({
  name: z.string().min(2),
  rate: z.string().min(1),
  code: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).default('active'),
});

const numberSequenceSchema = z.object({
  module: z.string().min(2),
  prefix: z.string().min(1),
  nextNumber: z.number().int().min(1),
  digits: z.number().int().min(1).max(10).default(4),
});

// ----------------------------------------------------
// LOGGING & NOTIFICATION HELPERS
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

// ----------------------------------------------------
// AUTOMATED NUMBERING SYSTEM GENERATOR
// ----------------------------------------------------
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
  
  const currentNum = seq.nextNumber !== undefined ? seq.nextNumber : seq.next_number;
  const currentDigits = seq.digits !== undefined ? seq.digits : seq.digits;
  const currentPrefix = seq.prefix !== undefined ? seq.prefix : seq.prefix;
  
  const formattedNum = String(currentNum).padStart(currentDigits, '0');
  const code = `${currentPrefix}${formattedNum}`;
  
  // Update next number
  await db.update(numberSequences)
    .set({ nextNumber: currentNum + 1 })
    .where(eq(numberSequences.id, seq.id));
    
  return code;
}

// ----------------------------------------------------
// ERP CONTROLLER CLASS IMPLEMENTATION
// ----------------------------------------------------
export class ErpController {
  
  // ----------------------------------------------------
  // 1. ORGANIZATION & COMPANY PROFILE
  // ----------------------------------------------------
  static async getOrganization(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      let orgs = await db.select().from(organizations).limit(1);
      let org = orgs[0];
      
      if (!org) {
        // Seed default organization if empty
        const seeded = await db.insert(organizations).values({
          name: 'My Enterprise Workspace',
          baseCurrency: 'USD',
          timezone: 'UTC',
          dateFormat: 'YYYY-MM-DD',
          language: 'en',
        }).returning();
        org = seeded[0];
      }
      
      res.status(200).json({ success: true, data: org });
    } catch (err) {
      next(err);
    }
  }

  static async updateOrganization(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const parsedBody = organizationSchema.parse(req.body);
      
      let orgs = await db.select().from(organizations).limit(1);
      let org = orgs[0];
      
      if (!org) {
        orgs = await db.insert(organizations).values(parsedBody).returning();
      } else {
        orgs = await db.update(organizations)
          .set(parsedBody)
          .where(eq(organizations.id, org.id))
          .returning();
      }
      
      await logActivity(db, req, 'UPDATE_ORGANIZATION', 'Organization', `Updated organization profile metadata`);
      res.status(200).json({ success: true, data: orgs[0] });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // 2. BRANCHES
  // ----------------------------------------------------
  static async getBranches(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const search = req.query.search ? String(req.query.search) : '';
      const status = req.query.status ? String(req.query.status) : '';
      
      let allBranches = await db.select().from(branches).order(desc(branches.createdAt));
      
      if (search) {
        allBranches = allBranches.filter((b: any) => 
          b.name.toLowerCase().includes(search.toLowerCase()) || 
          b.code.toLowerCase().includes(search.toLowerCase())
        );
      }
      
      if (status) {
        allBranches = allBranches.filter((b: any) => b.status === status);
      }

      // Pagination
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '10', 10);
      const offset = (page - 1) * limit;
      const paginated = allBranches.slice(offset, offset + limit);
      
      res.status(200).json({
        success: true,
        data: paginated,
        meta: {
          total: allBranches.length,
          page,
          limit,
          totalPages: Math.ceil(allBranches.length / limit)
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async createBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const parsedBody = branchSchema.parse(req.body);
      
      const newBranches = await db.insert(branches).values(parsedBody).returning();
      const newBranch = newBranches[0];
      
      await logActivity(db, req, 'CREATE_BRANCH', 'Branch', `Created branch [${newBranch.name}] with code [${newBranch.code}]`);
      res.status(201).json({ success: true, data: newBranch });
    } catch (err) {
      next(err);
    }
  }

  static async updateBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      const parsedBody = branchSchema.parse(req.body);
      
      const updated = await db.update(branches)
        .set(parsedBody)
        .where(eq(branches.id, id))
        .returning();
        
      if (updated.length === 0) {
        res.status(404).json({ success: false, message: 'Branch not found' });
        return;
      }
      
      await logActivity(db, req, 'UPDATE_BRANCH', 'Branch', `Updated branch [${updated[0].name}]`);
      res.status(200).json({ success: true, data: updated[0] });
    } catch (err) {
      next(err);
    }
  }

  static async deleteBranch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      
      const deleted = await db.delete(branches).where(eq(branches.id, id)).returning();
      if (deleted.length === 0) {
        res.status(404).json({ success: false, message: 'Branch not found' });
        return;
      }
      
      await logActivity(db, req, 'DELETE_BRANCH', 'Branch', `Deleted branch [${deleted[0].name}]`);
      res.status(200).json({ success: true, message: 'Branch deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // 3. WAREHOUSES
  // ----------------------------------------------------
  static async getWarehouses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const search = req.query.search ? String(req.query.search) : '';
      const branchId = req.query.branchId ? String(req.query.branchId) : '';
      
      let list = await db.select().from(warehouses).order(desc(warehouses.createdAt));
      
      if (search) {
        list = list.filter((w: any) => 
          w.name.toLowerCase().includes(search.toLowerCase()) || 
          w.code.toLowerCase().includes(search.toLowerCase())
        );
      }
      
      if (branchId) {
        list = list.filter((w: any) => w.branchId === branchId);
      }

      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '10', 10);
      const offset = (page - 1) * limit;
      const paginated = list.slice(offset, offset + limit);
      
      res.status(200).json({
        success: true,
        data: paginated,
        meta: {
          total: list.length,
          page,
          limit,
          totalPages: Math.ceil(list.length / limit)
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async createWarehouse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const parsedBody = warehouseSchema.parse(req.body);
      
      const newWhs = await db.insert(warehouses).values(parsedBody).returning();
      const newWh = newWhs[0];
      
      await logActivity(db, req, 'CREATE_WAREHOUSE', 'Warehouse', `Created warehouse [${newWh.name}] with code [${newWh.code}]`);
      res.status(201).json({ success: true, data: newWh });
    } catch (err) {
      next(err);
    }
  }

  static async updateWarehouse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      const parsedBody = warehouseSchema.parse(req.body);
      
      const updated = await db.update(warehouses)
        .set(parsedBody)
        .where(eq(warehouses.id, id))
        .returning();
        
      if (updated.length === 0) {
        res.status(404).json({ success: false, message: 'Warehouse not found' });
        return;
      }
      
      await logActivity(db, req, 'UPDATE_WAREHOUSE', 'Warehouse', `Updated warehouse [${updated[0].name}]`);
      res.status(200).json({ success: true, data: updated[0] });
    } catch (err) {
      next(err);
    }
  }

  static async deleteWarehouse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      
      const deleted = await db.delete(warehouses).where(eq(warehouses.id, id)).returning();
      if (deleted.length === 0) {
        res.status(404).json({ success: false, message: 'Warehouse not found' });
        return;
      }
      
      await logActivity(db, req, 'DELETE_WAREHOUSE', 'Warehouse', `Deleted warehouse [${deleted[0].name}]`);
      res.status(200).json({ success: true, message: 'Warehouse deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // 4. DEPARTMENTS
  // ----------------------------------------------------
  static async getDepartments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const search = req.query.search ? String(req.query.search) : '';
      
      let list = await db.select().from(departments).order(desc(departments.createdAt));
      
      if (search) {
        list = list.filter((d: any) => 
          d.name.toLowerCase().includes(search.toLowerCase()) || 
          d.code.toLowerCase().includes(search.toLowerCase())
        );
      }

      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '10', 10);
      const offset = (page - 1) * limit;
      const paginated = list.slice(offset, offset + limit);
      
      res.status(200).json({
        success: true,
        data: paginated,
        meta: {
          total: list.length,
          page,
          limit,
          totalPages: Math.ceil(list.length / limit)
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async createDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const parsedBody = departmentSchema.parse(req.body);
      
      const docs = await db.insert(departments).values(parsedBody).returning();
      
      await logActivity(db, req, 'CREATE_DEPARTMENT', 'Department', `Created department [${docs[0].name}]`);
      res.status(201).json({ success: true, data: docs[0] });
    } catch (err) {
      next(err);
    }
  }

  static async updateDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      const parsedBody = departmentSchema.parse(req.body);
      
      const updated = await db.update(departments)
        .set(parsedBody)
        .where(eq(departments.id, id))
        .returning();
        
      if (updated.length === 0) {
        res.status(404).json({ success: false, message: 'Department not found' });
        return;
      }
      
      await logActivity(db, req, 'UPDATE_DEPARTMENT', 'Department', `Updated department [${updated[0].name}]`);
      res.status(200).json({ success: true, data: updated[0] });
    } catch (err) {
      next(err);
    }
  }

  static async deleteDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      
      const deleted = await db.delete(departments).where(eq(departments.id, id)).returning();
      if (deleted.length === 0) {
        res.status(404).json({ success: false, message: 'Department not found' });
        return;
      }
      
      await logActivity(db, req, 'DELETE_DEPARTMENT', 'Department', `Deleted department [${deleted[0].name}]`);
      res.status(200).json({ success: true, message: 'Department deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // 5. POSITIONS
  // ----------------------------------------------------
  static async getPositions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const search = req.query.search ? String(req.query.search) : '';
      const departmentId = req.query.departmentId ? String(req.query.departmentId) : '';
      
      let list = await db.select().from(positions).order(desc(positions.createdAt));
      
      if (search) {
        list = list.filter((p: any) => p.title.toLowerCase().includes(search.toLowerCase()));
      }
      
      if (departmentId) {
        list = list.filter((p: any) => p.departmentId === departmentId);
      }

      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '10', 10);
      const offset = (page - 1) * limit;
      const paginated = list.slice(offset, offset + limit);
      
      res.status(200).json({
        success: true,
        data: paginated,
        meta: {
          total: list.length,
          page,
          limit,
          totalPages: Math.ceil(list.length / limit)
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async createPosition(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const parsedBody = positionSchema.parse(req.body);
      
      const docs = await db.insert(positions).values(parsedBody).returning();
      
      await logActivity(db, req, 'CREATE_POSITION', 'Position', `Created Position title [${docs[0].title}]`);
      res.status(201).json({ success: true, data: docs[0] });
    } catch (err) {
      next(err);
    }
  }

  static async updatePosition(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      const parsedBody = positionSchema.parse(req.body);
      
      const updated = await db.update(positions)
        .set(parsedBody)
        .where(eq(positions.id, id))
        .returning();
        
      if (updated.length === 0) {
        res.status(404).json({ success: false, message: 'Position not found' });
        return;
      }
      
      await logActivity(db, req, 'UPDATE_POSITION', 'Position', `Updated position [${updated[0].title}]`);
      res.status(200).json({ success: true, data: updated[0] });
    } catch (err) {
      next(err);
    }
  }

  static async deletePosition(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      
      const deleted = await db.delete(positions).where(eq(positions.id, id)).returning();
      if (deleted.length === 0) {
        res.status(404).json({ success: false, message: 'Position not found' });
        return;
      }
      
      await logActivity(db, req, 'DELETE_POSITION', 'Position', `Deleted position [${deleted[0].title}]`);
      res.status(200).json({ success: true, message: 'Position deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // 6. EMPLOYEES
  // ----------------------------------------------------
  static async getEmployees(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const search = req.query.search ? String(req.query.search) : '';
      const departmentId = req.query.departmentId ? String(req.query.departmentId) : '';
      const status = req.query.status ? String(req.query.status) : '';
      
      let list = await db.select().from(employees).order(desc(employees.createdAt));
      
      if (search) {
        list = list.filter((e: any) => 
          e.firstName.toLowerCase().includes(search.toLowerCase()) || 
          e.lastName.toLowerCase().includes(search.toLowerCase()) || 
          e.employeeId.toLowerCase().includes(search.toLowerCase()) ||
          e.email.toLowerCase().includes(search.toLowerCase())
        );
      }
      
      if (departmentId) {
        list = list.filter((e: any) => e.departmentId === departmentId);
      }
      
      if (status) {
        list = list.filter((e: any) => e.status === status);
      }

      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '10', 10);
      const offset = (page - 1) * limit;
      const paginated = list.slice(offset, offset + limit);
      
      res.status(200).json({
        success: true,
        data: paginated,
        meta: {
          total: list.length,
          page,
          limit,
          totalPages: Math.ceil(list.length / limit)
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async createEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const parsedBody = employeeSchema.parse(req.body);
      
      // Auto-generate employeeId using sequence system
      const employeeIdCode = await generateNextCode(db, 'employee', 'EMP-');
      
      const payload = {
        ...parsedBody,
        employeeId: employeeIdCode,
      };
      
      const docs = await db.insert(employees).values(payload).returning();
      const newEmp = docs[0];
      
      await logActivity(db, req, 'CREATE_EMPLOYEE', 'Employee', `Created employee profile for [${newEmp.firstName} ${newEmp.lastName}] with ID [${newEmp.employeeId}]`);
      await notifyUser(db, null, 'New Employee Profile Created', `Employee profile [${newEmp.firstName} ${newEmp.lastName}] has been successfully initialized in system logs.`, 'success');
      
      res.status(201).json({ success: true, data: newEmp });
    } catch (err) {
      next(err);
    }
  }

  static async updateEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      const parsedBody = employeeSchema.parse(req.body);
      
      const updated = await db.update(employees)
        .set(parsedBody)
        .where(eq(employees.id, id))
        .returning();
        
      if (updated.length === 0) {
        res.status(404).json({ success: false, message: 'Employee not found' });
        return;
      }
      
      await logActivity(db, req, 'UPDATE_EMPLOYEE', 'Employee', `Updated employee profile [${updated[0].firstName} ${updated[0].lastName}]`);
      res.status(200).json({ success: true, data: updated[0] });
    } catch (err) {
      next(err);
    }
  }

  static async deleteEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      
      const deleted = await db.delete(employees).where(eq(employees.id, id)).returning();
      if (deleted.length === 0) {
        res.status(404).json({ success: false, message: 'Employee not found' });
        return;
      }
      
      await logActivity(db, req, 'DELETE_EMPLOYEE', 'Employee', `Deleted employee profile [${deleted[0].firstName} ${deleted[0].lastName}]`);
      res.status(200).json({ success: true, message: 'Employee profile deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // 7. USER INVITATIONS
  // ----------------------------------------------------
  static async getInvitations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const search = req.query.search ? String(req.query.search) : '';
      const status = req.query.status ? String(req.query.status) : '';
      
      let list = await db.select().from(userInvitations).order(desc(userInvitations.createdAt));
      
      if (search) {
        list = list.filter((i: any) => 
          i.email.toLowerCase().includes(search.toLowerCase()) || 
          i.name.toLowerCase().includes(search.toLowerCase())
        );
      }
      
      if (status) {
        list = list.filter((i: any) => i.status === status);
      }

      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '10', 10);
      const offset = (page - 1) * limit;
      const paginated = list.slice(offset, offset + limit);
      
      res.status(200).json({
        success: true,
        data: paginated,
        meta: {
          total: list.length,
          page,
          limit,
          totalPages: Math.ceil(list.length / limit)
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async createInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const parsedBody = invitationSchema.parse(req.body);
      
      const inviteToken = crypto.randomBytes(32).toString('hex');
      const expiry = new Date(Date.now() + 48 * 3600 * 1000); // 48 Hours expiration
      
      const payload = {
        ...parsedBody,
        token: inviteToken,
        expiresAt: expiry,
        status: 'pending',
      };
      
      const docs = await db.insert(userInvitations).values(payload).returning();
      const invite = docs[0];
      
      await logActivity(db, req, 'CREATE_INVITATION', 'Invitation', `Sent tenant invitation to [${invite.name}] (${invite.email})`);
      await notifyUser(db, null, 'User Invitation Dispatched', `Workspace invitation successfully generated and dispatched for ${invite.name}.`, 'info');
      
      res.status(201).json({ success: true, data: invite });
    } catch (err) {
      next(err);
    }
  }

  static async cancelInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      
      const deleted = await db.delete(userInvitations).where(eq(userInvitations.id, id)).returning();
      if (deleted.length === 0) {
        res.status(404).json({ success: false, message: 'Invitation not found' });
        return;
      }
      
      await logActivity(db, req, 'CANCEL_INVITATION', 'Invitation', `Canceled invitation for [${deleted[0].name}] (${deleted[0].email})`);
      res.status(200).json({ success: true, message: 'Invitation canceled successfully' });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // 8. CURRENCIES
  // ----------------------------------------------------
  static async getCurrencies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const search = req.query.search ? String(req.query.search) : '';
      
      let list = await db.select().from(currencies).order(desc(currencies.isBase));
      
      if (search) {
        list = list.filter((c: any) => 
          c.code.toLowerCase().includes(search.toLowerCase()) || 
          c.name.toLowerCase().includes(search.toLowerCase())
        );
      }
      
      if (list.length === 0) {
        // Seed standard base currency USD if empty
        const seeded = await db.insert(currencies).values({
          code: 'USD',
          name: 'US Dollar',
          symbol: '$',
          exchangeRate: '1.0',
          isBase: true,
          status: 'active',
        }).returning();
        list = seeded;
      }

      res.status(200).json({ success: true, data: list });
    } catch (err) {
      next(err);
    }
  }

  static async createCurrency(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const parsedBody = currencySchema.parse(req.body);
      
      if (parsedBody.isBase) {
        // Reset base status of any existing currencies
        await db.update(currencies).set({ isBase: false });
      }
      
      const docs = await db.insert(currencies).values(parsedBody).returning();
      
      await logActivity(db, req, 'CREATE_CURRENCY', 'Settings', `Added currency [${docs[0].code}] with rate [${docs[0].exchangeRate}]`);
      res.status(201).json({ success: true, data: docs[0] });
    } catch (err) {
      next(err);
    }
  }

  static async updateCurrency(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      const parsedBody = currencySchema.parse(req.body);
      
      if (parsedBody.isBase) {
        await db.update(currencies).set({ isBase: false });
      }
      
      const updated = await db.update(currencies)
        .set(parsedBody)
        .where(eq(currencies.id, id))
        .returning();
        
      if (updated.length === 0) {
        res.status(404).json({ success: false, message: 'Currency not found' });
        return;
      }
      
      await logActivity(db, req, 'UPDATE_CURRENCY', 'Settings', `Updated currency [${updated[0].code}]`);
      res.status(200).json({ success: true, data: updated[0] });
    } catch (err) {
      next(err);
    }
  }

  static async deleteCurrency(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      
      const deleted = await db.delete(currencies).where(eq(currencies.id, id)).returning();
      if (deleted.length === 0) {
        res.status(404).json({ success: false, message: 'Currency not found' });
        return;
      }
      
      await logActivity(db, req, 'DELETE_CURRENCY', 'Settings', `Deleted currency [${deleted[0].code}]`);
      res.status(200).json({ success: true, message: 'Currency deleted' });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // 9. TAX CONFIGURATION
  // ----------------------------------------------------
  static async getTaxes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const list = await db.select().from(taxConfigurations).order(desc(taxConfigurations.createdAt));
      res.status(200).json({ success: true, data: list });
    } catch (err) {
      next(err);
    }
  }

  static async createTax(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const parsedBody = taxSchema.parse(req.body);
      
      const docs = await db.insert(taxConfigurations).values(parsedBody).returning();
      
      await logActivity(db, req, 'CREATE_TAX', 'Settings', `Created tax configuration [${docs[0].name}] at rate [${docs[0].rate}%]`);
      res.status(201).json({ success: true, data: docs[0] });
    } catch (err) {
      next(err);
    }
  }

  static async updateTax(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      const parsedBody = taxSchema.parse(req.body);
      
      const updated = await db.update(taxConfigurations)
        .set(parsedBody)
        .where(eq(taxConfigurations.id, id))
        .returning();
        
      if (updated.length === 0) {
        res.status(404).json({ success: false, message: 'Tax not found' });
        return;
      }
      
      await logActivity(db, req, 'UPDATE_TAX', 'Settings', `Updated tax rate for [${updated[0].name}]`);
      res.status(200).json({ success: true, data: updated[0] });
    } catch (err) {
      next(err);
    }
  }

  static async deleteTax(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      
      const deleted = await db.delete(taxConfigurations).where(eq(taxConfigurations.id, id)).returning();
      if (deleted.length === 0) {
        res.status(404).json({ success: false, message: 'Tax config not found' });
        return;
      }
      
      await logActivity(db, req, 'DELETE_TAX', 'Settings', `Deleted tax category [${deleted[0].name}]`);
      res.status(200).json({ success: true, message: 'Tax deleted' });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // 10. NUMBERING SYSTEM / SEQUENCES
  // ----------------------------------------------------
  static async getSequences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      let list = await db.select().from(numberSequences).order(desc(numberSequences.createdAt));
      
      if (list.length === 0) {
        // Seed default document prefixes
        const seedItems = [
          { module: 'employee', prefix: 'EMP-', nextNumber: 1, digits: 4 },
          { module: 'branch', prefix: 'BR-', nextNumber: 1, digits: 3 },
          { module: 'warehouse', prefix: 'WH-', nextNumber: 1, digits: 3 },
          { module: 'invitation', prefix: 'INV-', nextNumber: 1, digits: 4 }
        ];
        
        for (const item of seedItems) {
          await db.insert(numberSequences).values(item);
        }
        list = await db.select().from(numberSequences).order(desc(numberSequences.createdAt));
      }
      
      res.status(200).json({ success: true, data: list });
    } catch (err) {
      next(err);
    }
  }

  static async updateSequence(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      const parsedBody = numberSequenceSchema.parse(req.body);
      
      const updated = await db.update(numberSequences)
        .set(parsedBody)
        .where(eq(numberSequences.id, id))
        .returning();
        
      if (updated.length === 0) {
        res.status(404).json({ success: false, message: 'Sequence not found' });
        return;
      }
      
      await logActivity(db, req, 'UPDATE_SEQUENCE', 'Settings', `Updated prefix sequence for module [${updated[0].module}]`);
      res.status(200).json({ success: true, data: updated[0] });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // 11. FILE STORAGE (MOCK DIRECTORY ACTIONS)
  // ----------------------------------------------------
  static async getFiles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const list = await db.select().from(files).order(desc(files.createdAt));
      res.status(200).json({ success: true, data: list });
    } catch (err) {
      next(err);
    }
  }

  static async uploadFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const fileId = crypto.randomUUID();
      const filename = req.body.filename || 'uploaded_document.pdf';
      const fileSize = req.body.fileSize || Math.floor(Math.random() * 500000) + 1024;
      const mimeType = req.body.mimeType || 'application/pdf';
      const fileUrl = `/uploads/${fileId}_${filename}`;
      
      const docs = await db.insert(files).values({
        id: fileId,
        filename,
        fileSize,
        mimeType,
        url: fileUrl,
        uploadedBy: req.user?.id || null,
      }).returning();
      
      await logActivity(db, req, 'UPLOAD_FILE', 'FileStorage', `Uploaded document [${filename}]`);
      res.status(201).json({ success: true, data: docs[0] });
    } catch (err) {
      next(err);
    }
  }

  static async deleteFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      
      const deleted = await db.delete(files).where(eq(files.id, id)).returning();
      if (deleted.length === 0) {
        res.status(404).json({ success: false, message: 'File not found' });
        return;
      }
      
      await logActivity(db, req, 'DELETE_FILE', 'FileStorage', `Removed document [${deleted[0].filename}]`);
      res.status(200).json({ success: true, message: 'File successfully purged' });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // 12. AUDIT & ACTIVITY LOGS
  // ----------------------------------------------------
  static async getActivityLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const moduleFilter = req.query.module ? String(req.query.module) : '';
      
      let list = await db.select().from(activityLogs).order(desc(activityLogs.createdAt));
      
      if (moduleFilter) {
        list = list.filter((l: any) => l.module.toLowerCase() === moduleFilter.toLowerCase());
      }
      
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '15', 10);
      const offset = (page - 1) * limit;
      const paginated = list.slice(offset, offset + limit);
      
      res.status(200).json({
        success: true,
        data: paginated,
        meta: {
          total: list.length,
          page,
          limit,
          totalPages: Math.ceil(list.length / limit)
        }
      });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // 13. NOTIFICATION SYSTEM
  // ----------------------------------------------------
  static async getNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const list = await db.select().from(notifications).order(desc(notifications.createdAt));
      res.status(200).json({ success: true, data: list });
    } catch (err) {
      next(err);
    }
  }

  static async markNotificationAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      
      const updated = await db.update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.id, id))
        .returning();
        
      if (updated.length === 0) {
        res.status(404).json({ success: false, message: 'Notification not found' });
        return;
      }
      
      res.status(200).json({ success: true, data: updated[0] });
    } catch (err) {
      next(err);
    }
  }

  static async markAllNotificationsAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const list = await db.select().from(notifications);
      
      for (const item of list) {
        await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, item.id));
      }
      
      res.status(200).json({ success: true, message: 'All notifications marked as read' });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // 14. INVENTORY & PRODUCT CATEGORIES
  // ----------------------------------------------------
  static async getCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const list = await db.select().from(productCategories).order(desc(productCategories.createdAt));
      res.status(200).json({ success: true, data: list });
    } catch (err) {
      next(err);
    }
  }

  static async createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const body = z.object({
        name: z.string().min(1),
        code: z.string().min(1),
        description: z.string().optional().nullable()
      }).parse(req.body);

      const inserted = await db.insert(productCategories).values({
        name: body.name,
        code: body.code.toUpperCase(),
        description: body.description
      }).returning();

      await logActivity(db, req, 'CREATE_PRODUCT_CATEGORY', 'Inventory', `Created product category ${body.name} (${body.code})`);
      res.status(201).json({ success: true, data: inserted[0] });
    } catch (err) {
      next(err);
    }
  }

  static async updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      const body = z.object({
        name: z.string().min(1),
        code: z.string().min(1),
        description: z.string().optional().nullable()
      }).parse(req.body);

      const updated = await db.update(productCategories)
        .set({
          name: body.name,
          code: body.code.toUpperCase(),
          description: body.description
        })
        .where(eq(productCategories.id, id))
        .returning();

      if (updated.length === 0) {
        res.status(404).json({ success: false, message: 'Category not found' });
        return;
      }

      await logActivity(db, req, 'UPDATE_PRODUCT_CATEGORY', 'Inventory', `Updated product category ${body.name}`);
      res.status(200).json({ success: true, data: updated[0] });
    } catch (err) {
      next(err);
    }
  }

  static async deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;

      const deleted = await db.delete(productCategories).where(eq(productCategories.id, id)).returning();
      if (deleted.length === 0) {
        res.status(404).json({ success: false, message: 'Category not found' });
        return;
      }

      await logActivity(db, req, 'DELETE_PRODUCT_CATEGORY', 'Inventory', `Deleted product category with ID ${id}`);
      res.status(200).json({ success: true, message: 'Category deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // 15. BRANDS
  // ----------------------------------------------------
  static async getBrands(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const list = await db.select().from(brands).order(desc(brands.createdAt));
      res.status(200).json({ success: true, data: list });
    } catch (err) {
      next(err);
    }
  }

  static async createBrand(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const body = z.object({
        name: z.string().min(1),
        code: z.string().min(1),
        description: z.string().optional().nullable()
      }).parse(req.body);

      const inserted = await db.insert(brands).values({
        name: body.name,
        code: body.code.toUpperCase(),
        description: body.description
      }).returning();

      await logActivity(db, req, 'CREATE_BRAND', 'Inventory', `Created brand ${body.name}`);
      res.status(201).json({ success: true, data: inserted[0] });
    } catch (err) {
      next(err);
    }
  }

  static async updateBrand(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      const body = z.object({
        name: z.string().min(1),
        code: z.string().min(1),
        description: z.string().optional().nullable()
      }).parse(req.body);

      const updated = await db.update(brands)
        .set({
          name: body.name,
          code: body.code.toUpperCase(),
          description: body.description
        })
        .where(eq(brands.id, id))
        .returning();

      if (updated.length === 0) {
        res.status(404).json({ success: false, message: 'Brand not found' });
        return;
      }

      await logActivity(db, req, 'UPDATE_BRAND', 'Inventory', `Updated brand ${body.name}`);
      res.status(200).json({ success: true, data: updated[0] });
    } catch (err) {
      next(err);
    }
  }

  static async deleteBrand(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;

      const deleted = await db.delete(brands).where(eq(brands.id, id)).returning();
      if (deleted.length === 0) {
        res.status(404).json({ success: false, message: 'Brand not found' });
        return;
      }

      await logActivity(db, req, 'DELETE_BRAND', 'Inventory', `Deleted brand with ID ${id}`);
      res.status(200).json({ success: true, message: 'Brand deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // 16. UNITS OF MEASURE (UoM)
  // ----------------------------------------------------
  static async getUoms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const list = await db.select().from(unitsOfMeasure).order(desc(unitsOfMeasure.createdAt));
      res.status(200).json({ success: true, data: list });
    } catch (err) {
      next(err);
    }
  }

  static async createUom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const body = z.object({
        name: z.string().min(1),
        code: z.string().min(1),
        type: z.string().default('count')
      }).parse(req.body);

      const inserted = await db.insert(unitsOfMeasure).values({
        name: body.name,
        code: body.code.toUpperCase(),
        type: body.type
      }).returning();

      await logActivity(db, req, 'CREATE_UOM', 'Inventory', `Created unit of measure ${body.name} (${body.code})`);
      res.status(201).json({ success: true, data: inserted[0] });
    } catch (err) {
      next(err);
    }
  }

  static async updateUom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      const body = z.object({
        name: z.string().min(1),
        code: z.string().min(1),
        type: z.string().default('count')
      }).parse(req.body);

      const updated = await db.update(unitsOfMeasure)
        .set({
          name: body.name,
          code: body.code.toUpperCase(),
          type: body.type
        })
        .where(eq(unitsOfMeasure.id, id))
        .returning();

      if (updated.length === 0) {
        res.status(404).json({ success: false, message: 'UoM not found' });
        return;
      }

      await logActivity(db, req, 'UPDATE_UOM', 'Inventory', `Updated unit of measure ${body.name}`);
      res.status(200).json({ success: true, data: updated[0] });
    } catch (err) {
      next(err);
    }
  }

  static async deleteUom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;

      const deleted = await db.delete(unitsOfMeasure).where(eq(unitsOfMeasure.id, id)).returning();
      if (deleted.length === 0) {
        res.status(404).json({ success: false, message: 'UoM not found' });
        return;
      }

      await logActivity(db, req, 'DELETE_UOM', 'Inventory', `Deleted unit of measure with ID ${id}`);
      res.status(200).json({ success: true, message: 'Unit of measure deleted' });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // 17. PRODUCTS
  // ----------------------------------------------------
  static async getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const list = await db.select().from(products).order(desc(products.createdAt));
      
      // Let's also retrieve categories, brands, and UoMs to assemble in memory for safety
      const cats = await db.select().from(productCategories);
      const brds = await db.select().from(brands);
      const uoms = await db.select().from(unitsOfMeasure);

      const mapped = list.map((p: any) => {
        const categoryId = p.categoryId || p.category_id;
        const brandId = p.brandId || p.brand_id;
        const uomId = p.uomId || p.uom_id;

        return {
          ...p,
          category: cats.find((c: any) => c.id === categoryId) || null,
          brand: brds.find((b: any) => b.id === brandId) || null,
          uom: uoms.find((u: any) => u.id === uomId) || null
        };
      });

      res.status(200).json({ success: true, data: mapped });
    } catch (err) {
      next(err);
    }
  }

  static async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const body = z.object({
        name: z.string().min(1),
        categoryId: z.string().uuid().optional().nullable(),
        brandId: z.string().uuid().optional().nullable(),
        uomId: z.string().uuid().optional().nullable(),
        code: z.string().optional().nullable(),
        sku: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
        barcode: z.string().optional().nullable(),
        status: z.enum(['active', 'inactive', 'draft']).default('active'),
        lowStockThreshold: z.number().int().default(10),
        alertEnabled: z.boolean().default(true),
        costPrice: z.string().default('0.00'),
        sellingPrice: z.string().default('0.00'),
        trackingType: z.enum(['serial', 'batch', 'none']).default('none'),
        variants: z.array(z.object({
          name: z.string().min(1),
          sku: z.string(),
          barcode: z.string().optional().nullable(),
          costPrice: z.string().default('0.00'),
          sellingPrice: z.string().default('0.00')
        })).optional()
      }).parse(req.body);

      // Automated Code & SKU generator
      const productCode = body.code || await generateNextCode(db, 'ProductCode', 'PRD-');
      const productSku = body.sku || `SKU-${productCode}-${Math.floor(1000 + Math.random() * 9000)}`;
      const barcode = body.barcode || `BAR-${Math.floor(100000000000 + Math.random() * 900000000000)}`;
      
      // QR Code Support
      const qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(productSku)}`;

      const inserted = await db.insert(products).values({
        categoryId: body.categoryId || null,
        brandId: body.brandId || null,
        uomId: body.uomId || null,
        name: body.name,
        code: productCode,
        sku: productSku,
        description: body.description,
        barcode,
        qrCode,
        status: body.status,
        lowStockThreshold: body.lowStockThreshold,
        alertEnabled: body.alertEnabled,
        costPrice: body.costPrice,
        sellingPrice: body.sellingPrice,
        trackingType: body.trackingType
      }).returning();

      const product = inserted[0];

      // Auto create variants if supplied
      if (body.variants && body.variants.length > 0) {
        for (const v of body.variants) {
          await db.insert(productVariants).values({
            productId: product.id,
            name: v.name,
            sku: v.sku,
            barcode: v.barcode || `BAR-${Math.floor(100000000000 + Math.random() * 900000000000)}`,
            costPrice: v.costPrice,
            sellingPrice: v.sellingPrice
          });
        }
      }

      await logActivity(db, req, 'CREATE_PRODUCT', 'Inventory', `Created product ${body.name} (${productSku})`);
      res.status(201).json({ success: true, data: product });
    } catch (err) {
      next(err);
    }
  }

  static async updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      const body = z.object({
        name: z.string().min(1),
        categoryId: z.string().uuid().optional().nullable(),
        brandId: z.string().uuid().optional().nullable(),
        uomId: z.string().uuid().optional().nullable(),
        description: z.string().optional().nullable(),
        status: z.enum(['active', 'inactive', 'draft']).default('active'),
        lowStockThreshold: z.number().int().default(10),
        alertEnabled: z.boolean().default(true),
        costPrice: z.string().default('0.00'),
        sellingPrice: z.string().default('0.00'),
        trackingType: z.enum(['serial', 'batch', 'none']).default('none')
      }).parse(req.body);

      const updated = await db.update(products)
        .set({
          name: body.name,
          categoryId: body.categoryId || null,
          brandId: body.brandId || null,
          uomId: body.uomId || null,
          description: body.description,
          status: body.status,
          lowStockThreshold: body.lowStockThreshold,
          alertEnabled: body.alertEnabled,
          costPrice: body.costPrice,
          sellingPrice: body.sellingPrice,
          trackingType: body.trackingType,
          updatedAt: new Date()
        })
        .where(eq(products.id, id))
        .returning();

      if (updated.length === 0) {
        res.status(404).json({ success: false, message: 'Product not found' });
        return;
      }

      await logActivity(db, req, 'UPDATE_PRODUCT', 'Inventory', `Updated product ${body.name}`);
      res.status(200).json({ success: true, data: updated[0] });
    } catch (err) {
      next(err);
    }
  }

  static async deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;

      const deleted = await db.delete(products).where(eq(products.id, id)).returning();
      if (deleted.length === 0) {
        res.status(404).json({ success: false, message: 'Product not found' });
        return;
      }

      await logActivity(db, req, 'DELETE_PRODUCT', 'Inventory', `Deleted product with ID ${id}`);
      res.status(200).json({ success: true, message: 'Product deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // 18. PRODUCT VARIANTS
  // ----------------------------------------------------
  static async getProductVariants(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { productId } = req.params;
      const list = await db.select().from(productVariants).where(eq(productVariants.productId, productId));
      res.status(200).json({ success: true, data: list });
    } catch (err) {
      next(err);
    }
  }

  static async createProductVariant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { productId } = req.params;
      const body = z.object({
        name: z.string().min(1),
        sku: z.string().min(1),
        barcode: z.string().optional().nullable(),
        costPrice: z.string().default('0.00'),
        sellingPrice: z.string().default('0.00')
      }).parse(req.body);

      const barcode = body.barcode || `BAR-${Math.floor(100000000000 + Math.random() * 900000000000)}`;

      const inserted = await db.insert(productVariants).values({
        productId,
        name: body.name,
        sku: body.sku,
        barcode,
        costPrice: body.costPrice,
        sellingPrice: body.sellingPrice
      }).returning();

      await logActivity(db, req, 'CREATE_PRODUCT_VARIANT', 'Inventory', `Created variant ${body.name} for product ID ${productId}`);
      res.status(201).json({ success: true, data: inserted[0] });
    } catch (err) {
      next(err);
    }
  }

  static async deleteProductVariant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;

      const deleted = await db.delete(productVariants).where(eq(productVariants.id, id)).returning();
      if (deleted.length === 0) {
        res.status(404).json({ success: false, message: 'Variant not found' });
        return;
      }

      await logActivity(db, req, 'DELETE_PRODUCT_VARIANT', 'Inventory', `Deleted product variant ID ${id}`);
      res.status(200).json({ success: true, message: 'Product variant deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // 19. STOCK LOCATIONS
  // ----------------------------------------------------
  static async getLocations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const list = await db.select().from(stockLocations).order(desc(stockLocations.createdAt));
      res.status(200).json({ success: true, data: list });
    } catch (err) {
      next(err);
    }
  }

  static async createLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const body = z.object({
        warehouseId: z.string().uuid(),
        name: z.string().min(1),
        code: z.string().min(1),
        zone: z.string().optional().nullable(),
        aisle: z.string().optional().nullable(),
        shelf: z.string().optional().nullable(),
        bin: z.string().optional().nullable(),
        status: z.enum(['active', 'inactive']).default('active')
      }).parse(req.body);

      const inserted = await db.insert(stockLocations).values({
        warehouseId: body.warehouseId,
        name: body.name,
        code: body.code.toUpperCase(),
        zone: body.zone,
        aisle: body.aisle,
        shelf: body.shelf,
        bin: body.bin,
        status: body.status
      }).returning();

      await logActivity(db, req, 'CREATE_STOCK_LOCATION', 'Inventory', `Created stock location ${body.name} (${body.code})`);
      res.status(201).json({ success: true, data: inserted[0] });
    } catch (err) {
      next(err);
    }
  }

  static async updateLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;
      const body = z.object({
        warehouseId: z.string().uuid(),
        name: z.string().min(1),
        code: z.string().min(1),
        zone: z.string().optional().nullable(),
        aisle: z.string().optional().nullable(),
        shelf: z.string().optional().nullable(),
        bin: z.string().optional().nullable(),
        status: z.enum(['active', 'inactive']).default('active')
      }).parse(req.body);

      const updated = await db.update(stockLocations)
        .set({
          warehouseId: body.warehouseId,
          name: body.name,
          code: body.code.toUpperCase(),
          zone: body.zone,
          aisle: body.aisle,
          shelf: body.shelf,
          bin: body.bin,
          status: body.status,
          updatedAt: new Date()
        })
        .where(eq(stockLocations.id, id))
        .returning();

      if (updated.length === 0) {
        res.status(404).json({ success: false, message: 'Stock location not found' });
        return;
      }

      await logActivity(db, req, 'UPDATE_STOCK_LOCATION', 'Inventory', `Updated stock location ${body.name}`);
      res.status(200).json({ success: true, data: updated[0] });
    } catch (err) {
      next(err);
    }
  }

  static async deleteLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const { id } = req.params;

      const deleted = await db.delete(stockLocations).where(eq(stockLocations.id, id)).returning();
      if (deleted.length === 0) {
        res.status(404).json({ success: false, message: 'Stock location not found' });
        return;
      }

      await logActivity(db, req, 'DELETE_STOCK_LOCATION', 'Inventory', `Deleted stock location with ID ${id}`);
      res.status(200).json({ success: true, message: 'Stock location deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // 20. STOCK TRANSACTIONS & MOVEMENTS
  // ----------------------------------------------------
  static async getMovements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const list = await db.select().from(stockMovements).order(desc(stockMovements.createdAt));
      
      const prods = await db.select().from(products);
      const whs = await db.select().from(warehouses);
      const locs = await db.select().from(stockLocations);
      const movementItems = await db.select().from(stockMovementItems);

      const assembled = list.map((m: any) => {
        const sourceWhId = m.sourceWarehouseId || m.source_warehouse_id;
        const destWhId = m.destWarehouseId || m.dest_warehouse_id;

        const items = movementItems
          .filter((mi: any) => mi.movementId === m.id || mi.movement_id === m.id)
          .map((mi: any) => {
            const pId = mi.productId || mi.product_id;
            return {
              ...mi,
              product: prods.find((p: any) => p.id === pId) || null
            };
          });

        return {
          ...m,
          sourceWarehouse: whs.find((w: any) => w.id === sourceWhId) || null,
          destWarehouse: whs.find((w: any) => w.id === destWhId) || null,
          items
        };
      });

      res.status(200).json({ success: true, data: assembled });
    } catch (err) {
      next(err);
    }
  }

  static async createMovement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const body = z.object({
        type: z.enum(['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT']),
        sourceWarehouseId: z.string().uuid().optional().nullable(),
        sourceLocationId: z.string().uuid().optional().nullable(),
        destWarehouseId: z.string().uuid().optional().nullable(),
        destLocationId: z.string().uuid().optional().nullable(),
        notes: z.string().optional().nullable(),
        referenceNumber: z.string().optional().nullable(),
        items: z.array(z.object({
          productId: z.string().uuid(),
          variantId: z.string().uuid().optional().nullable(),
          quantity: z.number().int().min(1),
          unitCost: z.string().default('0.00'),
          batchNumber: z.string().optional().nullable(),
          serialNumber: z.string().optional().nullable(),
          expirationDate: z.string().optional().nullable()
        })).min(1, 'Must include at least one item')
      }).parse(req.body);

      // Sequence Code Generation
      const prefix = body.type === 'IN' ? 'REC-' : body.type === 'OUT' ? 'SHP-' : body.type === 'TRANSFER' ? 'TRF-' : 'ADJ-';
      const refNumber = body.referenceNumber || await generateNextCode(db, `StockMovement-${body.type}`, prefix);

      // Create main stock movement
      const movementInserted = await db.insert(stockMovements).values({
        type: body.type,
        sourceWarehouseId: body.sourceWarehouseId || null,
        sourceLocationId: body.sourceLocationId || null,
        destWarehouseId: body.destWarehouseId || null,
        destLocationId: body.destLocationId || null,
        referenceNumber: refNumber,
        notes: body.notes,
        performedBy: req.user?.id || null
      }).returning();

      const movement = movementInserted[0];

      // Handle individual items and adjust on-hand inventory item levels
      for (const item of body.items) {
        // Create detail log
        await db.insert(stockMovementItems).values({
          movementId: movement.id,
          productId: item.productId,
          variantId: item.variantId || null,
          quantity: item.quantity,
          unitCost: item.unitCost,
          batchNumber: item.batchNumber || null,
          serialNumber: item.serialNumber || null
        });

        // ----------------------------------------------------
        // DYNAMIC INVENTORY ON-HAND LEVEL UPDATES
        // ----------------------------------------------------
        
        // Helper to adjust stock
        const adjustStock = async (warehouseId: string, locationId: string | null, increment: boolean) => {
          // Look for matching physical stock item
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
            const curQty = matched.quantity !== undefined ? matched.quantity : matched.quantity;
            const newQty = increment ? (curQty + item.quantity) : (curQty - item.quantity);
            await db.update(inventoryItems)
              .set({ quantity: newQty, updatedAt: new Date() })
              .where(eq(inventoryItems.id, matched.id));
          } else {
            // Not found and we're incrementing -> Insert!
            if (increment) {
              await db.insert(inventoryItems).values({
                productId: item.productId,
                variantId: item.variantId || null,
                warehouseId,
                locationId: locationId || null,
                quantity: item.quantity,
                batchNumber: item.batchNumber || null,
                serialNumber: item.serialNumber || null,
                expirationDate: item.expirationDate ? new Date(item.expirationDate) : null
              });
            } else {
              // Decrementing without a matching level (negative inventory enabled as fallback or throw warning)
              await db.insert(inventoryItems).values({
                productId: item.productId,
                variantId: item.variantId || null,
                warehouseId,
                locationId: locationId || null,
                quantity: -item.quantity,
                batchNumber: item.batchNumber || null,
                serialNumber: item.serialNumber || null,
                expirationDate: item.expirationDate ? new Date(item.expirationDate) : null
              });
            }
          }
        };

        if (body.type === 'IN') {
          if (!body.destWarehouseId) throw new Error('Destination warehouse is required for IN movements');
          await adjustStock(body.destWarehouseId, body.destLocationId || null, true);
        } else if (body.type === 'OUT') {
          if (!body.sourceWarehouseId) throw new Error('Source warehouse is required for OUT movements');
          await adjustStock(body.sourceWarehouseId, body.sourceLocationId || null, false);
        } else if (body.type === 'TRANSFER') {
          if (!body.sourceWarehouseId || !body.destWarehouseId) throw new Error('Both source and destination warehouses are required for transfer');
          await adjustStock(body.sourceWarehouseId, body.sourceLocationId || null, false);
          await adjustStock(body.destWarehouseId, body.destLocationId || null, true);
        } else if (body.type === 'ADJUSTMENT') {
          // If destination warehouse is supplied, adjust positive, if source warehouse is supplied adjust negative
          if (body.destWarehouseId) {
            await adjustStock(body.destWarehouseId, body.destLocationId || null, true);
          } else if (body.sourceWarehouseId) {
            await adjustStock(body.sourceWarehouseId, body.sourceLocationId || null, false);
          }
        }
      }

      // Check for Low Stock Trigger after movements and notify
      const allStocks = await db.select().from(inventoryItems);
      const allProds = await db.select().from(products);
      
      for (const prod of allProds) {
        const prodId = prod.id;
        const totalQty = allStocks
          .filter((s: any) => (s.productId === prodId || s.product_id === prodId))
          .reduce((sum: number, current: any) => sum + (current.quantity || 0), 0);

        if (totalQty <= prod.lowStockThreshold && prod.alertEnabled) {
          await notifyUser(
            db,
            req.user?.id || null,
            'Low Stock Alert!',
            `Product ${prod.name} has dropped to ${totalQty} units on hand (Threshold: ${prod.lowStockThreshold})`,
            'warning'
          );
        }
      }

      await logActivity(db, req, 'CREATE_STOCK_MOVEMENT', 'Inventory', `Processed stock movement ${body.type} - Ref ${refNumber}`);
      res.status(201).json({ success: true, data: movement });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // 21. STOCK LEVELS & VALUATION
  // ----------------------------------------------------
  static async getStockLevels(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const list = await db.select().from(inventoryItems);
      
      const prods = await db.select().from(products);
      const vars = await db.select().from(productVariants);
      const whs = await db.select().from(warehouses);
      const locs = await db.select().from(stockLocations);

      const mapped = list.map((item: any) => {
        const pId = item.productId || item.product_id;
        const vId = item.variantId || item.variant_id;
        const wId = item.warehouseId || item.warehouse_id;
        const lId = item.locationId || item.location_id;

        const product = prods.find((p: any) => p.id === pId) || null;
        const variant = vars.find((v: any) => v.id === vId) || null;
        const warehouse = whs.find((w: any) => w.id === wId) || null;
        const location = locs.find((l: any) => l.id === lId) || null;

        const qty = item.quantity !== undefined ? item.quantity : 0;
        const threshold = product ? (product.lowStockThreshold || 0) : 0;

        return {
          ...item,
          product,
          variant,
          warehouse,
          location,
          isLowStock: qty <= threshold
        };
      });

      res.status(200).json({ success: true, data: mapped });
    } catch (err) {
      next(err);
    }
  }

  static async getStockValuation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;
      const list = await db.select().from(inventoryItems);
      const prods = await db.select().from(products);
      const cats = await db.select().from(productCategories);

      let totalCostValue = 0;
      let totalSellingValue = 0;
      let totalItems = 0;

      const categoryDistribution: Record<string, { count: number, costValue: number, sellingValue: number }> = {};

      for (const item of list) {
        const pId = item.productId || item.product_id;
        const product = prods.find((p: any) => p.id === pId);
        if (!product) continue;

        const qty = item.quantity || 0;
        const cost = parseFloat(product.costPrice || '0');
        const price = parseFloat(product.sellingPrice || '0');

        totalCostValue += qty * cost;
        totalSellingValue += qty * price;
        totalItems += qty;

        const catId = product.categoryId || product.category_id || 'unassigned';
        const catName = cats.find((c: any) => c.id === catId)?.name || 'Unassigned';

        if (!categoryDistribution[catName]) {
          categoryDistribution[catName] = { count: 0, costValue: 0, sellingValue: 0 };
        }
        categoryDistribution[catName].count += qty;
        categoryDistribution[catName].costValue += qty * cost;
        categoryDistribution[catName].sellingValue += qty * price;
      }

      const margin = totalSellingValue > 0 ? ((totalSellingValue - totalCostValue) / totalSellingValue) * 100 : 0;

      res.status(200).json({
        success: true,
        data: {
          totalItems,
          totalCostValue: totalCostValue.toFixed(2),
          totalSellingValue: totalSellingValue.toFixed(2),
          estimatedProfit: (totalSellingValue - totalCostValue).toFixed(2),
          profitMarginPercent: margin.toFixed(1),
          categoryDistribution: Object.entries(categoryDistribution).map(([name, data]) => ({
            name,
            count: data.count,
            costValue: data.costValue.toFixed(2),
            sellingValue: data.sellingValue.toFixed(2)
          }))
        }
      });
    } catch (err) {
      next(err);
    }
  }

  // ----------------------------------------------------
  // 22. INVENTORY DASHBOARD OVERVIEW
  // ----------------------------------------------------
  static async getInventoryDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const db = req.db;

      // Core counts
      const prodList = await db.select().from(products);
      const catList = await db.select().from(productCategories);
      const whList = await db.select().from(warehouses);
      const stockList = await db.select().from(inventoryItems);
      const movementList = await db.select().from(stockMovements).order(desc(stockMovements.createdAt));

      // 1. Valuation summary
      let totalCost = 0;
      let totalRevenue = 0;
      let totalQty = 0;
      const lowStockAlerts: any[] = [];

      for (const item of stockList) {
        const pId = item.productId || item.product_id;
        const product = prodList.find((p: any) => p.id === pId);
        if (!product) continue;

        const qty = item.quantity || 0;
        totalQty += qty;
        totalCost += qty * parseFloat(product.costPrice || '0');
        totalRevenue += qty * parseFloat(product.sellingPrice || '0');
      }

      // 2. Identify low stock items
      for (const p of prodList) {
        const totalProdQty = stockList
          .filter((s: any) => (s.productId === p.id || s.product_id === p.id))
          .reduce((sum: number, current: any) => sum + (current.quantity || 0), 0);

        if (totalProdQty <= p.lowStockThreshold) {
          lowStockAlerts.push({
            id: p.id,
            name: p.name,
            sku: p.sku,
            lowStockThreshold: p.lowStockThreshold,
            currentStock: totalProdQty
          });
        }
      }

      // Assemble payload
      res.status(200).json({
        success: true,
        data: {
          stats: {
            totalProducts: prodList.length,
            totalCategories: catList.length,
            totalWarehouses: whList.length,
            totalItemsOnHand: totalQty,
            valuationCost: totalCost.toFixed(2),
            valuationRevenue: totalRevenue.toFixed(2),
            potentialMargin: totalRevenue > 0 ? (((totalRevenue - totalCost) / totalRevenue) * 100).toFixed(1) : '0.0'
          },
          lowStock: lowStockAlerts.slice(0, 5),
          recentMovements: movementList.slice(0, 5)
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

