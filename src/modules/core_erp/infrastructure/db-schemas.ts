import { pgTable, uuid, varchar, timestamp, text, boolean, integer } from 'drizzle-orm/pg-core';

// ----------------------------------------------------
// 1. PUBLIC GLOBAL SCHEMAS (System Registry)
// ----------------------------------------------------
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  domain: varchar('domain', { length: 128 }).notNull().unique(),
  name: varchar('name', { length: 256 }).notNull(),
  schema: varchar('schema', { length: 128 }).notNull().unique(),
  status: varchar('status', { length: 32 }).notNull().default('active'), // 'active', 'suspended', 'onboarding'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ----------------------------------------------------
// 2. TENANT-TEMPLATE SCHEMAS (Dynamic Isolated Tables)
// ----------------------------------------------------

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 256 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: varchar('name', { length: 256 }).notNull(),
  role: varchar('role', { length: 64 }).notNull().default('member'), // 'owner', 'admin', 'member'
  status: varchar('status', { length: 32 }).notNull().default('active'), // 'active', 'suspended'
  isVerified: boolean('is_verified').notNull().default(false),
  verificationToken: varchar('verification_token', { length: 256 }),
  resetToken: varchar('reset_token', { length: 256 }),
  resetTokenExpiresAt: timestamp('reset_token_expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 512 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Organization & Company Profile
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 256 }).notNull(),
  taxId: varchar('tax_id', { length: 128 }),
  email: varchar('email', { length: 256 }),
  phone: varchar('phone', { length: 64 }),
  website: varchar('website', { length: 256 }),
  address: text('address'),
  logoUrl: text('logo_url'),
  baseCurrency: varchar('base_currency', { length: 16 }).notNull().default('USD'),
  timezone: varchar('timezone', { length: 128 }).notNull().default('UTC'),
  dateFormat: varchar('date_format', { length: 64 }).notNull().default('YYYY-MM-DD'),
  language: varchar('language', { length: 32 }).notNull().default('en'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Branch Management
export const branches = pgTable('branches', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 256 }).notNull(),
  code: varchar('code', { length: 64 }).notNull(),
  address: text('address'),
  phone: varchar('phone', { length: 64 }),
  email: varchar('email', { length: 256 }),
  status: varchar('status', { length: 32 }).notNull().default('active'), // 'active', 'inactive'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Warehouse Management
export const warehouses = pgTable('warehouses', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: uuid('branch_id').notNull().references(() => branches.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 256 }).notNull(),
  code: varchar('code', { length: 64 }).notNull(),
  address: text('address'),
  status: varchar('status', { length: 32 }).notNull().default('active'), // 'active', 'inactive'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Departments
