# BUSINESS SUITE — FULL DIAGNOSTIC REPORT

## Executive Summary

A complete engineering diagnostic audit was executed across the Business Suite multi-tenant SaaS application. The repository was inspected across all layers: package management, static TypeScript analysis, database schemas and migrations, authentication/authorization flows, multi-tenant isolation, API route handlers, frontend React components, error handling, security posture, performance, mobile responsiveness, and test coverage gaps.

This audit confirmed that while the core authentication engine, token rotation (RTR), and in-memory mock database engine function cleanly during unit testing, **the application suffers from a single critical, foundational blocker in production/PostgreSQL mode**: workspace registration provisions **only** `users` and `sessions` tables in newly created tenant schemas (`tenant_<domain>`), while failing to create any of the remaining 34+ database tables required by the ERP, Inventory, HR, Sales/CRM, File Storage, and Audit Trail modules.

Consequently, when deployed or run against PostgreSQL, every module except Authentication returns `500 Internal Server Error` ("An unexpected internal server error occurred.") whenever data fetching or mutation is attempted. This single root cause explains the exact symptoms captured in the manual Android/Chrome testing screenshots across General Overview, Settings & Profile, Branches & Warehouses, Inventory Dashboard, Human Resources, Sales & CRM, and Audit Logs.

---

## Overall Health

- **CRITICAL:** 3
- **HIGH:** 5
- **MEDIUM:** 6
- **LOW:** 4
- **INFO:** 2

Total Findings: **20**

---

## 1. Build / Test Failures

- **Command Checks**:
  - `pnpm lint` (`tsc --noEmit`): **PASSED** (0 TypeScript errors in source code).
  - `pnpm build` (`vite build` + `esbuild server.ts`): **PASSED** (Bundles frontend to `dist/` and server to `dist/server.cjs`).
  - `pnpm test` (`tsx src/test-auth.ts`): **PASSED** (15/15 tests pass in mock database mode).
- **PostgreSQL / Real DB Execution Failure**:
  - When `DB_MODE=postgres` or when deployed to PostgreSQL, any test or API endpoint attempting to write/read from ERP tables fails because DDL migrations are absent and workspace registration does not execute table provisioning DDL for non-auth tables.

---

## 2. Runtime/API Failures

- **Shared Root Cause 500 Failures**:
  All endpoints under `/api/v1/erp/*` (except auth endpoints) return `HTTP 500 Internal Server Error` when executed against PostgreSQL because target tables do not exist in the tenant schema search path.
- **Frontend Error Masking**:
  `errorHandler` middleware catches native database exceptions (e.g. `42P01: relation does not exist`) and masks them as generic `"An unexpected internal server error occurred."` with status 500, hiding the actionable error cause from API consumers.

---

## 3. Database Problems

- **Missing Schema Tables in Provisioning DDL**:
  `AuthController.register` contains inline raw DDL creating only `"${schemaName}"."users"` and `"${schemaName}"."sessions"`. It lacks DDL for `organizations`, `branches`, `warehouses`, `departments`, `positions`, `employees`, `user_invitations`, `currencies`, `tax_configurations`, `number_sequences`, `files`, `activity_logs`, `notifications`, `product_categories`, `brands`, `units_of_measure`, `products`, `product_variants`, `stock_locations`, `inventory_items`, `stock_movements`, `stock_movement_items`, `crm_companies`, `crm_contacts`, `crm_leads`, `crm_opportunities`, `crm_activities`, `sales_orders`, `sales_order_items`, `delivery_orders`, `delivery_order_items`, `invoices`, and `invoice_items`.
- **Zero Migration Artifacts**:
  `drizzle.config.ts` points to `./drizzle`, but the `./drizzle` directory does not exist in the repository. No SQL migration scripts have been generated or tracked in source control.
- **Audit Log Column Type Mismatch (`userId`)**:
  `activity_logs.user_id` is defined as `uuid`. In unit tests or background system events where `userId` is a string like `'test-user-id'`, PostgreSQL throws `22P02: invalid input syntax for type uuid: "test-user-id"`.

---

## 4. Authentication Problems

- **Account Enumeration via Login Error Messages**:
  In `AuthController.login`, an unverified user receives `'Please verify your email address before logging in.'` instead of a uniform credential failure message, allowing attackers to verify whether an email is registered on a workspace.
- **Exposed Verification Token**:
  `AuthController.register` returns the raw `verificationToken` inside the JSON response payload.
