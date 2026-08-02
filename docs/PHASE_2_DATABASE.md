# Business Suite: Complete Database Design & Architecture Blueprint
*Document Classification: Technical Specification*  
*Target System: PostgreSQL 17 + pgvector + Drizzle ORM*

---

## 1. Multi-Tenant Strategy

We employ a hybrid tenant partitioning model to balance cost efficiency, security boundaries, and high-tier enterprise SLAs.

```
                  ┌─────────────────────────────────────────┐
                  │          Global Tenant Routing          │
                  └────────────────────┬────────────────────┘
                                       │
         ┌─────────────────────────────┴─────────────────────────────┐
         ▼                                                           ▼
┌─────────────────────────────────┐                         ┌─────────────────────────────────┐
│     Standard/Pro Tenants        │                         │        Enterprise Tenants       │
│  - Shared Database Cluster      │                         │  - Dedicated Database Instances │
│  - Logical Schema Separation    │                         │  - Complete Physical Isolation  │
│  - Schema: tenant_{id}          │                         │  - Separate Compute/Memory      │
└─────────────────────────────────┘                         └─────────────────────────────────┘
```

### 1.1 Tenant Isolation Levels
*   **Tier 1 (Standard/Pro): Shared Database, Isolated Schemas.** Tenants share a PostgreSQL cluster but reside in strictly separate schemas (e.g., `tenant_acme_prod`, `tenant_globex_prod`). The active schema is set dynamically per request via connection search path initialization (`SET search_path TO tenant_xyz`).
*   **Tier 2 (Enterprise): Database-per-Tenant.** High-compliance clients receive dedicated, physically isolated database instances. Routing is managed at the API Gateway level via dynamic connection string lookups.

### 1.2 Routing Mechanics
The routing of connections utilizes a highly optimized central catalog database called the **Global Registry**:
*   The registry runs on a globally replicated database (`global_registry`).
*   It stores metadata for every tenant including status, subscription tier, and primary DB host credentials.
*   The API gateway and connection pools cache these routes in Redis with an eviction TTL of 5 minutes.

---

## 2. Entity Relationship Diagram (Conceptual Layout)

```
┌─────────────────┐             ┌─────────────────┐             ┌─────────────────┐
│     Tenants     │1 ─── 1..*   │      Users      │1 ─── 1..*   │   User_Roles    │
├─────────────────┤             ├─────────────────┤             ├─────────────────┤
│ tenant_id (PK)  │             │ user_id (PK)    │             │ role_id (PK)    │
│ name            │             │ email           │             │ tenant_id (FK)  │
│ plan            │             │ password_hash   │             │ user_id (FK)    │
└────────┬────────┘             └────────┬────────┘             └─────────────────┘
         │                               │
         │1                              │1
         │                               │
         ▼ 1..*                          ▼ 1..*
┌─────────────────┐             ┌─────────────────┐
│     Modules     │             │   Audit_Logs    │
├─────────────────┤             ├─────────────────┤
│ module_id (PK)  │             │ log_id (PK)     │
│ name            │             │ user_id (FK)    │
│ enabled         │             │ action          │
└─────────────────┘             └─────────────────┘
```

---

## 3. Database Schema Definitions (Standard Drizzle Dialect)

All tables are defined inside the target tenant namespace context (`tenant_id` used for logical validation).

### 3.1 Platform Administration & Core Organization

