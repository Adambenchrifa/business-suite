# Business Suite: Complete Implementation Master Plan & AI Execution Blueprint
*Document Classification: Strategic Technical Blueprint*  
*Target Consumer: AI Coding Agents / Engineering Sprints*  

---

## Executive Guide for AI Execution
This master plan serves as an **executable roadmap**. It breaks down the complete development of the Business Suite SaaS platform into **six (6) key milestones**. Each milestone is further partitioned into small, decoupled, and self-contained development tasks. Each task has been designed to fit within standard token limits and can be executed independently by downstream AI coding agents.

---

## Overview of Milestones

```
┌────────────────────────────────────────────────────────┐
│               IMPLEMENTATION LIFECYCLE                 │
└───────────────────────────┬────────────────────────────┘
                            ▼
             [ Milestone 1: Multi-Tenant Core ]
                            ▼
             [ Milestone 2: Sales & CRM Engine ]
                            ▼
           [ Milestone 3: SCM & Inventory System ]
                            ▼
             [ Milestone 4: Finance & Payroll ]
                            ▼
              [ Milestone 5: AI & Automation ]
                            ▼
             [ Milestone 6: Enterprise Sync ]
```

---

## Milestone 1: Multi-Tenant Core & Auth Boundary
*   **Goal:** Build the global registry DB router, multi-tenant Express app server, and federated Firebase authentication middleware.
*   **Estimated Duration:** 3 Weeks.
*   **Dependencies:** None (Platform Foundation).
*   **Folder Structure & Files to Create:**
    ```
    /src/config/env.ts
    /src/config/firebase.ts
    /src/shared/middleware/tenant-resolver.ts
    /src/shared/middleware/auth.ts
    /src/modules/core_erp/domain/user.ts
    /src/modules/core_erp/infrastructure/db-schemas.ts
    /src/modules/core_erp/controllers/auth-controller.ts
    ```
*   **Database Changes:**
    *   Create central `public.tenants` registry table.
    *   Create core `users`, `user_roles`, and `mfa_configurations` tenant-template tables.
*   **APIs to Expose:**
    *   `POST /api/v1/auth/register` (tenant provisioning + owner registration).
    *   `POST /api/v1/auth/login` (MFA checkpoint verification + session JWT generation).
    *   `POST /api/v1/auth/refresh` (Access cookie rotation).
*   **Frontend Pages:**
    *   `/auth/login`: Interactive workspace select and credentials form.
    *   `/auth/register`: Multi-step corporate onboarding and domain validation setup.
*   **Backend Services:**
    *   `TenantRoutingService`: Dynamic DB connection path assignment.
    *   `JwtTokenProvider`: Token signer, rotation validation, and verification engine.
*   **Tests:**
    *   Unit tests checking token signing and encryption key extraction.
    *   Integration tests verifying search path injection prevents cross-tenant access.
*   **Acceptance Criteria:**
    *   Tenant databases must reside in separate schemas.
    *   Requests with invalid tenant headers must be blocked with a `403 Forbidden` error.
    *   Successfully pass automated verification builds (`npm run build`).

### Milestone 1: Step-by-Step AI Execution Tasks
1.  **[Task 1.1] Environment Schema Verification:** Create `/src/config/env.ts` using Zod to parse, validate, and verify that all system variables (`GEMINI_API_KEY`, `APP_URL`, `DATABASE_URL`) exist and throw descriptive runtime errors if they do not.
2.  **[Task 1.2] Global Tenants Table Migrations:** Set up the global registry migration within `packages/database`. Create the table structure for `public.tenants`, including the UUID primary key, sub-domain uniqueness, and status flags.
3.  **[Task 1.3] Multi-Tenant Dynamic Express Router:** Write the middleware function inside `/src/shared/middleware/tenant-resolver.ts` that intercepts requests, checks subdomains or headers for tenant metadata, updates the Drizzle schema search path, and returns a 404 error if the tenant is suspended.
4.  **[Task 1.4] Federated Token Validation Middleware:** Implement `/src/shared/middleware/auth.ts` to parse cookies or headers for session JWTs, verify the asymmetric signatures, and bind the user ID, role, and permissions scope onto the request context.
5.  **[Task 1.5] Onboarding and Provisioning Controller:** Build `AuthController` and define `/api/v1/auth/register` so that registering a new tenant creates a new company record, generates a dedicated PostgreSQL tenant schema, and provisions the default database tables.

