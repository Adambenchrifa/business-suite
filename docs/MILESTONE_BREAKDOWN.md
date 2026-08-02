# Business Suite: Detailed Milestone & Sprint Breakdown
*Classification: Project Management Blueprint*  
*Target: Technical Project Managers, Scrum Leads, and AI Orchestrators*

---

## Milestone 1: Multi-Tenant Core & Auth Boundary

### Sprint 1.1: System Foundation & Tenant Resolution
*   **Objective:** Set up validated runtime configurations and dynamic tenant schema routing.
*   **Estimated Duration:** 1.5 Weeks
*   **Tasks:**
    *   Create dynamic environment validator using Zod.
    *   Implement global database migrations schema for core registries.
    *   Build dynamic Express router middleware to dynamically isolate user contexts.
*   **Files Affected:**
    *   `/src/config/env.ts`
    *   `/src/shared/middleware/tenant-resolver.ts`
    *   `/packages/database/migrations/0001_global_tenants.sql`
*   **Expected Output:** Dynamic schema router capable of isolating user requests on a per-subdomain basis.

### Sprint 1.2: Federated Auth & User Onboarding
*   **Objective:** Implement secure login workflows and workspace onboarding forms.
*   **Estimated Duration:** 1.5 Weeks
*   **Tasks:**
    *   Create Express token validation and authentication middleware.
    *   Build the onboarding controller to handle new tenant workspaces.
    *   Design corporate registration and login portal interfaces in React 19.
*   **Files Affected:**
    *   `/src/shared/middleware/auth.ts`
    *   `/src/modules/core_erp/controllers/auth-controller.ts`
    *   `/src/modules/core_erp/ui/pages/LoginPage.tsx`
    *   `/src/modules/core_erp/ui/pages/RegisterPage.tsx`
*   **Expected Output:** Interactive onboarding flows that provision secure workspace connections and session controls.

---

## Milestone 2: CRM & Sales Pipeline Engine

### Sprint 2.1: Lead Database Structures & Dynamic Queries
*   **Objective:** Define CRM schema representations and implement lead query endpoints.
*   **Estimated Duration:** 1 Week
*   **Tasks:**
    *   Define Drizzle tables for pipelines, stages, and leads with fast lookup indexes.
    *   Build Express controller endpoints to filter, sort, and query active deals.
*   **Files Affected:**
    *   `/src/modules/crm/infrastructure/crm-tables.ts`
    *   `/src/modules/crm/controllers/deal-controller.ts`
*   **Expected Output:** Highly optimized database tables and Express controllers returning sorted JSON lead arrays.

### Sprint 2.2: Interactive Pipeline Dashboard UI
*   **Objective:** Build dynamic Kanban drag-and-drop boards to track and move leads.
*   **Estimated Duration:** 1 Week
*   **Tasks:**
    *   Build the modular pipeline column drag component in React using Tailwind CSS.
    *   Implement immediate state updates with rollback triggers for drag-and-drop operations.
    *   Build lead interaction history timeline interfaces.
*   **Files Affected:**
    *   `/src/modules/crm/ui/components/PipelineBoard.tsx`
    *   `/src/modules/crm/ui/pages/DealsPage.tsx`
    *   `/src/modules/crm/ui/components/DealTimeline.tsx`
*   **Expected Output:** Fully interactive Kanban drag-and-drop board displaying current deals with smooth transitions.

---

## Milestone 3: SCM, Warehousing, & Inventory

### Sprint 3.1: Warehouse Multi-Storage Schema & Adjustments
*   **Objective:** Define inventory database schemas and build transactional stock audit endpoints.
*   **Estimated Duration:** 1 Week
*   **Tasks:**
    *   Create Drizzle table mappings for SKUs, warehouses, and storage levels.
    *   Build transactional database controllers to process manual stock adjustments.
*   **Files Affected:**
    *   `/src/modules/inventory/infrastructure/inventory-tables.ts`
    *   `/src/modules/inventory/controllers/inventory-controller.ts`
*   **Expected Output:** Backpressure-safe inventory API controllers supporting transaction-locked stock adjustments.

### Sprint 3.2: SKU Management & Warehouse Transfers UI
*   **Objective:** Build the SKU inventory grid and handle product transfer workflows.
*   **Estimated Duration:** 1 Week
*   **Tasks:**
    *   Design the SKU stock management catalog grid with low layout shifts.
    *   Build Express APIs to validate, run, and complete warehouse transfers.
*   **Files Affected:**
    *   `/src/modules/inventory/ui/pages/StockLevelsPage.tsx`
    *   `/src/modules/inventory/controllers/transfers-controller.ts`
