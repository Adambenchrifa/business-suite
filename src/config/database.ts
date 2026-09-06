import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { newDb, DataType } from 'pg-mem';
import crypto from 'crypto';
import { env } from './env';
import { Logger } from '../shared/utils/logger';
import { InternalServerError } from '../shared/utils/errors';

const logger = new Logger('DatabaseConfiguration');

function createInMemoryPgPool(): pg.Pool {
  const mem = newDb();
  mem.public.registerFunction({
    name: 'gen_random_uuid',
    returns: DataType.uuid,
    implementation: () => crypto.randomUUID(),
  });
  const adapter = mem.adapters.createPg();
  return new adapter.Pool() as unknown as pg.Pool;
}

let activePoolPromise: Promise<pg.Pool> | null = null;
let isUsingInMemory = false;

async function ensureActivePool(): Promise<pg.Pool> {
  if (!activePoolPromise) {
    activePoolPromise = (async () => {
      const realPool = new pg.Pool({
        connectionString: env.DATABASE_URL,
        connectionTimeoutMillis: 500,
      });

      try {
        const client = await realPool.connect();
        client.release();
        logger.info(`Successfully connected to PostgreSQL database at ${env.DATABASE_URL}`);
        await initializePublicDatabase(realPool);
        return realPool;
      } catch (err) {
        logger.warn(`Could not connect to live PostgreSQL server at ${env.DATABASE_URL}. Utilizing in-memory PostgreSQL pool for execution: ${(err as Error).message}`);
        await realPool.end().catch(() => {});
        isUsingInMemory = true;
        const memPool = createInMemoryPgPool();
        await initializePublicDatabase(memPool);
        return memPool;
      }
    })();
  }
  return activePoolPromise;
}

// Proxy Pool object that ensures active database pool is initialized before any connection or query
export const pool = new Proxy({} as pg.Pool, {
  get(target, prop, receiver) {
    if (prop === 'connect') {
      return async () => {
        const active = await ensureActivePool();
        return await active.connect();
      };
    }
    if (prop === 'query') {
      return async (...args: any[]) => {
        const active = await ensureActivePool();
        return await (active.query as any)(...args);
      };
    }
    return async (...args: any[]) => {
      const active = await ensureActivePool();
      const val = Reflect.get(active, prop, receiver);
      return typeof val === 'function' ? val.bind(active)(...args) : val;
    };
  },
});

export const publicDb = drizzle(pool);

const initializedPools = new WeakSet<object>();