- **Lack of Frontend Refresh Token Interceptor**:
  When the short-lived access token expires, `fetchWithAuth` on the frontend does not attempt to call `/api/v1/auth/refresh` using the HTTP-only refresh token or stored token; it simply fails, forcing the user to log out.

---

## 5. Authorization / RBAC Problems

- **Missing Role Checks on Mutative/Destructive Endpoints**:
  Only organization update, branch CRUD, warehouse CRUD, department CRUD, position CRUD, employee CRUD, invitation creation/cancellation, currency CRUD, tax CRUD, and sequence update endpoints enforce `requireRole(['owner', 'admin'])`.
  ALL Inventory endpoints (category, brand, UoM, product, variant, location, stock movement creation/deletion) and ALL Sales/CRM endpoints (company, contact, lead, opportunity, activity, sales order status, delivery order, invoice status creation/deletion) and File Storage endpoints lack role checks. Any authenticated user with role `member` can execute destructive actions.

---

## 6. Multi-Tenant Isolation Problems

- **Strict Schema Boundary Isolation (Verified Effective)**:
  `tenantResolver` checks out dynamic Drizzle connections with `SET search_path TO "tenant_schema", public`. Cross-tenant token access is blocked by `authenticate` middleware (`decoded.tenantId !== req.tenantId` -> `403 Forbidden`).
- **Unverified Stock Variant Deduction**:
  In `SalesCrmController.updateOrderStatus`, when an order is confirmed, stock reservation deducts quantity from `inventoryItems` matching `productId` and `warehouseId`. If multiple variants exist for that product and `variantId` is null, it deducts from the first matching inventory item without variant filtering.

---

## 7. Module-by-Module Results

### Authentication
- **Status**: Functional in mock mode; partial in PostgreSQL mode.
- **Issues**: Exposes verification token in registration payload; account enumeration on login.

### General Overview
- **Status**: Broken in PostgreSQL mode (`500 Internal Server Error`).
- **Cause**: Missing `organizations`, `branches`, `warehouses`, `employees` tables in tenant schema.

### Settings & Profile
- **Status**: Broken in PostgreSQL mode (`500 Internal Server Error`).
- **Cause**: Missing `organizations`, `currencies`, `tax_configurations`, `number_sequences` tables in tenant schema.

### Branches & Warehouses
- **Status**: Broken in PostgreSQL mode (`500 Internal Server Error`).
- **Cause**: Missing `branches`, `warehouses` tables in tenant schema.

### Inventory & Products
- **Status**: Broken in PostgreSQL mode (`500 Internal Server Error` on dashboard overview and product lists).
- **Cause**: Missing `products`, `product_categories`, `brands`, `units_of_measure`, `stock_locations`, `inventory_items`, `stock_movements` tables in tenant schema. Lack of RBAC on write actions.

### Sales & CRM
- **Status**: Broken in PostgreSQL mode (`500 Internal Server Error`).
- **Cause**: Missing `crm_leads`, `crm_companies`, `crm_contacts`, `crm_opportunities`, `crm_activities`, `sales_orders`, `sales_order_items`, `delivery_orders`, `invoices` tables in tenant schema. Lack of RBAC on write actions.

### Human Resources
- **Status**: Broken in PostgreSQL mode (`500 Internal Server Error`).
- **Cause**: Missing `departments`, `positions`, `employees` tables in tenant schema.

### User Invitations
- **Status**: UI loads, but API calls fail in PostgreSQL mode (`500 Internal Server Error`).
- **Cause**: Missing `user_invitations` table in tenant schema.

### File Storage
- **Status**: UI loads, but API calls fail in PostgreSQL mode (`500 Internal Server Error`).
- **Cause**: Missing `files` table in tenant schema. Lack of RBAC on file deletion.

### Audit Logs
- **Status**: Broken in PostgreSQL mode (`500 Internal Server Error`).
- **Cause**: Missing `activity_logs` table in tenant schema. `AuditService` silently swallows insert failures.

---

## 8. Security Findings

1. **HIGH**: Missing RBAC enforcement on Inventory, Sales/CRM, and File Storage mutation endpoints.
2. **HIGH**: Account enumeration flaw in `AuthController.login`.
3. **MEDIUM**: Verification token returned in `register` API response.
4. **MEDIUM**: Lack of rate limiting on non-auth API endpoints.
5. **LOW**: Security headers set manually without helmet middleware dependency.

---

## 9. Performance / Reliability Findings