---

## Milestone 2: CRM & Sales Pipeline Engine
*   **Goal:** Implement sales pipelines, pipeline stage controls, customer profiles, and interactive Kanban boards.
*   **Estimated Duration:** 2 Weeks.
*   **Dependencies:** Milestone 1.
*   **Folder Structure & Files to Create:**
    ```
    /src/modules/crm/domain/customer.ts
    /src/modules/crm/domain/deal.ts
    /src/modules/crm/infrastructure/crm-tables.ts
    /src/modules/crm/controllers/deal-controller.ts
    /src/modules/crm/ui/components/PipelineBoard.tsx
    /src/modules/crm/ui/pages/DealsPage.tsx
    ```
*   **Database Changes:**
    *   Create `customers`, `pipelines`, `pipeline_stages`, and `crm_deals` tenant-specific tables with matching index keys.
*   **APIs to Expose:**
    *   `GET /api/v1/crm/deals` (with pagination, stage filters, and sorting).
    *   `POST /api/v1/crm/deals` (validates value and fields against active schemes).
    *   `PATCH /api/v1/crm/deals/:id/stage` (executes deal pipeline stage updates).
*   **Frontend Pages:**
    *   `/sales/pipeline`: Drag-and-drop Kanban interface showing deals grouped by stage columns.
    *   `/crm/leads/:id`: Interactive visual timeline showing contact history and task lists.
*   **Backend Services:**
    *   `CrmPipelineService`: Coordinates deal transitions, checks win-probability weights, and triggers change notifications on stage updates.
*   **Tests:**
    *   Unit tests checking deal status transitions (e.g., preventing won deals from being set to negative values).
    *   Integration tests verifying sorting queries inside CRM repositories.
*   **Acceptance Criteria:**
    *   Users can drag and drop deals to update pipeline stages, and these changes are saved in the database automatically.
    *   The interface runs with zero layout shifts during async data loading.

### Milestone 2: Step-by-Step AI Execution Tasks
1.  **[Task 2.1] CRM Database Schema Declarations:** Create the tables for `customers`, `pipelines`, `pipeline_stages`, and `crm_deals` in Drizzle ORM format, including database index keys to optimize queries.
2.  **[Task 2.2] Deal Filtering Controller:** Build out `/api/v1/crm/deals` in Express, including schema validation (Zod) to handle cursor-based pagination, search filters, and stage groupings.
3.  **[Task 2.3] Kanban Drag Event Handler:** Create `/src/modules/crm/ui/components/PipelineBoard.tsx` in React using Tailwind CSS. Implement native drag-and-drop mechanics to let users move deals between stage columns, and trigger optimistic UI updates with rollback capabilities.
4.  **[Task 2.4] CRM Interaction Timeline Component:** Build an interactive customer profile timeline component in React, rendering historical emails, support logs, and call recordings in chronological order.

---

## Milestone 3: SCM, Warehousing, & Inventory
*   **Goal:** Deploy multi-warehouse inventory systems, SKU catalogs, supplier records, and purchase requisitions.
*   **Estimated Duration:** 2 Weeks.
*   **Dependencies:** Milestone 2.
*   **Folder Structure & Files to Create:**
    ```
    /src/modules/inventory/domain/sku.ts
    /src/modules/inventory/infrastructure/inventory-tables.ts
    /src/modules/inventory/controllers/inventory-controller.ts
    /src/modules/inventory/ui/components/BarcodeScanner.tsx
    /src/modules/inventory/ui/pages/StockLevelsPage.tsx
    ```
*   **Database Changes:**
    *   Create `suppliers`, `inventory_items`, `warehouses`, and `stock_levels` tables.
*   **APIs to Expose:**
    *   `GET /api/v1/inventory/items` (catalog scans and stock alerts).
    *   `POST /api/v1/inventory/transfers` (warehouse stock moves).
*   **Frontend Pages:**
    *   `/inventory/catalog`: Multi-column catalog grid showing item SKUs, stock levels, and warehouse locations.
    *   `/inventory/transfers`: Internal stock transfer request forms.
*   **Backend Services:**
    *   `InventoryEngine`: Manages real-time stock levels, handles reorder thresholds, and automates purchase order drafts.
