import { pool } from '../../../config/database';
import { Logger } from '../../../shared/utils/logger';

const logger = new Logger('TenantProvisioner');
const verifiedSchemas = new Set<string>();

export async function ensureTenantSchema(schemaName: string, force = false): Promise<void> {
  const sanitizedSchema = schemaName.replace(/[^a-zA-Z0-9_]/g, '');
  if (!force && verifiedSchemas.has(sanitizedSchema)) {
    return;
  }

  logger.info(`Ensuring complete ERP schema in tenant PostgreSQL schema [${sanitizedSchema}]`);

  const client = await pool.connect();
  try {
    // 1. Create Schema
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${sanitizedSchema}";`);

    // 2. Execute DDL statements for all tenant tables in strict dependency order

    // 1) users
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar(256) NOT NULL UNIQUE,
        "password_hash" text NOT NULL,
        "name" varchar(256) NOT NULL,
        "role" varchar(64) NOT NULL DEFAULT 'member',
        "status" varchar(32) NOT NULL DEFAULT 'active',
        "is_verified" boolean NOT NULL DEFAULT false,
        "verification_token" varchar(256),
        "reset_token" varchar(256),
        "reset_token_expires_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 2) sessions
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "${sanitizedSchema}"."users"("id") ON DELETE CASCADE,
        "token" varchar(512) NOT NULL UNIQUE,
        "expires_at" timestamp NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 3) organizations
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."organizations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(256) NOT NULL,
        "tax_id" varchar(128),
        "email" varchar(256),
        "phone" varchar(64),
        "website" varchar(256),
        "address" text,
        "logo_url" text,
        "base_currency" varchar(16) NOT NULL DEFAULT 'USD',
        "timezone" varchar(128) NOT NULL DEFAULT 'UTC',
        "date_format" varchar(64) NOT NULL DEFAULT 'YYYY-MM-DD',
        "language" varchar(32) NOT NULL DEFAULT 'en',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 4) branches
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."branches" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(256) NOT NULL,
        "code" varchar(64) NOT NULL,
        "address" text,
        "phone" varchar(64),
        "email" varchar(256),
        "status" varchar(32) NOT NULL DEFAULT 'active',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 5) warehouses
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."warehouses" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "branch_id" uuid NOT NULL REFERENCES "${sanitizedSchema}"."branches"("id") ON DELETE CASCADE,
        "name" varchar(256) NOT NULL,
        "code" varchar(64) NOT NULL,
        "address" text,
        "status" varchar(32) NOT NULL DEFAULT 'active',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 6) departments
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."departments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(256) NOT NULL,
        "code" varchar(64) NOT NULL,
        "manager_name" varchar(256),
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 7) positions
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."positions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" varchar(256) NOT NULL,
        "department_id" uuid NOT NULL REFERENCES "${sanitizedSchema}"."departments"("id") ON DELETE CASCADE,
        "grade" varchar(64),
        "salary_range" varchar(128),
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 8) employees
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."employees" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "employee_id" varchar(64) NOT NULL,
        "first_name" varchar(128) NOT NULL,
        "last_name" varchar(128) NOT NULL,
        "email" varchar(256) NOT NULL,
        "phone" varchar(64),
        "department_id" uuid REFERENCES "${sanitizedSchema}"."departments"("id") ON DELETE SET NULL,
        "position_id" uuid REFERENCES "${sanitizedSchema}"."positions"("id") ON DELETE SET NULL,
        "hire_date" varchar(64),
        "status" varchar(32) NOT NULL DEFAULT 'active',
        "salary" varchar(64),
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 9) user_invitations
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."user_invitations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" varchar(256) NOT NULL,
        "name" varchar(256) NOT NULL,
        "role" varchar(64) NOT NULL DEFAULT 'member',
        "status" varchar(32) NOT NULL DEFAULT 'pending',
        "token" varchar(256) NOT NULL,
        "expires_at" timestamp NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 10) currencies
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."currencies" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "code" varchar(16) NOT NULL,
        "name" varchar(128) NOT NULL,
        "symbol" varchar(16) NOT NULL,
        "exchange_rate" varchar(64) NOT NULL DEFAULT '1.0',
        "is_base" boolean NOT NULL DEFAULT false,
        "status" varchar(32) NOT NULL DEFAULT 'active',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 11) tax_configurations
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."tax_configurations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(256) NOT NULL,
        "rate" varchar(64) NOT NULL,
        "code" varchar(64),
        "description" text,
        "status" varchar(32) NOT NULL DEFAULT 'active',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 12) number_sequences
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."number_sequences" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "module" varchar(128) NOT NULL,
        "prefix" varchar(64) NOT NULL,
        "next_number" integer NOT NULL DEFAULT 1,
        "digits" integer NOT NULL DEFAULT 4,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 13) files
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."files" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "filename" varchar(256) NOT NULL,
        "file_size" integer NOT NULL,
        "mime_type" varchar(128) NOT NULL,
        "url" text NOT NULL,
        "uploaded_by" uuid,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 14) activity_logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."activity_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid,
        "user_name" varchar(256),
        "action" varchar(128) NOT NULL,
        "module" varchar(128) NOT NULL,
        "details" text,
        "ip_address" varchar(64),
        "created_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 15) notifications
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."notifications" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid REFERENCES "${sanitizedSchema}"."users"("id") ON DELETE CASCADE,
        "title" varchar(256) NOT NULL,
        "message" text NOT NULL,
        "type" varchar(32) NOT NULL DEFAULT 'info',
        "is_read" boolean NOT NULL DEFAULT false,
        "created_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 16) product_categories
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."product_categories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(256) NOT NULL,
        "code" varchar(64) NOT NULL,
        "description" text,
        "created_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 17) brands
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."brands" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(256) NOT NULL,
        "code" varchar(64) NOT NULL,
        "description" text,
        "created_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 18) units_of_measure
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."units_of_measure" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(256) NOT NULL,
        "code" varchar(64) NOT NULL,
        "type" varchar(64) NOT NULL DEFAULT 'count',
        "created_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 19) products
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."products" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "category_id" uuid REFERENCES "${sanitizedSchema}"."product_categories"("id") ON DELETE SET NULL,
        "brand_id" uuid REFERENCES "${sanitizedSchema}"."brands"("id") ON DELETE SET NULL,
        "uom_id" uuid REFERENCES "${sanitizedSchema}"."units_of_measure"("id") ON DELETE SET NULL,
        "name" varchar(256) NOT NULL,
        "code" varchar(128) NOT NULL,
        "sku" varchar(128) NOT NULL,
        "description" text,
        "barcode" varchar(128),
        "qr_code" varchar(512),
        "status" varchar(32) NOT NULL DEFAULT 'active',
        "low_stock_threshold" integer NOT NULL DEFAULT 10,
        "alert_enabled" boolean NOT NULL DEFAULT true,
        "cost_price" varchar(64) NOT NULL DEFAULT '0.00',
        "selling_price" varchar(64) NOT NULL DEFAULT '0.00',
        "tracking_type" varchar(32) NOT NULL DEFAULT 'none',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 20) product_variants
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."product_variants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "product_id" uuid NOT NULL REFERENCES "${sanitizedSchema}"."products"("id") ON DELETE CASCADE,
        "name" varchar(256) NOT NULL,
        "sku" varchar(128) NOT NULL,
        "barcode" varchar(128),
        "cost_price" varchar(64) NOT NULL DEFAULT '0.00',
        "selling_price" varchar(64) NOT NULL DEFAULT '0.00',
        "created_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 21) stock_locations
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."stock_locations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "warehouse_id" uuid NOT NULL REFERENCES "${sanitizedSchema}"."warehouses"("id") ON DELETE CASCADE,
        "name" varchar(256) NOT NULL,
        "code" varchar(64) NOT NULL,
        "zone" varchar(64),
        "aisle" varchar(64),
        "shelf" varchar(64),
        "bin" varchar(64),
        "status" varchar(32) NOT NULL DEFAULT 'active',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 22) inventory_items
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."inventory_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "product_id" uuid NOT NULL REFERENCES "${sanitizedSchema}"."products"("id") ON DELETE CASCADE,
        "variant_id" uuid REFERENCES "${sanitizedSchema}"."product_variants"("id") ON DELETE CASCADE,
        "warehouse_id" uuid NOT NULL REFERENCES "${sanitizedSchema}"."warehouses"("id") ON DELETE CASCADE,
        "location_id" uuid REFERENCES "${sanitizedSchema}"."stock_locations"("id") ON DELETE SET NULL,
        "quantity" integer NOT NULL DEFAULT 0,
        "batch_number" varchar(128),
        "serial_number" varchar(128),
        "expiration_date" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 23) stock_movements
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."stock_movements" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "type" varchar(32) NOT NULL,
        "source_warehouse_id" uuid REFERENCES "${sanitizedSchema}"."warehouses"("id") ON DELETE SET NULL,
        "source_location_id" uuid REFERENCES "${sanitizedSchema}"."stock_locations"("id") ON DELETE SET NULL,
        "dest_warehouse_id" uuid REFERENCES "${sanitizedSchema}"."warehouses"("id") ON DELETE SET NULL,
        "dest_location_id" uuid REFERENCES "${sanitizedSchema}"."stock_locations"("id") ON DELETE SET NULL,
        "reference_number" varchar(128) NOT NULL,
        "notes" text,
        "performed_by" uuid REFERENCES "${sanitizedSchema}"."users"("id") ON DELETE SET NULL,
        "created_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 24) stock_movement_items
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."stock_movement_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "movement_id" uuid NOT NULL REFERENCES "${sanitizedSchema}"."stock_movements"("id") ON DELETE CASCADE,
        "product_id" uuid NOT NULL REFERENCES "${sanitizedSchema}"."products"("id") ON DELETE CASCADE,
        "variant_id" uuid REFERENCES "${sanitizedSchema}"."product_variants"("id") ON DELETE CASCADE,
        "quantity" integer NOT NULL,
        "unit_cost" varchar(64) NOT NULL DEFAULT '0.00',
        "batch_number" varchar(128),
        "serial_number" varchar(128)
      );
    `);

    // 25) crm_companies
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."crm_companies" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(256) NOT NULL,
        "industry" varchar(128),
        "website" varchar(256),
        "phone" varchar(64),
        "email" varchar(256),
        "address" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 26) crm_contacts
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."crm_contacts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "company_id" uuid REFERENCES "${sanitizedSchema}"."crm_companies"("id") ON DELETE SET NULL,
        "first_name" varchar(128) NOT NULL,
        "last_name" varchar(128) NOT NULL,
        "email" varchar(256),
        "phone" varchar(64),
        "job_title" varchar(128),
        "status" varchar(32) NOT NULL DEFAULT 'active',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 27) crm_leads
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."crm_leads" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" varchar(256) NOT NULL,
        "source" varchar(128),
        "status" varchar(32) NOT NULL DEFAULT 'new',
        "value" varchar(64) DEFAULT '0.00',
        "notes" text,
        "company_id" uuid REFERENCES "${sanitizedSchema}"."crm_companies"("id") ON DELETE SET NULL,
        "contact_id" uuid REFERENCES "${sanitizedSchema}"."crm_contacts"("id") ON DELETE SET NULL,
        "assigned_to" uuid REFERENCES "${sanitizedSchema}"."users"("id") ON DELETE SET NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 28) crm_opportunities
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."crm_opportunities" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" varchar(256) NOT NULL,
        "company_id" uuid REFERENCES "${sanitizedSchema}"."crm_companies"("id") ON DELETE SET NULL,
        "contact_id" uuid REFERENCES "${sanitizedSchema}"."crm_contacts"("id") ON DELETE SET NULL,
        "lead_id" uuid REFERENCES "${sanitizedSchema}"."crm_leads"("id") ON DELETE SET NULL,
        "stage" varchar(64) NOT NULL DEFAULT 'qualification',
        "value" varchar(64) NOT NULL DEFAULT '0.00',
        "probability" integer NOT NULL DEFAULT 10,
        "expected_close_date" varchar(64),
        "notes" text,
        "assigned_to" uuid REFERENCES "${sanitizedSchema}"."users"("id") ON DELETE SET NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 29) crm_activities
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."crm_activities" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "entity_type" varchar(64) NOT NULL,
        "entity_id" uuid NOT NULL,
        "type" varchar(64) NOT NULL,
        "title" varchar(256) NOT NULL,
        "description" text,
        "status" varchar(32) NOT NULL DEFAULT 'completed',
        "due_date" varchar(64),
        "assigned_to" uuid REFERENCES "${sanitizedSchema}"."users"("id") ON DELETE SET NULL,
        "created_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 30) sales_orders
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."sales_orders" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "order_number" varchar(128) NOT NULL,
        "type" varchar(32) NOT NULL DEFAULT 'quotation',
        "company_id" uuid REFERENCES "${sanitizedSchema}"."crm_companies"("id") ON DELETE SET NULL,
        "contact_id" uuid REFERENCES "${sanitizedSchema}"."crm_contacts"("id") ON DELETE SET NULL,
        "order_date" varchar(64) NOT NULL,
        "expiration_date" varchar(64),
        "status" varchar(32) NOT NULL DEFAULT 'draft',
        "total_amount" varchar(64) NOT NULL DEFAULT '0.00',
        "tax_amount" varchar(64) NOT NULL DEFAULT '0.00',
        "discount_amount" varchar(64) NOT NULL DEFAULT '0.00',
        "currency" varchar(16) NOT NULL DEFAULT 'USD',
        "payment_terms" varchar(128),
        "notes" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 31) sales_order_items
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."sales_order_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "sales_order_id" uuid NOT NULL REFERENCES "${sanitizedSchema}"."sales_orders"("id") ON DELETE CASCADE,
        "product_id" uuid NOT NULL REFERENCES "${sanitizedSchema}"."products"("id") ON DELETE CASCADE,
        "variant_id" uuid REFERENCES "${sanitizedSchema}"."product_variants"("id") ON DELETE SET NULL,
        "quantity" integer NOT NULL DEFAULT 1,
        "unit_price" varchar(64) NOT NULL DEFAULT '0.00',
        "discount_amount" varchar(64) NOT NULL DEFAULT '0.00',
        "tax_amount" varchar(64) NOT NULL DEFAULT '0.00',
        "total_amount" varchar(64) NOT NULL DEFAULT '0.00'
      );
    `);

    // 32) delivery_orders
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."delivery_orders" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "delivery_number" varchar(128) NOT NULL,
        "sales_order_id" uuid NOT NULL REFERENCES "${sanitizedSchema}"."sales_orders"("id") ON DELETE CASCADE,
        "warehouse_id" uuid REFERENCES "${sanitizedSchema}"."warehouses"("id") ON DELETE SET NULL,
        "status" varchar(32) NOT NULL DEFAULT 'pending',
        "shipped_date" varchar(64),
        "notes" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 33) delivery_order_items
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."delivery_order_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "delivery_order_id" uuid NOT NULL REFERENCES "${sanitizedSchema}"."delivery_orders"("id") ON DELETE CASCADE,
        "sales_order_item_id" uuid NOT NULL REFERENCES "${sanitizedSchema}"."sales_order_items"("id") ON DELETE CASCADE,
        "product_id" uuid NOT NULL REFERENCES "${sanitizedSchema}"."products"("id") ON DELETE CASCADE,
        "quantity_shipped" integer NOT NULL DEFAULT 0
      );
    `);

    // 34) invoices
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."invoices" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "invoice_number" varchar(128) NOT NULL,
        "sales_order_id" uuid NOT NULL REFERENCES "${sanitizedSchema}"."sales_orders"("id") ON DELETE CASCADE,
        "status" varchar(32) NOT NULL DEFAULT 'draft',
        "issue_date" varchar(64) NOT NULL,
        "due_date" varchar(64),
        "total_amount" varchar(64) NOT NULL DEFAULT '0.00',
        "tax_amount" varchar(64) NOT NULL DEFAULT '0.00',
        "discount_amount" varchar(64) NOT NULL DEFAULT '0.00',
        "currency" varchar(16) NOT NULL DEFAULT 'USD',
        "payment_terms" varchar(128),
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // 35) invoice_items
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${sanitizedSchema}"."invoice_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "invoice_id" uuid NOT NULL REFERENCES "${sanitizedSchema}"."invoices"("id") ON DELETE CASCADE,
        "sales_order_item_id" uuid NOT NULL REFERENCES "${sanitizedSchema}"."sales_order_items"("id") ON DELETE CASCADE,
        "product_id" uuid NOT NULL REFERENCES "${sanitizedSchema}"."products"("id") ON DELETE CASCADE,
        "quantity" integer NOT NULL DEFAULT 1,
        "unit_price" varchar(64) NOT NULL DEFAULT '0.00',
        "discount_amount" varchar(64) NOT NULL DEFAULT '0.00',
        "tax_amount" varchar(64) NOT NULL DEFAULT '0.00',
        "total_amount" varchar(64) NOT NULL DEFAULT '0.00'
      );
    `);

    verifiedSchemas.add(sanitizedSchema);
    logger.info(`Successfully verified/provisioned complete ERP schema in [${sanitizedSchema}]`);
  } catch (error) {
    logger.error(`Failed to provision ERP schema for tenant [${sanitizedSchema}]`, error);
    throw error;
  } finally {
    client.release();
  }
}
