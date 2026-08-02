# Business Suite: Complete Technical Task Database
*Classification: Technical Execution Database*  
*Target: AI Coding Agents, CI/CD Orchestrators, and Engineering Sprints*

---

## Technical Task Registry Matrix

| Task ID | Description | Priority | Difficulty | Dependencies | Files Involved | Est. Duration | Acceptance Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TSK-1.1** | Create type-safe Zod schema environment parser | P0 - Critical | Easy | None | `/src/config/env.ts` | 4 Hours | App crashes immediately at startup with descriptive error messages if `DATABASE_URL` or `GEMINI_API_KEY` are missing. |
| **TSK-1.2** | Set up `public.tenants` database registry tables | P0 - Critical | Medium | TSK-1.1 | `/packages/database/migrations/` | 8 Hours | Schema matches specification; unique index constraints prevent duplicate subdomain registrations. |
| **TSK-1.3** | Build Express middleware context tenant resolver | P0 - Critical | High | TSK-1.2 | `/src/shared/middleware/tenant-resolver.ts` | 12 Hours | App isolates database search path dynamically based on HTTP Headers or subdomain configurations. |
| **TSK-1.4** | Build federated asymmetric token validator | P0 - Critical | High | TSK-1.3 | `/src/shared/middleware/auth.ts` | 12 Hours | Correctly parses and validates session JWTs; rejects tampered or expired cookies with a 401 error. |
| **TSK-1.5** | Implement tenant workspace registration endpoint | P0 - Critical | High | TSK-1.4 | `/src/modules/core_erp/controllers/auth-controller.ts` | 16 Hours | `POST /api/v1/auth/register` successfully provisions brand new schemas and seeds default roles. |
| **TSK-1.6** | Create login portal and tenant registration page | P1 - High | Medium | TSK-1.5 | `/src/modules/core_erp/ui/pages/LoginPage.tsx` | 16 Hours | Forms are responsive, accessible, and handle registration transitions gracefully. |
| **TSK-2.1** | Declare Drizzle tables for CRM leads and pipelines | P1 - High | Medium | TSK-1.5 | `/src/modules/crm/infrastructure/crm-tables.ts` | 8 Hours | Lead records reference specific tenant schemas and can be searched quickly via indexed keys. |
| **TSK-2.2** | Implement lead query list and filter endpoint | P1 - High | Medium | TSK-2.1 | `/src/modules/crm/controllers/deal-controller.ts` | 12 Hours | `GET /api/v1/crm/deals` filters by status stage, supports pagination, and responds in under 30ms. |
| **TSK-2.3** | Build custom Kanban pipeline drag board | P1 - High | High | TSK-2.2 | `/src/modules/crm/ui/components/PipelineBoard.tsx` | 16 Hours | Fluid drag mechanics update deal stage status in the database with optimistic UI rollbacks. |
| **TSK-2.4** | Create interactive lead timeline view component | P2 - Medium | Medium | TSK-2.3 | `/src/modules/crm/ui/components/DealTimeline.tsx` | 12 Hours | Renders chronologically ordered interaction history, communications, and customer notes. |
| **TSK-3.1** | Setup schemas for inventory items and warehouses | P1 - High | Medium | TSK-1.5 | `/src/modules/inventory/infrastructure/inventory-tables.ts` | 8 Hours | Multi-warehouse structures map uniquely to active tenant contexts with strict index parameters. |
| **TSK-3.2** | Create transactional stock audit adjuster | P1 - High | High | TSK-3.1 | `/src/modules/inventory/controllers/inventory-controller.ts` | 12 Hours | Stock modifications operate inside locked database transactions to prevent double-selling. |
| **TSK-3.3** | Build SKU stock inventory tracking UI | P2 - Medium | Medium | TSK-3.2 | `/src/modules/inventory/ui/pages/StockLevelsPage.tsx` | 16 Hours | Dynamic inventory grids display low-stock warning indicators with zero layout shifts. |
| **TSK-3.4** | Implement internal stock transfer manager route | P2 - Medium | Medium | TSK-3.3 | `/src/modules/inventory/controllers/transfers-controller.ts` | 12 Hours | Transfers accurately deduct source inventory quantities and add them to target warehouses. |
| **TSK-4.1** | Declare general ledger chart of accounts schemas | P1 - High | High | TSK-1.5 | `/src/modules/billing/infrastructure/accounting-tables.ts` | 12 Hours | General ledger tables prevent credit/debit imbalances via strict relational constraints. |
| **TSK-4.2** | Create transactional journal validator engine | P1 - High | High | TSK-4.1 | `/src/modules/billing/controllers/billing-controller.ts` | 16 Hours | `POST /api/v1/accounting/journal-entries` blocks submissions if total credits do not balance debits. |
| **TSK-4.3** | Build dynamic balance sheet reporting endpoints | P2 - Medium | High | TSK-4.2 | `/src/modules/billing/controllers/reports-controller.ts` | 16 Hours | Aggregates balances to return live Trial Balances and P&L statements in under 50ms. |
| **TSK-4.4** | Build bookkeeping ledger interface board | P2 - Medium | Medium | TSK-4.3 | `/src/modules/billing/ui/components/LedgerTable.tsx` | 16 Hours | Searchable high-density grid showing bookkeeping ledger records with responsive paging. |
| **TSK-4.5** | Build employee payroll processing workspace | P3 - Low | Medium | TSK-4.4 | `/src/modules/billing/ui/pages/PayrollPage.tsx` | 16 Hours | UI displays calculated salary runs, handles deductions, and supports PDF payslip generation. |
| **TSK-5.1** | Integrate server-side Google GenAI SDK wrapper | P1 - High | Medium | TSK-1.1 | `/src/modules/ai/infrastructure/gemini-client.ts` | 8 Hours | Successfully instantiates Gemini SDK client using server-side keys without exposing secrets to client. |
| **TSK-5.2** | Create document embedding background worker | P1 - High | High | TSK-5.1 | `/src/modules/ai/infrastructure/embed-worker.ts` | 16 Hours | Slices documents, generates semantic embeddings via Gemini, and saves them in the vector database. |
| **TSK-5.3** | Build secure grounded context search engine | P1 - High | High | TSK-5.2 | `/src/modules/ai/controllers/assistant-controller.ts` | 16 Hours | Answers system queries based on matching vector embeddings, respecting tenant permission gates. |
| **TSK-5.4** | Build node-based visual workflow designer canvas | P2 - Medium | High | TSK-1.5 | `/src/modules/automation/ui/components/WorkflowBuilder.tsx` | 24 Hours | Clean visual workspace lets users connect automation triggers, conditions, and actions. |
| **TSK-6.1** | Build Redis WebSocket connection gateway | P2 - Medium | High | TSK-1.4 | `/src/shared/sync/websocket-server.ts` | 16 Hours | Handles websocket connection events and validates user credentials securely. |
| **TSK-6.2** | Configure Redis event router synchronizer | P2 - Medium | High | TSK-6.1 | `/src/shared/sync/redis-pubsub.ts` | 16 Hours | Seamlessly broadcasts state changes across multiple app server container nodes. |
| **TSK-6.3** | Implement sliding-window rate limiters | P1 - High | Medium | TSK-1.3 | `/src/shared/middleware/rate-limiter.ts` | 8 Hours | Rate limits are checked in Redis, blocking sudden traffic spikes to protect database resources. |
| **TSK-6.4** | Build immutable security audit trail system | P1 - High | Medium | TSK-1.3 | `/src/admin/controllers/audit-logs-controller.ts` | 12 Hours | Write-only logger records critical system modifications; audits are non-editable and non-deletable. |