*   **Tests:**
    *   Unit tests validating stock deductions.
    *   Integration tests checking database-level constraints on stock balances (preventing double-selling).
*   **Acceptance Criteria:**
    *   Stock updates immediately trigger reorder alerts when inventory levels drop below pre-set minimums.
    *   All transactional queries handle stock balances and allocations as a single transaction.

### Milestone 3: Step-by-Step AI Execution Tasks
1.  **[Task 3.1] Inventory Database Schema Setup:** Define Drizzle schemas for `inventory_items`, `warehouses`, and `stock_levels` inside the tenant schema context. Include database indexes on SKU fields.
2.  **[Task 3.2] Stock Balance Adjustments Controller:** Create `/api/v1/inventory/adjust` to process stock audits. Wrap adjustments in a database transaction to prevent inventory count mismatches.
3.  **[Task 3.3] Warehouse Transfer Router:** Implement `/api/v1/inventory/transfers` to coordinate stock transfers, verify product quantities are available, and set up approval workflows.
4.  **[Task 3.4] Catalog Grid UI:** Build `/src/modules/inventory/ui/pages/StockLevelsPage.tsx` using React 19 and Tailwind. Display dynamic stock counts, current storage locations, and auto-scrolling tables.

---

## Milestone 4: Double-Entry Finance & Accounting Ledger
*   **Goal:** Build double-entry bookkeeping, general ledgers, chart of accounts, invoicing, and payroll processing.
*   **Estimated Duration:** 3 Weeks.
*   **Dependencies:** Milestone 3.
*   **Folder Structure & Files to Create:**
    ```
    /src/modules/billing/domain/ledger.ts
    /src/modules/billing/infrastructure/accounting-tables.ts
    /src/modules/billing/controllers/billing-controller.ts
    /src/modules/billing/ui/components/LedgerTable.tsx
    /src/modules/billing/ui/pages/InvoiceHistoryPage.tsx
    ```
*   **Database Changes:**
    *   Create `chart_of_accounts`, `general_ledgers`, `ledger_entries`, `payroll_runs`, and `payroll_entries` tables.
*   **APIs to Expose:**
    *   `POST /api/v1/accounting/journal-entries` (double-entry validator).
    *   `GET /api/v1/accounting/reports/balance-sheet` (real-time balance report sheets).
    *   `POST /api/v1/billing/invoices` (invoice generation, taxation, and customer billing details).
*   **Frontend Pages:**
    *   `/accounting/ledger`: Searchable high-density bookkeeping ledger.
    *   `/payroll/runs`: Multi-stage payroll processing dashboards.
*   **Backend Services:**
    *   `AccountingEngine`: Validates that total debits equal total credits, lock closed transaction cycles, and calculates financial metrics.
*   **Tests:**
    *   Unit tests checking ledger entries (ensuring non-zero transactions balance correctly).
    *   Integration tests verifying PDF invoices generate without errors.
*   **Acceptance Criteria:**
    *   No journal entry can be processed unless debits equal credits.
    *   Financial reporting endpoints complete in under 50ms using materialized query views.

### Milestone 4: Step-by-Step AI Execution Tasks
1.  **[Task 4.1] Ledger Database Schema Declarations:** Create database schemas for `chart_of_accounts`, `general_ledgers`, and `ledger_entries`. Add validation rules to prevent debit/credit imbalances.
2.  **[Task 4.2] Journal Transaction Controller:** Build `/api/v1/accounting/journal-entries` to validate that total debits equal total credits, and return detailed error messages if they do not.
3.  **[Task 4.3] Dynamic Balance Sheet Reporter:** Create a reporting router to dynamically calculate Trial Balance, Profit & Loss (P&L), and Balance Sheets.
4.  **[Task 4.4] Payroll Running Dashboard UI:** Build the payroll dashboard using React 19. Integrate visual workflows to run payroll, add deductions, and generate downloadable paystubs.

---

## Milestone 5: Grounded AI Assistant & Visual Automation
*   **Goal:** Implement Gemini SDK embeddings, vector databases, grounded corporate knowledge, and node-based automation builders.
*   **Estimated Duration:** 2 Weeks.
*   **Dependencies:** Milestone 4.
*   **Folder Structure & Files to Create:**
    ```
    /src/modules/ai/infrastructure/gemini-client.ts
    /src/modules/ai/controllers/assistant-controller.ts
    /src/modules/automation/domain/workflow.ts
    /src/modules/automation/ui/components/WorkflowBuilder.tsx
    ```