export async function initializePublicDatabase(p: pg.Pool) {
  if (initializedPools.has(p)) return;
  initializedPools.add(p);

  const client = await p.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id text UNIQUE,
        domain text,
        name text,
        schema text,
        status text,
        created_at timestamp,
        updated_at timestamp
      )
    `);

    // Seed default demo tenant if empty
    const { rows } = await client.query('SELECT id FROM tenants WHERE domain = $1', ['demo']);
    if (rows.length === 0) {
      const now = new Date().toISOString();
      await client.query(`
        INSERT INTO tenants (id, domain, name, schema, status, created_at, updated_at)
        VALUES ('d9b3a328-912f-48d8-913a-7dbda2c64b7c', 'demo', 'Demo Workspace', 'tenant_demo', 'active', '${now}', '${now}')
      `);
      await ensureTenantTables('tenant_demo', p);
      await client.query(`
        INSERT INTO tenant_demo.users (id, email, password_hash, name, role, status, is_verified, created_at, updated_at)
        VALUES (
          'a87a2d4b-76f5-4428-a40d-d42187cf92f8',
          'demo@apps.com',
          '900b9247cc9f688bf992e5914620b720:073f1146747dfcb60da54a4f8cfc3b03697e37920fca9e144a1068bd8fa32c70da0cb4e99f0f97061d335607b3149fc9cb907fc2f5ae12f0e60803c00445d448',
          'Demo Administrator',
          'owner',
          'active',
          true,
          '${now}',
          '${now}'
        )
      `);
    }
  } catch (err) {
    logger.error('Failed to initialize public database tables', err);
  } finally {
    client.release();
  }
}

const createdTenantSchemas = new Set<string>();

export async function ensureTenantTables(schemaName: string, p: pg.Pool = pool) {
  const sanitizedSchema = schemaName.replace(/[^a-zA-Z0-9_]/g, '');
  const key = `${isUsingInMemory ? 'mem' : 'real'}:${sanitizedSchema}`;
  if (createdTenantSchemas.has(key)) {
    return;
  }
  createdTenantSchemas.add(key);

  const client = await p.connect();
  try {
    const s = sanitizedSchema;
    const statements = [
      `CREATE SCHEMA IF NOT EXISTS ${s}`,
      `CREATE TABLE IF NOT EXISTS ${s}.users (id text UNIQUE, email text, password_hash text, name text, role text, status text, is_verified boolean, verification_token text, reset_token text, reset_token_expires_at timestamp, created_at timestamp, updated_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.sessions (id text UNIQUE, user_id text REFERENCES ${s}.users(id) ON DELETE CASCADE, token text, expires_at timestamp, created_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.organizations (id text UNIQUE, name text, tax_id text, email text, phone text, website text, address text, logo_url text, base_currency text, timezone text, date_format text, language text, created_at timestamp, updated_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.branches (id text UNIQUE, name text, code text, address text, phone text, email text, status text, created_at timestamp, updated_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.warehouses (id text UNIQUE, branch_id text REFERENCES ${s}.branches(id) ON DELETE CASCADE, name text, code text, address text, status text, created_at timestamp, updated_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.departments (id text UNIQUE, name text, code text, manager_name text, created_at timestamp, updated_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.positions (id text UNIQUE, title text, department_id text REFERENCES ${s}.departments(id) ON DELETE CASCADE, grade text, salary_range text, created_at timestamp, updated_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.employees (id text UNIQUE, employee_id text, first_name text, last_name text, email text, phone text, department_id text REFERENCES ${s}.departments(id) ON DELETE SET NULL, position_id text REFERENCES ${s}.positions(id) ON DELETE SET NULL, hire_date text, status text, salary text, created_at timestamp, updated_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.user_invitations (id text UNIQUE, email text, name text, role text, status text, token text, expires_at timestamp, created_at timestamp, updated_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.currencies (id text UNIQUE, code text, name text, symbol text, exchange_rate text, is_base boolean, status text, created_at timestamp, updated_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.tax_configurations (id text UNIQUE, name text, rate text, code text, description text, status text, created_at timestamp, updated_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.number_sequences (id text UNIQUE, module text, prefix text, next_number integer, digits integer, created_at timestamp, updated_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.files (id text UNIQUE, filename text, file_size integer, mime_type text, url text, uploaded_by text, created_at timestamp, updated_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.activity_logs (id text UNIQUE, user_id text, user_name text, action text, module text, details text, ip_address text, created_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.notifications (id text UNIQUE, user_id text REFERENCES ${s}.users(id) ON DELETE CASCADE, title text, message text, type text, is_read boolean, created_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.product_categories (id text UNIQUE, name text, code text, description text, created_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.brands (id text UNIQUE, name text, code text, description text, created_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.units_of_measure (id text UNIQUE, name text, code text, type text, created_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.products (id text UNIQUE, category_id text REFERENCES ${s}.product_categories(id) ON DELETE SET NULL, brand_id text REFERENCES ${s}.brands(id) ON DELETE SET NULL, uom_id text REFERENCES ${s}.units_of_measure(id) ON DELETE SET NULL, name text, code text, sku text, description text, barcode text, qr_code text, status text, low_stock_threshold integer, alert_enabled boolean, cost_price text, selling_price text, tracking_type text, created_at timestamp, updated_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.product_variants (id text UNIQUE, product_id text REFERENCES ${s}.products(id) ON DELETE CASCADE, name text, sku text, barcode text, cost_price text, selling_price text, created_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.stock_locations (id text UNIQUE, warehouse_id text REFERENCES ${s}.warehouses(id) ON DELETE CASCADE, name text, code text, zone text, aisle text, shelf text, bin text, status text, created_at timestamp, updated_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.inventory_items (id text UNIQUE, product_id text REFERENCES ${s}.products(id) ON DELETE CASCADE, variant_id text REFERENCES ${s}.product_variants(id) ON DELETE CASCADE, warehouse_id text REFERENCES ${s}.warehouses(id) ON DELETE CASCADE, location_id text REFERENCES ${s}.stock_locations(id) ON DELETE SET NULL, quantity integer, batch_number text, serial_number text, expiration_date timestamp, created_at timestamp, updated_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.stock_movements (id text UNIQUE, type text, source_warehouse_id text REFERENCES ${s}.warehouses(id) ON DELETE SET NULL, source_location_id text REFERENCES ${s}.stock_locations(id) ON DELETE SET NULL, dest_warehouse_id text REFERENCES ${s}.warehouses(id) ON DELETE SET NULL, dest_location_id text REFERENCES ${s}.stock_locations(id) ON DELETE SET NULL, reference_number text, notes text, performed_by text REFERENCES ${s}.users(id) ON DELETE SET NULL, created_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.stock_movement_items (id text UNIQUE, movement_id text REFERENCES ${s}.stock_movements(id) ON DELETE CASCADE, product_id text REFERENCES ${s}.products(id) ON DELETE CASCADE, variant_id text REFERENCES ${s}.product_variants(id) ON DELETE CASCADE, quantity integer, unit_cost text, batch_number text, serial_number text)`,
      `CREATE TABLE IF NOT EXISTS ${s}.crm_companies (id text UNIQUE, name text, industry text, website text, phone text, email text, address text, created_at timestamp, updated_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.crm_contacts (id text UNIQUE, company_id text REFERENCES ${s}.crm_companies(id) ON DELETE SET NULL, first_name text, last_name text, email text, phone text, job_title text, status text, created_at timestamp, updated_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.crm_leads (id text UNIQUE, title text, source text, status text, value text, notes text, company_id text REFERENCES ${s}.crm_companies(id) ON DELETE SET NULL, contact_id text REFERENCES ${s}.crm_contacts(id) ON DELETE SET NULL, assigned_to text REFERENCES ${s}.users(id) ON DELETE SET NULL, created_at timestamp, updated_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.crm_opportunities (id text UNIQUE, title text, company_id text REFERENCES ${s}.crm_companies(id) ON DELETE SET NULL, contact_id text REFERENCES ${s}.crm_contacts(id) ON DELETE SET NULL, lead_id text REFERENCES ${s}.crm_leads(id) ON DELETE SET NULL, stage text, value text, probability integer, expected_close_date text, notes text, assigned_to text REFERENCES ${s}.users(id) ON DELETE SET NULL, created_at timestamp, updated_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.crm_activities (id text UNIQUE, entity_type text, entity_id text, type text, title text, description text, status text, due_date text, assigned_to text REFERENCES ${s}.users(id) ON DELETE SET NULL, created_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.sales_orders (id text UNIQUE, order_number text, type text, company_id text REFERENCES ${s}.crm_companies(id) ON DELETE SET NULL, contact_id text REFERENCES ${s}.crm_contacts(id) ON DELETE SET NULL, order_date text, expiration_date text, status text, total_amount text, tax_amount text, discount_amount text, currency text, payment_terms text, notes text, created_at timestamp, updated_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.sales_order_items (id text UNIQUE, sales_order_id text REFERENCES ${s}.sales_orders(id) ON DELETE CASCADE, product_id text REFERENCES ${s}.products(id) ON DELETE CASCADE, variant_id text REFERENCES ${s}.product_variants(id) ON DELETE SET NULL, quantity integer, unit_price text, discount_amount text, tax_amount text, total_amount text)`,
      `CREATE TABLE IF NOT EXISTS ${s}.delivery_orders (id text UNIQUE, delivery_number text, sales_order_id text REFERENCES ${s}.sales_orders(id) ON DELETE CASCADE, warehouse_id text REFERENCES ${s}.warehouses(id) ON DELETE SET NULL, status text, shipped_date text, notes text, created_at timestamp, updated_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.delivery_order_items (id text UNIQUE, delivery_order_id text REFERENCES ${s}.delivery_orders(id) ON DELETE CASCADE, sales_order_item_id text REFERENCES ${s}.sales_order_items(id) ON DELETE CASCADE, product_id text REFERENCES ${s}.products(id) ON DELETE CASCADE, quantity_shipped integer)`,
      `CREATE TABLE IF NOT EXISTS ${s}.invoices (id text UNIQUE, invoice_number text, sales_order_id text REFERENCES ${s}.sales_orders(id) ON DELETE CASCADE, status text, issue_date text, due_date text, total_amount text, tax_amount text, discount_amount text, currency text, payment_terms text, created_at timestamp, updated_at timestamp)`,
      `CREATE TABLE IF NOT EXISTS ${s}.invoice_items (id text UNIQUE, invoice_id text REFERENCES ${s}.invoices(id) ON DELETE CASCADE, sales_order_item_id text REFERENCES ${s}.sales_order_items(id) ON DELETE CASCADE, product_id text REFERENCES ${s}.products(id) ON DELETE CASCADE, quantity integer, unit_price text, discount_amount text, tax_amount text, total_amount text)`
    ];

    for (const stmt of statements) {
      await client.query(stmt);
    }
  } catch (err) {
    logger.error(`Failed to ensure tenant tables for schema [${sanitizedSchema}]`, err);
  } finally {
    client.release();
  }
}

export async function getTenantDrizzleClient(schema: string) {
  try {
    const sanitizedSchema = schema.replace(/[^a-zA-Z0-9_]/g, '');
    const active = await ensureActivePool();
    await ensureTenantTables(sanitizedSchema, active);

    const client = await active.connect();
    await client.query(`SET search_path TO "${sanitizedSchema}", public`);

    const db = drizzle(client);

    return {
      db,
      release: () => {
        client.release();
      },
    };
  } catch (error) {
    logger.error(`Failed to checkout database connection for tenant schema [${schema}]`, error);
    throw new InternalServerError('Database connection check-out failure');
  }
}