```sql
-- Global Registry (Resides strictly in the public schema of the Global Database)
CREATE TABLE public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) UNIQUE NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active' NOT NULL, -- 'active', 'suspended', 'trial_expired'
    plan_tier VARCHAR(50) DEFAULT 'trial' NOT NULL, -- 'free', 'pro', 'enterprise'
    db_connection_uri TEXT, -- Nullable for shared cluster schemas
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Tenant-Specific Tables (Provisioned dynamically inside tenant_{id} schemas)
CREATE TABLE tenant_template.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(50),
    avatar_url TEXT,
    status VARCHAR(50) DEFAULT 'active' NOT NULL,
    timezone VARCHAR(100) DEFAULT 'UTC' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

### 3.2 CRM & Sales Domain

```sql
CREATE TABLE tenant_template.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    website VARCHAR(255),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(50),
    country VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE tenant_template.pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE tenant_template.pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES tenant_template.pipelines(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    probability INTEGER DEFAULT 50 NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE tenant_template.crm_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES tenant_template.customers(id) ON DELETE RESTRICT,
    stage_id UUID NOT NULL REFERENCES tenant_template.pipeline_stages(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    value NUMERIC(15, 4) DEFAULT 0.0000 NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD' NOT NULL,
    owner_id UUID NOT NULL REFERENCES tenant_template.users(id),
    expected_closing_date DATE,
    status VARCHAR(50) DEFAULT 'open' NOT NULL, -- 'open', 'won', 'lost'
    lost_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

### 3.3 Inventory & SCM Domain

```sql
CREATE TABLE tenant_template.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    payment_terms VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE tenant_template.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(100) UNIQUE NOT NULL,
    barcode VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    uom VARCHAR(50) DEFAULT 'units' NOT NULL, -- Unit of Measure
    cost_price NUMERIC(15, 4) NOT NULL,
    sale_price NUMERIC(15, 4) NOT NULL,
    reorder_point INTEGER DEFAULT 10 NOT NULL,
    reorder_quantity INTEGER DEFAULT 50 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE tenant_template.warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    location_address TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL
);

CREATE TABLE tenant_template.stock_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES tenant_template.inventory_items(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES tenant_template.warehouses(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 0 NOT NULL,
    allocated_quantity INTEGER DEFAULT 0 NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT unique_item_warehouse UNIQUE(item_id, warehouse_id)
);
```

### 3.4 Finance & Accounting Domain

```sql
CREATE TABLE tenant_template.chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL, -- 'Asset', 'Liability', 'Equity', 'Revenue', 'Expense'
    sub_type VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE tenant_template.general_ledgers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
    reference_number VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE tenant_template.ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ledger_id UUID NOT NULL REFERENCES tenant_template.general_ledgers(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES tenant_template.chart_of_accounts(id),
    debit NUMERIC(15, 4) DEFAULT 0.0000 NOT NULL,
    credit NUMERIC(15, 4) DEFAULT 0.0000 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_debit_credit_balance CHECK (
        (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)
    )
);
```

---

## 4. Relationships, Cascading & Integrity Constraints

1.  **Strict Logical Constraint Mapping:** All foreign key references inside tenant schemas reference tables within the *same* schema to preserve relational containment.
2.  **No Direct Inter-Schema Constraints:** The database engine does not support foreign keys between dynamic tenant schemas and the central public schema. This boundary is strictly checked and validated by the application code's Repository level.
3.  **Cascading Policies:**
    *   *Safe-Deletes:* Transactional tables (such as ledger lines, deals, and inventory balances) employ strict `ON DELETE RESTRICT` constraints to prevent accidental loss of historical records.
    *   *Cascade-Deletes:* Transient tables (such as dealing logs, pipeline steps, and session keys) use standard `ON DELETE CASCADE`.

---

## 5. Indexing & Query Performance Optimization

Highly targeted indexes are applied to satisfy the query paths of each module and prevent performance drops.

### 5.1 System Critical Indexes
```sql
-- Dynamic Multi-Tenant routing lookup index
CREATE INDEX idx_tenants_domain ON public.tenants(domain);

-- CRM Query optimization
CREATE INDEX idx_deals_stage_status ON tenant_template.crm_deals(stage_id, status);
CREATE INDEX idx_deals_owner ON tenant_template.crm_deals(owner_id);

-- Inventory SKU scans and low stock warnings
CREATE INDEX idx_inventory_sku ON tenant_template.inventory_items(sku);
CREATE INDEX idx_stock_levels_lookup ON tenant_template.stock_levels(warehouse_id, quantity);

-- General Ledger reconciliation queries
CREATE INDEX idx_ledger_entries_account ON tenant_template.ledger_entries(account_id);
CREATE INDEX idx_general_ledger_date ON tenant_template.general_ledgers(transaction_date);
```

### 5.2 Composite & Partial Indexes
*   **Active Subscriptions Search:** `CREATE INDEX idx_active_subscribers ON public.tenants(plan_tier) WHERE status = 'active';`
*   **Low Stock Alerts:** `CREATE INDEX idx_low_stock_items ON tenant_template.inventory_items(id) WHERE reorder_point >= 1;`