*   **Database Changes:**
    *   Activate the `pgvector` extension.
    *   Create `kb_embeddings` (vector column), `automation_workflows`, and `automation_execution_logs` tables.
*   **APIs to Expose:**
    *   `POST /api/v1/ai/query` (grounded text answering using Gemini models).
    *   `POST /api/v1/automation/workflows` (workflow activations).
*   **Frontend Pages:**
    *   `/ai/assistant`: Chat overlay providing grounded context answers.
    *   `/automation/workflows`: Drag-and-drop workspace to link automation steps.
*   **Backend Services:**
    *   `GeminiRAGEngine`: Handles document slicing, vector embedding generation, and semantic database lookups.
    *   `WorkflowExecutor`: Listens to platform events, processes conditionals, and triggers actions asynchronously.
*   **Tests:**
    *   Unit tests verifying prompt builders redact personal details (PII) before sending data to external APIs.
    *   Integration tests validating circular reference loops are detected and blocked.
*   **Acceptance Criteria:**
    *   The assistant strictly respects user access controls. It must never return information from files the active user does not have permission to view.
    *   Workflow automations execute successfully within 100ms of trigger events.

### Milestone 5: Step-by-Step AI Execution Tasks
1.  **[Task 5.1] Gemini SDK Client Wrapper:** Integrate `@google/genai` inside `/src/modules/ai/infrastructure/gemini-client.ts`. Set up dynamic prompt templates that use system context caching.
2.  **[Task 5.2] PgVector Embedding Generator:** Build background processing workers to slice documents, generate text embeddings, and save records inside the vector database.
3.  **[Task 5.3] Grounded Search Controller:** Build `/api/v1/ai/query` in Express. Fetch semantically matched context from the vector database and return safe answers.
4.  **[Task 5.4] Visual Workflow Design Canvas:** Create `/src/modules/automation/ui/components/WorkflowBuilder.tsx` in React using SVG pathways to connect workflow triggers, conditions, and actions.

---

## Milestone 6: Enterprise Sync, Observability, & Hardening
*   **Goal:** Implement Redis WebSockets synchronization, global rate-limiting, and compliance monitoring.
*   **Estimated Duration:** 2 Weeks.
*   **Dependencies:** Milestone 5.
*   **Folder Structure & Files to Create:**
    ```
    /src/shared/sync/websocket-server.ts
    /src/shared/sync/redis-pubsub.ts
    /src/shared/middleware/rate-limiter.ts
    /src/admin/controllers/audit-logs-controller.ts
    ```
*   **Database Changes:**
    *   Add logical sharding mappings to the `public.tenants` global registry table.
*   **APIs to Expose:**
    *   `GET /api/v1/admin/audit-logs` (immutable security tracking details).
    *   `GET /api/v1/health` (observability endpoint checking server and DB health).
*   **Frontend Pages:**
    *   `/admin/audit-logs`: Searchable grid displaying user activities and data changes.
    *   `/admin/tenants`: Operations dashboard to manage, configure, or suspend tenants.
*   **Backend Services:**
    *   `RedisPubSubBroker`: Synchronizes WebSocket messages across multiple server nodes.
    *   `AuditLoggingService`: Append-only system logger tracking key platform changes.
*   **Tests:**
    *   Unit tests checking rate limiters block requests when thresholds are exceeded.
    *   Integration tests validating active WebSocket message deliveries.
*   **Acceptance Criteria:**
    *   Data updates are synchronized across connected client browsers in under 100ms.
    *   The platform remains fully functional under simulated high-load scenarios.

### Milestone 6: Step-by-Step AI Execution Tasks
1.  **[Task 6.1] Redis WebSocket Gateway Setup:** Implement `/src/shared/sync/websocket-server.ts` to manage client connections and verify user authentication tokens.
2.  **[Task 6.2] Redis Pub/Sub Synchronization:** Configure Redis event listeners to synchronize and route events across multiple application server containers.
3.  **[Task 6.3] Sliding Window Rate Limiter:** Build a sliding-window rate limiter in Redis to protect server endpoints from sudden traffic spikes.
4.  **[Task 6.4] Immutable Audit Trail Logger:** Build `AuditLoggingService` as an append-only logging module, and ensure audit logs cannot be edited or deleted.