export const departments = pgTable('departments', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 256 }).notNull(),
  code: varchar('code', { length: 64 }).notNull(),
  managerName: varchar('manager_name', { length: 256 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Positions
export const positions = pgTable('positions', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 256 }).notNull(),
  departmentId: uuid('department_id').notNull().references(() => departments.id, { onDelete: 'cascade' }),
  grade: varchar('grade', { length: 64 }),
  salaryRange: varchar('salary_range', { length: 128 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Employee profiles
export const employees = pgTable('employees', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: varchar('employee_id', { length: 64 }).notNull(), // Code e.g. EMP-001
  firstName: varchar('first_name', { length: 128 }).notNull(),
  lastName: varchar('last_name', { length: 128 }).notNull(),
  email: varchar('email', { length: 256 }).notNull(),
  phone: varchar('phone', { length: 64 }),
  departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'set null' }),
  positionId: uuid('position_id').references(() => positions.id, { onDelete: 'set null' }),
  hireDate: varchar('hire_date', { length: 64 }),
  status: varchar('status', { length: 32 }).notNull().default('active'), // 'active', 'terminated', 'suspended'
  salary: varchar('salary', { length: 64 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// User Invitations
export const userInvitations = pgTable('user_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 256 }).notNull(),
  name: varchar('name', { length: 256 }).notNull(),
  role: varchar('role', { length: 64 }).notNull().default('member'), // 'admin', 'member'
  status: varchar('status', { length: 32 }).notNull().default('pending'), // 'pending', 'accepted', 'expired'
  token: varchar('token', { length: 256 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Currency Management
export const currencies = pgTable('currencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 16 }).notNull(), // USD, EUR
  name: varchar('name', { length: 128 }).notNull(),
  symbol: varchar('symbol', { length: 16 }).notNull(),
  exchangeRate: varchar('exchange_rate', { length: 64 }).notNull().default('1.0'), // Rate against base currency
  isBase: boolean('is_base').notNull().default(false),
  status: varchar('status', { length: 32 }).notNull().default('active'), // 'active', 'inactive'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Tax Configurations
export const taxConfigurations = pgTable('tax_configurations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 256 }).notNull(), // VAT, GST, Sales Tax
  rate: varchar('rate', { length: 64 }).notNull(), // percentage e.g. "15.0"
  code: varchar('code', { length: 64 }),
  description: text('description'),
  status: varchar('status', { length: 32 }).notNull().default('active'), // 'active', 'inactive'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Numbering System / Custom sequences
export const numberSequences = pgTable('number_sequences', {
  id: uuid('id').primaryKey().defaultRandom(),
  module: varchar('module', { length: 128 }).notNull(), // 'employee', 'branch', 'warehouse', 'invitation'
  prefix: varchar('prefix', { length: 64 }).notNull(), // e.g. EMP-, BR-, WH-
  nextNumber: integer('next_number').notNull().default(1),
  digits: integer('digits').notNull().default(4), // e.g. 4 -> EMP-0001
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// File Storage Metadata
export const files = pgTable('files', {
  id: uuid('id').primaryKey().defaultRandom(),
  filename: varchar('filename', { length: 256 }).notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: varchar('mime_type', { length: 128 }).notNull(),
  url: text('url').notNull(),
  uploadedBy: uuid('uploaded_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Activity / Audit Logs
export const activityLogs = pgTable('activity_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id'),
  userName: varchar('user_name', { length: 256 }),
  action: varchar('action', { length: 128 }).notNull(), // e.g. 'CREATE_BRANCH'
  module: varchar('module', { length: 128 }).notNull(), // e.g. 'Branch'
  details: text('details'),
  ipAddress: varchar('ip_address', { length: 64 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Notifications
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 256 }).notNull(),
  message: text('message').notNull(),
  type: varchar('type', { length: 32 }).notNull().default('info'), // 'info', 'warning', 'success', 'error'
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ----------------------------------------------------
// 3. INVENTORY & PRODUCT MANAGEMENT MODULE
// ----------------------------------------------------

// Product Categories
export const productCategories = pgTable('product_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 256 }).notNull(),
  code: varchar('code', { length: 64 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Brands
export const brands = pgTable('brands', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 256 }).notNull(),
  code: varchar('code', { length: 64 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Units of Measure (UoM)
export const unitsOfMeasure = pgTable('units_of_measure', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 256 }).notNull(),
  code: varchar('code', { length: 64 }).notNull(), // e.g., 'PCS', 'KG', 'BOX'
  type: varchar('type', { length: 64 }).notNull().default('count'), // 'weight', 'volume', 'count', 'length'
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Products
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  categoryId: uuid('category_id').references(() => productCategories.id, { onDelete: 'set null' }),
  brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'set null' }),
  uomId: uuid('uom_id').references(() => unitsOfMeasure.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 256 }).notNull(),
  code: varchar('code', { length: 128 }).notNull(),
  sku: varchar('sku', { length: 128 }).notNull(),
  description: text('description'),
  barcode: varchar('barcode', { length: 128 }),
  qrCode: varchar('qr_code', { length: 512 }),
  status: varchar('status', { length: 32 }).notNull().default('active'), // 'active', 'inactive', 'draft'
  lowStockThreshold: integer('low_stock_threshold').notNull().default(10),
  alertEnabled: boolean('alert_enabled').notNull().default(true),
  costPrice: varchar('cost_price', { length: 64 }).notNull().default('0.00'),
  sellingPrice: varchar('selling_price', { length: 64 }).notNull().default('0.00'),
  trackingType: varchar('tracking_type', { length: 32 }).notNull().default('none'), // 'serial', 'batch', 'none'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Product Variants
export const productVariants = pgTable('product_variants', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 256 }).notNull(), // e.g. "Size: L, Color: Red"
  sku: varchar('sku', { length: 128 }).notNull(),
  barcode: varchar('barcode', { length: 128 }),
  costPrice: varchar('cost_price', { length: 64 }).notNull().default('0.00'),
  sellingPrice: varchar('selling_price', { length: 64 }).notNull().default('0.00'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Stock Locations (Zones / Aisles / Shelves / Bins within a Warehouse)
export const stockLocations = pgTable('stock_locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  warehouseId: uuid('warehouse_id').notNull().references(() => warehouses.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 256 }).notNull(),
  code: varchar('code', { length: 64 }).notNull(), // e.g. 'A-01-B2'
  zone: varchar('zone', { length: 64 }),
  aisle: varchar('aisle', { length: 64 }),
  shelf: varchar('shelf', { length: 64 }),
  bin: varchar('bin', { length: 64 }),
  status: varchar('status', { length: 32 }).notNull().default('active'), // 'active', 'inactive'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Inventory Items (Representing physical on-hand stocks in a location with optional Batch/Serial info)
export const inventoryItems = pgTable('inventory_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'cascade' }),
  warehouseId: uuid('warehouse_id').notNull().references(() => warehouses.id, { onDelete: 'cascade' }),
  locationId: uuid('location_id').references(() => stockLocations.id, { onDelete: 'set null' }),
  quantity: integer('quantity').notNull().default(0),
  batchNumber: varchar('batch_number', { length: 128 }),
  serialNumber: varchar('serial_number', { length: 128 }),
  expirationDate: timestamp('expiration_date'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Stock Movements (IN, OUT, Transfer, Adjustment, Purchase receiving)
export const stockMovements = pgTable('stock_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: varchar('type', { length: 32 }).notNull(), // 'IN', 'OUT', 'TRANSFER', 'ADJUSTMENT'
  sourceWarehouseId: uuid('source_warehouse_id').references(() => warehouses.id, { onDelete: 'set null' }),
  sourceLocationId: uuid('source_location_id').references(() => stockLocations.id, { onDelete: 'set null' }),
  destWarehouseId: uuid('dest_warehouse_id').references(() => warehouses.id, { onDelete: 'set null' }),
  destLocationId: uuid('dest_location_id').references(() => stockLocations.id, { onDelete: 'set null' }),
  referenceNumber: varchar('reference_number', { length: 128 }).notNull(), // Sequence generated: e.g. TRF-0001
  notes: text('notes'),
  performedBy: uuid('performed_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Stock Movement Items
export const stockMovementItems = pgTable('stock_movement_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  movementId: uuid('movement_id').notNull().references(() => stockMovements.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').notNull(),
  unitCost: varchar('unit_cost', { length: 64 }).notNull().default('0.00'),
  batchNumber: varchar('batch_number', { length: 128 }),
  serialNumber: varchar('serial_number', { length: 128 }),
});

// ----------------------------------------------------
// 5. SALES & CRM SCHEMAS
// ----------------------------------------------------

// CRM Companies (Accounts)
export const crmCompanies = pgTable('crm_companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 256 }).notNull(),
  industry: varchar('industry', { length: 128 }),
  website: varchar('website', { length: 256 }),
  phone: varchar('phone', { length: 64 }),
  email: varchar('email', { length: 256 }),
  address: text('address'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// CRM Contacts
export const crmContacts = pgTable('crm_contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').references(() => crmCompanies.id, { onDelete: 'set null' }),
  firstName: varchar('first_name', { length: 128 }).notNull(),
  lastName: varchar('last_name', { length: 128 }).notNull(),
  email: varchar('email', { length: 256 }),
  phone: varchar('phone', { length: 64 }),
  jobTitle: varchar('job_title', { length: 128 }),
  status: varchar('status', { length: 32 }).notNull().default('active'), // 'active', 'inactive'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// CRM Leads
export const crmLeads = pgTable('crm_leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 256 }).notNull(),
  source: varchar('source', { length: 128 }), // 'website', 'referral', 'cold_call', etc.
  status: varchar('status', { length: 32 }).notNull().default('new'), // 'new', 'contacted', 'qualified', 'unqualified'
  value: varchar('value', { length: 64 }).default('0.00'),
  notes: text('notes'),
  companyId: uuid('company_id').references(() => crmCompanies.id, { onDelete: 'set null' }),
  contactId: uuid('contact_id').references(() => crmContacts.id, { onDelete: 'set null' }),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// CRM Opportunities
export const crmOpportunities = pgTable('crm_opportunities', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 256 }).notNull(),
  companyId: uuid('company_id').references(() => crmCompanies.id, { onDelete: 'set null' }),
  contactId: uuid('contact_id').references(() => crmContacts.id, { onDelete: 'set null' }),
  leadId: uuid('lead_id').references(() => crmLeads.id, { onDelete: 'set null' }),
  stage: varchar('stage', { length: 64 }).notNull().default('qualification'), // 'qualification', 'proposal', 'negotiation', 'won', 'lost'
  value: varchar('value', { length: 64 }).notNull().default('0.00'),
  probability: integer('probability').notNull().default(10), // e.g., percentage 10-100
  expectedCloseDate: varchar('expected_close_date', { length: 64 }),
  notes: text('notes'),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// CRM Activities & Timelines (Tasks, Notes, Email logs, Call records, Calendar entries)
export const crmActivities = pgTable('crm_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: varchar('entity_type', { length: 64 }).notNull(), // 'lead', 'opportunity', 'company', 'contact'
  entityId: uuid('entity_id').notNull(),
  type: varchar('type', { length: 64 }).notNull(), // 'note', 'email', 'call', 'meeting', 'task'
  title: varchar('title', { length: 256 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 32 }).notNull().default('completed'), // 'planned', 'completed'
  dueDate: varchar('due_date', { length: 64 }),
  assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Sales Orders (Handles Quotations & Confirmed Sales Orders)
export const salesOrders = pgTable('sales_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderNumber: varchar('order_number', { length: 128 }).notNull(), // e.g. SO-0001, QT-0001
  type: varchar('type', { length: 32 }).notNull().default('quotation'), // 'quotation', 'sales_order'
  companyId: uuid('company_id').references(() => crmCompanies.id, { onDelete: 'set null' }),
  contactId: uuid('contact_id').references(() => crmContacts.id, { onDelete: 'set null' }),
  orderDate: varchar('order_date', { length: 64 }).notNull(),
  expirationDate: varchar('expiration_date', { length: 64 }),
  status: varchar('status', { length: 32 }).notNull().default('draft'), // 'draft', 'sent', 'confirmed', 'delivered', 'invoiced', 'cancelled'
  totalAmount: varchar('total_amount', { length: 64 }).notNull().default('0.00'),
  taxAmount: varchar('tax_amount', { length: 64 }).notNull().default('0.00'),
  discountAmount: varchar('discount_amount', { length: 64 }).notNull().default('0.00'),
  currency: varchar('currency', { length: 16 }).notNull().default('USD'),
  paymentTerms: varchar('payment_terms', { length: 128 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Sales Order Items (Products attached to Quotes/Orders)
export const salesOrderItems = pgTable('sales_order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  salesOrderId: uuid('sales_order_id').notNull().references(() => salesOrders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
  quantity: integer('quantity').notNull().default(1),
  unitPrice: varchar('unit_price', { length: 64 }).notNull().default('0.00'),
  discountAmount: varchar('discount_amount', { length: 64 }).notNull().default('0.00'),
  taxAmount: varchar('tax_amount', { length: 64 }).notNull().default('0.00'),
  totalAmount: varchar('total_amount', { length: 64 }).notNull().default('0.00'),
});

// Delivery Orders (Logistics / Shipments)
export const deliveryOrders = pgTable('delivery_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  deliveryNumber: varchar('delivery_number', { length: 128 }).notNull(), // Sequence e.g. DO-0001
  salesOrderId: uuid('sales_order_id').notNull().references(() => salesOrders.id, { onDelete: 'cascade' }),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 32 }).notNull().default('pending'), // 'pending', 'shipped', 'delivered', 'cancelled'
  shippedDate: varchar('shipped_date', { length: 64 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Delivery Order Items
export const deliveryOrderItems = pgTable('delivery_order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  deliveryOrderId: uuid('delivery_order_id').notNull().references(() => deliveryOrders.id, { onDelete: 'cascade' }),
  salesOrderItemId: uuid('sales_order_item_id').notNull().references(() => salesOrderItems.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  quantityShipped: integer('quantity_shipped').notNull().default(0),
});

// Invoices (Finance preparation / tracking)
export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceNumber: varchar('invoice_number', { length: 128 }).notNull(), // Sequence e.g. INV-0001
  salesOrderId: uuid('sales_order_id').notNull().references(() => salesOrders.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 32 }).notNull().default('draft'), // 'draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled'
  issueDate: varchar('issue_date', { length: 64 }).notNull(),
  dueDate: varchar('due_date', { length: 64 }),
  totalAmount: varchar('total_amount', { length: 64 }).notNull().default('0.00'),
  taxAmount: varchar('tax_amount', { length: 64 }).notNull().default('0.00'),
  discountAmount: varchar('discount_amount', { length: 64 }).notNull().default('0.00'),
  currency: varchar('currency', { length: 16 }).notNull().default('USD'),
  paymentTerms: varchar('payment_terms', { length: 128 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Invoice Items
export const invoiceItems = pgTable('invoice_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  salesOrderItemId: uuid('sales_order_item_id').notNull().references(() => salesOrderItems.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').notNull().default(1),
  unitPrice: varchar('unit_price', { length: 64 }).notNull().default('0.00'),
  discountAmount: varchar('discount_amount', { length: 64 }).notNull().default('0.00'),
  taxAmount: varchar('tax_amount', { length: 64 }).notNull().default('0.00'),
  totalAmount: varchar('total_amount', { length: 64 }).notNull().default('0.00'),
});