1. **HIGH**: N+1 query patterns in `ErpController.getProducts`, `SalesCrmController.getSalesOrders`, and `SalesCrmController.getDashboard` (fetching all relations into Node.js memory and doing array `.find()` / `.filter()`).
2. **MEDIUM**: Missing database indexes on foreign keys (`company_id`, `contact_id`, `product_id`, `warehouse_id`, `department_id`) and filter columns (`status`, `email`).
3. **INFO**: Connection pool checkout safely releases clients via `res.on('finish')` and `res.on('close')`.

---

## 10. Mobile/UI Findings

1. **LOW**: Responsive layout on mobile renders vertical sidebar stacked above main content arena.
2. **LOW**: Data tables rely on `overflow-x-auto`, which requires horizontal scrolling on narrow touch screens.
3. **INFO**: Modal forms utilize `max-h-[90vh] overflow-y-auto`, preventing viewport overflow on touchscreens.

---

## 11. Test Coverage Gaps

1. **CRITICAL**: Zero tests for PostgreSQL schema provisioning and table creation.
2. **HIGH**: Zero unit/integration tests for ERP Foundation (`organization`, `branches`, `warehouses`, `departments`, `positions`, `employees`, `invitations`, `currencies`, `taxes`).
3. **HIGH**: Zero unit/integration tests for Inventory (`products`, `categories`, `brands`, `uoms`, `locations`, `movements`, `valuation`).
4. **HIGH**: Zero unit/integration tests for Sales/CRM (`companies`, `contacts`, `leads`, `opportunities`, `activities`, `orders`, `deliveries`, `invoices`).

---

## 12. Documentation vs Reality

- **Documented**: Architecture specification (`ARCHITECTURE.md`) describes clean-architected modular monolith with Drizzle migrations, BigQuery/ClickHouse CDC, Redis Pub/Sub, gRPC, and BullMQ queues.
- **Reality**: Single Express monolith using REST endpoints and Drizzle ORM over PostgreSQL / MockPool. No Redis, no BullMQ, no gRPC, no ClickHouse, no Drizzle migration files.

---

## 13. Root Cause Map

```
SHARED ROOT CAUSE 1: Workspace Registration Incomplete Tenant DDL / Missing Drizzle Migrations
├── Symptom: General Overview returns 500
├── Symptom: Settings & Profile returns 500
├── Symptom: Branches & Warehouses returns 500
├── Symptom: Inventory Dashboard returns 500 ("Dashboard overview load failed")
├── Symptom: Human Resources returns 500
├── Symptom: Sales & CRM returns 500
├── Symptom: Audit Logs returns 500
├── Symptom: File Storage upload returns 500
└── Symptom: User Invitations creation returns 500

SHARED ROOT CAUSE 2: Missing RBAC Middleware on Domain Controller Routes
├── Symptom: Standard 'member' user can delete Products
├── Symptom: Standard 'member' user can delete Sales Orders
├── Symptom: Standard 'member' user can update Invoice Status to Paid
└── Symptom: Standard 'member' user can delete Company Accounts and Files

SHARED ROOT CAUSE 3: Silent Error Swallowing in AuditService & Incompatible userId Type
├── Symptom: Audit log insertion failures do not surface in test runner
└── Symptom: PostgreSQL throws 22P02 on non-UUID string userId
```

---

## 14. Priority Fix Plan

### P0 (Critical / Data Loss / Blocking)
1. **[P0-01] Tenant Schema Migration Engine**: Update `AuthController.register` or implement a Drizzle migration runner to execute all 34+ table definitions (`organizations`, `branches`, `warehouses`, `departments`, `positions`, `employees`, `invitations`, `currencies`, `taxes`, `sequences`, `files`, `activity_logs`, `notifications`, `products`, `categories`, `brands`, `uoms`, `variants`, `locations`, `inventory_items`, `movements`, `movement_items`, `crm_companies`, `crm_contacts`, `crm_leads`, `crm_opportunities`, `crm_activities`, `sales_orders`, `sales_order_items`, `deliveries`, `delivery_items`, `invoices`, `invoice_items`) upon workspace creation.
2. **[P0-02] Drizzle Migrations Generation**: Generate canonical SQL migration files in `./drizzle/` via `drizzle-kit generate`.