*   **Expected Output:** High-density inventory UI displaying item catalog scans, stock warnings, and transit statuses.

---

## Milestone 4: Double-Entry Finance & Accounting Ledger

### Sprint 4.1: General Ledger Accounting Controllers
*   **Objective:** Build double-entry verification layers and calculate real-time financial balances.
*   **Estimated Duration:** 1.5 Weeks
*   **Tasks:**
    *   Define Drizzle schemas for chart of accounts, general ledgers, and transactions.
    *   Implement Journal Entries controller that enforces matching debit/credit balances.
    *   Create financial API handlers for Trial Balance and Balance Sheet reports.
*   **Files Affected:**
    *   `/src/modules/billing/infrastructure/accounting-tables.ts`
    *   `/src/modules/billing/controllers/billing-controller.ts`
*   **Expected Output:** Robust general ledger backend ensuring absolute financial consistency and mathematical accuracy.

### Sprint 4.2: Billing Invoicing & Payroll Processing UI
*   **Objective:** Create billing management forms and build payroll tracking dashboards.
*   **Estimated Duration:** 1.5 Weeks
*   **Tasks:**
    *   Create PDF bill generation and client transaction history interfaces in React.
    *   Build interactive payroll workspace visual controls to run employee payouts.
*   **Files Affected:**
    *   `/src/modules/billing/ui/pages/InvoiceHistoryPage.tsx`
    *   `/src/modules/billing/ui/components/LedgerTable.tsx`
    *   `/src/modules/billing/ui/pages/PayrollPage.tsx`
*   **Expected Output:** Polished accounting ledger dashboard supporting live document exports and custom salary calculations.

---

## Milestone 5: Grounded AI Assistant & Visual Automation

### Sprint 5.1: Vector DB Setup & Gemini SDK Grounding
*   **Objective:** Integrate the Gemini SDK, set up PgVector layers, and calculate knowledge base embeddings.
*   **Estimated Duration:** 1 Week
*   **Tasks:**
    *   Integrate `@google/genai` inside server-side AI handlers.
    *   Configure document embedding generators using semantic chunking engines.
    *   Build grounded query endpoints that fetch corporate knowledge context.
*   **Files Affected:**
    *   `/src/modules/ai/infrastructure/gemini-client.ts`
    *   `/src/modules/ai/controllers/assistant-controller.ts`
*   **Expected Output:** Secure AI assistant backend capable of answering corporate knowledge questions based on grounded context.

### Sprint 5.2: Node-Based Automation Editor UI
*   **Objective:** Build interactive workflow design canvasses and trigger automated steps.
*   **Estimated Duration:** 1 Week
*   **Tasks:**
    *   Build node-based designer canvas interfaces using React and SVG paths.
    *   Create backend runners to listen to events, check rules, and run tasks.
*   **Files Affected:**
    *   `/src/modules/automation/ui/components/WorkflowBuilder.tsx`
    *   `/src/modules/automation/domain/workflow.ts`
*   **Expected Output:** Polished drag-and-drop canvas let users wire up platform event integrations visually.

---

## Milestone 6: Enterprise Sync, Observability, & Hardening

### Sprint 6.1: Shared Redis Pub/Sub WebSocket Architecture
*   **Objective:** Set up Redis event routers and implement real-time server synchronizers.
*   **Estimated Duration:** 1 Week
*   **Tasks:**
    *   Build the primary WebSocket client hub and token verification layer.
    *   Implement Redis PubSub channels to broadcast state changes to active users.
*   **Files Affected:**
    *   `/src/shared/sync/websocket-server.ts`
    *   `/src/shared/sync/redis-pubsub.ts`
*   **Expected Output:** Event synchronizer broadcasting live state changes to client views in under 100ms.

### Sprint 6.2: Sliding Limiters, Auditing Trails, & Production Hardening
*   **Objective:** Set up request rate-limiters, implement append-only system loggers, and verify deployment ready.
*   **Estimated Duration:** 1 Week
*   **Tasks:**
    *   Implement Redis-backed sliding window rate limiters.
    *   Build audit log tracking databases and audit search dashboards.
    *   Verify linter passes and compile build pipelines (`npm run build`).
*   **Files Affected:**
    *   `/src/shared/middleware/rate-limiter.ts`
    *   `/src/admin/controllers/audit-logs-controller.ts`
    *   `/src/admin/ui/pages/AuditLogsPage.tsx`
*   **Expected Output:** Security-hardened, high-performance platform running with robust system observability.