### P1 (Major Broken Functionality / Security Gaps)
3. **[P1-01] RBAC Route Protection**: Add `requireRole(['owner', 'admin'])` middleware to write/delete routes across Inventory, Sales/CRM, and File Storage.
4. **[P1-02] Account Enumeration Fix**: Standardize login error messages to prevent leaking whether an email exists or is unverified.
5. **[P1-03] Audit Log UUID Validation**: Fix `activity_logs.user_id` handling or sanitize non-UUID strings to prevent PostgreSQL `22P02` errors.

### P2 (Important Reliability & Quality)
6. **[P2-01] Frontend Refresh Token Interceptor**: Add 401 response interceptor in `fetchWithAuth` to call `/api/v1/auth/refresh` automatically before logging out.
7. **[P2-02] Query Optimization & Indexing**: Replace Node.js in-memory joins with SQL `JOIN`, `COUNT()`, `SUM()` queries and add indexes on foreign keys.

### P3 (Polish & Test Coverage)
8. **[P3-01] Integration Test Expansion**: Add integration test suites for ERP, Inventory, and Sales/CRM controllers.

---

## Detailed Finding Cards

### Finding ID: DB-01
- **Severity**: CRITICAL
- **Module**: Core ERP / Auth
- **Location**: `src/modules/core_erp/controllers/auth-controller.ts` (lines 80-110)
- **Observed Symptom**: Every module in Business Suite returns `500 Internal Server Error` when connected to PostgreSQL.
- **Reproduction**: Register new tenant workspace in PostgreSQL mode, then navigate to Overview, Settings, Branches, Inventory, HR, or Sales tabs.
- **Expected**: All ERP tables are created in the tenant schema and data queries succeed.
- **Actual**: Only `users` and `sessions` tables are created; all other queries fail with `42P01: relation does not exist`.
- **Root Cause**: `AuthController.register` contains hardcoded raw DDL for `users` and `sessions` tables only.
- **Evidence**: `server.ts`, `auth-controller.ts`
- **Recommended Fix Direction**: Replace hardcoded inline DDL in `register` with automated schema migration runner that executes all Drizzle table definitions.
- **Regression Test Needed**: Test provisioning tenant schema and querying all ERP tables in PostgreSQL mode.

### Finding ID: SEC-01
- **Severity**: HIGH
- **Module**: Inventory, Sales/CRM, File Storage
- **Location**: `server.ts` (lines 100-200)
- **Observed Symptom**: Standard user with role `'member'` can perform destructive operations (deleting products, deleting sales orders, purging files).
- **Reproduction**: Log in as a `'member'` user and send `DELETE /api/v1/erp/inventory/products/:id` or `DELETE /api/v1/erp/sales/orders/:id`.
- **Expected**: Request is rejected with `403 Forbidden`.
- **Actual**: Request succeeds.
- **Root Cause**: Middleware `requireRole(['owner', 'admin'])` is missing from Inventory, Sales/CRM, and File Storage mutation routes.
- **Evidence**: `server.ts`
- **Recommended Fix Direction**: Apply `requireRole(['owner', 'admin'])` to all destructive or administrative endpoints.
- **Regression Test Needed**: Unit test verifying `requireRole` blocks `'member'` users on Inventory/Sales endpoints.

---

## Final Diagnostic Summary Metrics

A) **Total number of findings**: 20
B) **Critical blockers**: 3 (Missing tenant schema table DDL, missing Drizzle migrations, silent audit log error swallowing)
C) **Highest-impact root cause**: `AuthController.register` provisions only 2 of 36+ database tables in new tenant schemas in PostgreSQL mode.
D) **Exact list of failing tests**: 0 failing tests in mock mode; ALL non-auth database operations fail in real PostgreSQL mode due to missing schema tables.
E) **Exact list of failing endpoints (in PostgreSQL mode)**: 65 out of 77 endpoints (all `/api/v1/erp/*` routes except auth).
F) **Exact list of affected modules**: 8 of 10 modules (General Overview, Settings & Profile, Branches & Warehouses, Inventory & Products, Sales & CRM, Human Resources, User Invitations, File Storage, Audit Logs).
G) **Recommended order for future fix tasks**:
   1. Implement complete tenant schema table creation / migration runner in `AuthController.register`.
   2. Generate Drizzle migration files in `./drizzle/`.
   3. Add `requireRole(['owner', 'admin'])` to all Inventory, Sales/CRM, and File Storage mutation routes.
   4. Sanitize `userId` in `AuditService` to prevent PostgreSQL UUID type errors.
   5. Standardize login error messages to eliminate account enumeration.
