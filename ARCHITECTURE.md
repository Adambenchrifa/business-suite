# Business Suite: Enterprise Multi-Tenant SaaS Architecture Specification
*Document Author: Lead Software Architect & Product Owner*  
*Classification: Architecture Blueprint*  
*Target Standard: SOC 2 Type II, ISO 27001, GDPR, HIPAA Compliant*

---

## Executive Summary
This document outlines the end-to-end architectural, business, and operational design for **Business Suite**, a next-generation, highly modular, multi-tenant SaaS platform. Business Suite provides enterprise-grade ERP, CRM, HR, inventory, financial, and AI-enabled operations. Designed with a clean-architected modular monolith transitioning into event-driven microservices, it supports million-scale user bases with absolute tenant isolation, offline capabilities, and sub-millisecond real-time sync.

---

## Phase 1: Complete Business Analysis

### 1.1 Market Positioning & Problem Statement
Modern businesses are forced to choose between highly fragmented, specialized SaaS point solutions (which introduce severe integration friction and data silos) and massive, legacy ERP systems (which are expensive, slow to implement, and non-modular).
**Business Suite** bridges this gap. It provides a unified ecosystem where every module (ERP, CRM, HR, Inventory, Finance) operates independently with its own database boundaries and APIs, yet integrates seamlessly.

### 1.2 Problem vs. Solution Matrix
*   **The Fragmented Stack Problem:** High API maintenance costs, mismatched user experiences, and disjointed data pipelines.
    *   *Business Suite Solution:* A single, unified, modular core. Common design system, single identity provider, and standard messaging backbone.
*   **The Legacy Rigidity Problem:** Monolithic ERP deployments that take years to configure.
    *   *Business Suite Solution:* Independent, plug-and-play modules that can be activated on-demand via tenant entitlement management.
*   **The Tenant Security/Compliance Problem:** Sharing data spaces in multi-tenant environments raises security alarms.
    *   *Business Suite Solution:* Strict logical database-per-tenant schemas, cryptographic tenant keys, and robust row/field-level access control.

### 1.3 Modular Monetization & Business Model
*   **Core Tier:** Free or low-cost base access containing standard collaboration and directory services.
*   **Modular Upsells (Pay-per-Module):** Users pay only for modules they use (e.g., Inventory, Advanced Finance, Custom AI).
*   **Seat-Based + Usage-Based Hybrid Model:** Subscriptions are calculated based on the number of active users, plus metered consumption metrics (e.g., GB of file storage, number of AI API requests, volume of invoices processed).

### 1.4 Target Customer Persona & Segmentation
*   **Mid-Market Enterprises ($10M–$100M ARR):** Requiring modular expansion, custom workflows, and unified compliance without the cost of a SAP or Oracle deployment.
*   **Fast-Growing Scaleups:** Needing an infrastructure that scales organically with their hiring, warehouse footprint, and product offerings.

### 1.5 Unit Economics & Operational Margins
*   **LTV-to-CAC Ratio Target:** > 4:1 through aggressive, self-serve onboarding, low integration churn, and automatic cross-module upselling.
*   **Gross Margin Target:** > 80% maintained by utilizing scale-to-zero serverless backends (Cloud Run), aggressive Redis caching, and optimized LLM token caching (Gemini Context Caching).

---

## Phase 2: Complete Feature List

```
┌───────────────────────────────────────────────────────────────────────────┐
│                           BUSINESS SUITE PLATFORM                         │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
         ┌───────────────┬────────────┴──┬────────────────┬──────────────┐
         ▼               ▼               ▼                ▼              ▼
    ┌─────────┐     ┌─────────┐     ┌─────────┐      ┌─────────┐    ┌─────────┐
    │  Core   │     │  Sales  │     │ Human   │      │ Supply  │    │ Finance │
    │   ERP   │     │  & CRM  │     │ Capital │      │  Chain  │    │ & Billing│
    └─────────┘     └─────────┘     └─────────┘      └─────────┘    └─────────┘
```

### 2.1 Core ERP & Collaboration Module
*   **Workspace & Org Chart Directory:** Interactive structural visualizer of reporting lines, department groupings, and physical offices.
*   **Unified Activity Feed:** Real-time stream aggregating updates across all activated modules.
*   **Global Search Engine:** Federated search using Elasticsearch/PostgreSQL hybrid vectors to locate entities (invoices, contacts, staff, items) instantly.

### 2.2 Sales & CRM Module
*   **Pipeline Management:** Drag-and-drop Kanban boards with customizable pipeline stages and probability weights.
*   **360° Customer Profile:** Consolidated view of contact details, interaction history, support tickets, invoices, and sent emails.
*   **Lead Scoring Engine:** Machine-learning-based lead qualification relying on interaction frequency, velocity, and firmographic data.

### 2.3 Human Capital Management (HCM) Module
*   **Employee Directory & Lifecycle Tracker:** Automated onboarding/offboarding workflows, contract management, and personal records.
*   **Time, Attendance & Leave Management:** Timecard clock-in/out tracking with geolocation fencing and automated multi-level leave approvals.
*   **Performance & Goals (OKRs):** Company, team, and individual OKR tracking with continuous 360-degree feedback loops.

### 2.4 Supply Chain & Inventory Module
*   **Multi-Warehouse Inventory Tracking:** Stock level monitors across physical sites, virtual locations, and transit stages.
*   **Automated Purchase Order Workflows:** Reorder-point thresholds that automatically generate and route draft purchase orders to vendors.
*   **Batch & Serial Number Tracking:** Complete genealogical tracking of individual units for recall safety and warranty claims.

### 2.5 Finance, Invoicing, & Billing Module
*   **General Ledger & Chart of Accounts:** Double-entry bookkeeping system with automatic journal generation from platform events.
*   **Billing & Subscription Engine:** Automated invoicing, dynamic recurring charges, multi-currency support, and dunning workflows.
*   **Expense & Reconciliation Management:** OCR-driven receipt scanning and automated bank feed transaction matching.

### 2.6 AI Insights & Automation Module
*   **Smart Report Generation:** LLM-powered natural language queries converting complex data into visual executive summaries.
*   **Anomaly Detection:** Real-time flags on unusual financial transactions, supply drops, or attendance reports.

---

## Phase 3: User Roles & Permissions

### 3.1 Multi-Tenant Role Hierarchy

```
       [ Super Admin ]  (Platform Owner Level)
              │
              ▼
       [ Tenant Owner ] (Company Level - Full Control)
              │
              ├─────────────────────────┐
              ▼                         ▼
     [ Module Admin ]            [ Department Lead ]
              │                         │
              ▼                         ▼
       [ Staff Member ]          [ External Contractor ]
              │
              ▼
         [ Guest ]
```

### 3.2 Granular RBAC & ABAC Matrices

*   **Super Admin (Platform Owner):** Total control over all database clusters, tenant provisioning, system configurations, and billing plans.
*   **Tenant Owner (Company Owner):** Full access inside their tenant boundary. Can provision modules, manage company-wide billing, and assign user roles.
*   **Module Admin (e.g., HR Director, Inventory Manager):** Full write/execute access strictly within the assigned module scope. No visibility into raw financial ledger tables unless explicitly cross-permissioned.
*   **Staff Member:** Read-only access to corporate directories, direct time tracking, personal task management, and basic sales pipelines.
*   **External Partner / Guest:** Restricted access to specific projects, invoices, or delivery orders via pre-signed, temporary session portals.

### 3.3 Row-Level & Field-Level Access Rules (ABAC)
Attribute-Based Access Control (ABAC) restricts data access at a granular level based on context:
*   *Row-Level Security:* A sales representative can only view deals they own, or deals belonging to their regional office code.
*   *Field-Level Security:* Basic staff members can view an employee's department and work email, but cannot view their home address, social security number, or base salary fields.

---

## Phase 4: Database Architecture

```
                      [ Tenant Router API Gateway ]
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│     Tenant A     │       │     Tenant B     │       │     Tenant C     │
│  Schema Isolation│       │  Schema Isolation│       │  Schema Isolation│
│  ┌────────────┐  │       │  ┌────────────┐  │       │  ┌────────────┐  │
│  │ Core Schema│  │       │  │ Core Schema│  │       │  │ Core Schema│  │
│  ├────────────┤  │       │  ├────────────┤  │       │  ├────────────┤  │
│  │ CRM Schema │  │       │  │ CRM Schema │  │       │  │ CRM Schema │  │
│  ├────────────┤  │       │  ├────────────┤  │       │  ├────────────┤  │
│  │ HR Schema  │  │       │  │ HR Schema  │  │       │  │ HR Schema  │  │
│  └────────────┘  │       │  └────────────┘  │       │  └────────────┘  │
└──────────────────┘       └──────────────────┘       └──────────────────┘
```

### 4.1 Tenant Isolation Strategy
We utilize a **Shared Database, Isolated Schemas** architecture as our primary standard for cost-efficiency and performance, scaling to a **Database-Per-Tenant** model for high-tier Enterprise customers.

1.  **Logical Schema Separation (PostgreSQL):** Each tenant has a dedicated PostgreSQL schema (`tenant_xyz`). This provides strict table namespaces and prevents accidental cross-tenant queries.
2.  **Connection Routing:** The API Gateway inspects the incoming request context (`X-Tenant-Id` or sub-domain), resolves the connection details from a primary configuration metadata catalog, and routes queries with the correct schema search path context.

### 4.2 Module Database Boundaries (Domain-Driven Design)
To prevent tight coupling, each module maintains logical separation within the tenant schema:
*   `tenant_xyz.core_users`
*   `tenant_xyz.crm_deals`
*   `tenant_xyz.hr_employees`
*   `tenant_xyz.inventory_items`
*   `tenant_xyz.billing_invoices`

Inter-module queries are strictly forbidden. If the CRM module requires billing status, it must request it through an internal REST API or subscribe to an event published by the Billing service on the message bus.

### 4.3 Schema Migration Strategy
*   **Drizzle ORM & Migrator:** DB changes are defined via declarative schema definitions.
*   **Blue-Green Migration Pipelines:** Migration scripts run in backwards-compatible phases:
    1.  *Phase 1:* Add new nullable column.
    2.  *Phase 2:* Deploy application code that writes to both old and new columns.
    3.  *Phase 3:* Backfill existing data using background worker tasks.
    4.  *Phase 4:* Deploy code that uses only the new column.
    5.  *Phase 5:* Drop old column.
*   **Schema Versioning Table:** A central orchestrator tracks the applied schema migrations across thousands of isolated tenant namespaces, updating them in batched, throttled waves to prevent performance drops.

### 4.4 Replication, Partitioning, and Connection Pooling
*   **Multi-Region Read Replicas:** Read queries are distributed to local read replicas matching the tenant's geo-region. Writes are routed to the regional primary instance.
*   **Sharding & Partitioning:** Massive tables (e.g., event logs, ledger lines) are partitioned by month and sub-partitioned by tenant ID hash.
*   **PgBouncer / Pool Orchestrators:** Scaled container pods use localized PgBouncer sidecars to manage stable, high-throughput connection pooling without exhausting database socket limits.

---

## Phase 5: Backend Architecture

### 5.1 Clean Architecture / Domain-Driven Design (DDD)
The backend is structured under Clean Architecture principles to keep business logic completely isolated from external frameworks, databases, and UI layers.

```
┌────────────────────────────────────────────────────────┐
│                      Infrastructure                    │
│   (Database, Express Routes, WebSockets, Gemini SDK)   │
│      ┌──────────────────────────────────────────┐      │
│      │               Presentation               │      │
│      │          (Controllers, Payloads)         │      │
│      │      ┌────────────────────────────┐      │      │
│      │      │         Application        │      │      │
│      │      │  (Use Cases, Query/Cmds)   │      │      │
│      │      │      ┌──────────────┐      │      │      │
│      │      │      │    Domain    │      │      │      │
│      │      │      │  (Entities,  │      │      │      │
│      │      │      │   Value Obj) │      │      │      │
│      │      │      └──────────────┘      │      │      │
│      │      └────────────────────────────┘      │      │
│      └──────────────────────────────────────────┘      │
└────────────────────────────────────────────────────────┘
```

#### 5.1.1 Layers Explanation
1.  **Domain Layer (Inner-most):** Contains enterprise business rules, pure entities, value objects, domain exceptions, and domain event definitions. No external dependencies.
2.  **Application Layer:** Contains application-specific use cases, handlers, interfaces (e.g., repository interfaces), and commands/queries.
3.  **Presentation Layer:** Translates raw external network payloads (HTTP, JSON) into application commands/queries.
4.  **Infrastructure Layer (Outer-most):** Direct database implementations (Drizzle/Pg), external API integrations, message brokers (Redis, RabbitMQ), and environment setups.

### 5.2 Microservices vs. Modular Monolith
To optimize initial deployment speed and developer experience, Business Suite is developed as a **Modular Monolith** using logical modular packaging.
*   Every module is strictly packaged inside a specific subdirectory (`src/modules/*`).
*   Communications between modules must cross a clearly defined application interface, preventing deep object graph coupling.
*   This design enables a seamless transition into fully isolated, decoupled microservices. As load on the Inventory module spikes, the `src/modules/inventory` directory can be easily extracted into a standalone container service with zero refactoring of its core business logic.

---

## Phase 6: Frontend Architecture

### 6.1 Modular UI & Core Micro-Frontend Topology
The UI is built with React 19, Vite, and Tailwind CSS. The interface is optimized to act as a single-page portal, dynamically loading active module interfaces on-demand.

```
                  [ Single SPA Shell / Router ]
                                │
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Core Module   │    │   CRM Module    │    │    HR Module    │
│  Lazy-Loaded    │    │  Lazy-Loaded    │    │  Lazy-Loaded    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

*   **Dynamic Bundle Splitting:** Vite is configured with advanced rollup options to partition each module into isolated, lazy-loaded chunks (`/src/modules/crm/ui/`, `/src/modules/hr/ui/`).
*   **Central Layout Shell:** A persistent UI frame managing global navigation, system health signals, multi-tenant workspace switching, profile menus, and active background sync statuses.

### 6.2 State Management & Client-Side Cache
*   **Core UI State (Local & Transient):** Standard React state and Context providers handle UI layout flags (sidebar toggle, dark mode, current tab).
*   **Server-State Caching (TanStack Query):** Handles all asynchronous HTTP queries. Features aggressive automatic refetch thresholds, smart optimistic updates, and modular query keys (e.g., `['tenants', tenantId, 'crm', 'deals']`).
*   **Local Event Pipeline:** Simple listener hooks that update cached queries whenever background WebSocket events indicate a record change.

### 6.3 Performance Optimization Strategy
*   **Component Virtualization:** High-density lists (e.g., ERP transaction ledgers, inventory tables) are virtualized via `react-window` to maintain high rendering speeds for large datasets.
*   **Tree Shaking:** Explicit modular imports from `lucide-react` and component suites to minimize JS bundle footprint.
*   **Layout Stability:** Explicit container layouts paired with structural loading skeleton frameworks to eliminate layout shift during async data hydration.

---

## Phase 7: Folder Structure

The project workspace uses a highly disciplined, modular structure. Every module contains its own Clean Architecture layers, ensuring independent evolution and ease of extraction.

```
/
├── .env.example                # Canonical system environment template
├── .gitignore                  # Development exclusions
├── index.html                  # Core single-page entry point
├── metadata.json               # Platform configuration & capability settings
├── package.json                # Explicit platform dependencies & scripts
├── tsconfig.json               # Modular compilation paths
├── vite.config.ts              # Bundling configurations, proxy layers, alias settings
│
└── src/
    ├── main.tsx                # Client bootstrapper
    ├── index.css               # Global Tailwind CSS imports
    │
    ├── config/                 # Shared system application configurations
    │   ├── firebase.ts         # Authentication configuration
    │   └── environment.ts      # Structured environment validation variables
    │
    ├── shared/                 # Reusable cross-module system elements
    │   ├── domain/             # Reusable Domain primitives (Entity, ValueObject, ID)
    │   ├── components/         # Shared visual components (Tables, Inputs, Modals)
    │   ├── utils/              # Cryptographic, date, and math utilities
    │   └── api/                # Core HTTP Client client wrapper
    │
    ├── server.ts               # Full-Stack entry point (Express, Vite Dev Middleware)
    │
    └── modules/                # MODULAR DOMAINS (Fully isolated, independent architectures)
        ├── core_erp/           # Core Module Blueprint
        │   ├── domain/         # Entities, Value Objects, Domain Exceptions
        │   ├── application/    # Use Cases, Command/Query handlers, interfaces
        │   ├── infrastructure/ # DB Tables, Drizzle Repositories, API Clients
        │   ├── controllers/    # API Controllers, Payload Schemas, DTOs
        │   └── ui/             # React views, Modular components, hooks
        │
        ├── crm/                # CRM Module Directory
        │   ├── domain/
        │   ├── application/
        │   ├── infrastructure/
        │   ├── controllers/
        │   └── ui/
        │
        ├── hcm/                # HR Module Directory
        │   ├── domain/
        │   ├── application/
        │   ├── infrastructure/
        │   ├── controllers/
        │   └── ui/
        │
        ├── inventory/          # Inventory Module Directory
        │   ├── domain/
        │   ├── application/
        │   ├── infrastructure/
        │   ├── controllers/
        │   └── ui/
        │
        └── billing/            # Finance & Billing Module Directory
            ├── domain/
            ├── application/
            ├── infrastructure/
            ├── controllers/
            └── ui/
```

---

## Phase 8: API Architecture

```
                       [ Incoming Client Request ]
                                    │
                                    ▼
                        [ Cloud Armor / Web Application Firewall ]
                                    │
                                    ▼
                        [ Kong / Envoy API Gateway ]
                     (Auth, Rate Limit, Tenant Router)
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│  CRM Micro-API   │       │   HR Micro-API   │       │Billing Micro-API │
│ /api/v1/crm/*    │       │ /api/v1/hcm/*    │       │/api/v1/billing/* │
└──────────────────┘       └──────────────────┘       └──────────────────┘
```

### 8.1 API Gateway Core Responsibilities
All external system interactions enter via a reverse proxy API Gateway:
*   **Authentication Validation:** Checks JWT bearer tokens.
*   **Tenant Mapping:** Reads subdomains (e.g., `acme.business-suite.com`) or custom request headers (`X-Tenant-ID`) to append correct tenant routing metadata to request headers.
*   **Rate Limiting:** Protects the platform using localized IP-based and tenant-based rate limits.

### 8.2 Protocol Design: REST & gRPC Boundaries
*   **North-South Traffic (Client-to-Server):** REST API with JSON payloads is used for broad client compatibility. Every endpoint is fully self-documenting via OpenAPI/Swagger specs generated automatically by route decorators.
*   **East-West Traffic (Internal Microservices):** Standard internal requests (such as HR checking current subscription caps from the Billing module) are executed over ultra-fast, low-overhead **gRPC** protocols using Protobuf definitions.

### 8.3 Rate Limiting, Versioning & Schema Contracts
*   **API Versioning Strategy:** Managed explicitly via URL pathing (e.g., `/api/v1/crm/deals`). Breaking changes generate a `/v2/` prefix, keeping old routes active for a defined sunset deprecation period.
*   **Sliding Window Rate Limiter:** Implemented in Redis to prevent tenant-wide or IP-wide service exhaustion:
    *   *Free/Trial tier:* Maximum 60 requests per minute per IP.
    *   *Enterprise tier:* Up to 5000 requests per minute.
*   **Strict Payload Contracts:** All payloads are validated using declarative runtime schemas (e.g., Zod). Non-compliant JSON returns structured validation errors (`422 Unprocessable Entity`) detailing the missing fields.

---

## Phase 9: Authentication & Permissions

### 9.1 Multi-Tenant Federated Identity (SSO / OIDC)
Identity is managed via a dedicated, secure Identity Provider (IdP) (such as Google Identity Platform, Firebase Auth, or Auth0) supporting SAML and OIDC. This allows enterprise tenants to federate authentications to their corporate directory systems (such as Okta, Azure AD, or Google Workspace).

### 9.2 Token Anatomy & Cryptographic Signing
Authentication issues highly secure JSON Web Tokens (JWT) signed using asymmetrical keys (`RS256`).

```json
{
  "iss": "https://auth.business-suite.com",
  "sub": "user_987654321",
  "exp": 1785528000,
  "tenant_id": "tenant_acme_prod_01",
  "role": "TenantOwner",
  "permissions": [
    "crm:deals:create",
    "crm:deals:update",
    "billing:invoices:read",
    "hr:employees:read"
  ],
  "user_metadata": {
    "email": "owner@acme.com",
    "department_id": "dept_hq_exec"
  }
}
```

### 9.3 Cryptographic Tenant Isolation Verification
To completely prevent Cross-Tenant Data Leakage (OWASP Top 10), every database operation must undergo security filtering:
*   Every SQL statement constructed by Drizzle ORM automatically appends a schema search path prefix or matches the `tenant_id` from the verified JWT payload.
*   The middleware checks the current tenant ID extracted from the token signature against the database path. If a mismatch is detected, the request is instantly terminated, the session is revoked, and a high-priority security alert is logged in our SIEM stack.

---

## Phase 10: Realtime Synchronization

```
┌──────────────┐         [ WebSockets / WSS ]         ┌────────────────┐
│              ├─────────────────────────────────────►│                │
│ React Client │                                      │ Express Server │
│              │◄─────────────────────────────────────┤                │
└──────────────┘           [ Redis Pub/Sub ]          └───────┬────────┘
                                                              │
                                                              ▼
                                                      [ Redis Cluster ]
```

### 10.1 Realtime Communication Topology
We implement a robust WebSockets (WSS) pipeline to handle instantaneous updates (such as visual chat updates, dynamic project progress bars, and shared multi-user canvas boards).
*   **Scale-Out Strategy (Redis Pub/Sub):** When scaled across multiple container instances, server instances communicate using a shared Redis Pub/Sub cluster. When Server A receives a data update for Tenant ACME, it publishes a message onto the Redis channel `tenant:acme`. All active instances pick up this message and push the update down the respective active client sockets.

### 10.2 Conflict Resolution: Eventual Consistency & OT/CRDTs
For simultaneous multi-user data inputs (e.g., collaborative OKR updates or shared supply chain spreadsheets):
*   **Structured Fields:** Uses Conflict-free Replicated Data Types (CRDTs) to reconcile text edits and status flags asynchronously.
*   **State Overwrite Resolution:** Uses "Last-Write-Wins" (LWW) timestamp registers mapped to standard server-authenticated database clocks for database records.

---

## Phase 11: Offline Support

### 11.1 Client Offline Architecture
To support logistics personnel inside remote warehouses, field sales agents traveling on planes, and active HR teams on unstable networks, Business Suite implements a fully autonomous client-side offline operation state.

```
┌────────────────────────────────────────────────────────┐
│                      Client Web Browser                │
│                                                        │
│  ┌────────────────────────┐    ┌────────────────────┐  │
│  │   React UI Components  │◄──►│ TanStack Cache /   │  │
│  └───────────┬────────────┘    │ React State        │  │
│              │                 └─────────┬──────────┘  │
│              ▼                           ▼             │
│  ┌────────────────────────┐    ┌────────────────────┐  │
│  │     Service Worker     │◄──►│ IndexedDB Offline  │  │
│  │  Interceptors / Sync   │    │ SQLite Web Assembly│  │
│  └────────────────────────┘    └────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### 11.2 Offline Synchronization & Reconciliation Engine
1.  **Request Capture:** A background **Service Worker** intercepts outbox API requests when the client is disconnected.
2.  **Queue Serialization:** Outbox actions (e.g., `CREATE_LEAD`, `UPDATE_INVENTORY`) are saved locally to an IndexedDB synchronization queue, tagged with sequential sequence IDs.
3.  **Optimistic UI Layer:** The UI instantly transitions values on screen, marking them with an "Unsent/Pending" badge to provide transparent user feedback.
4.  **Reconnection Catch-up:** Once the browser fires the `online` state trigger, the service worker locks the sync queue, flushes transactions sequentially to `/api/v1/sync/flush` to keep execution order, and clears the local queue once the backend returns success confirmation.

---

## Phase 12: Notifications

### 12.1 Multi-Channel Dispatch Backbone

```
                         [ System Event Emitted ]
                                    │
                                    ▼
                           [ Redis Event Queue ]
                                    │
                                    ▼
                     [ Notification Dispatcher Worker ]
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│  In-App Visual   │       │ Email Generator  │       │ Push Integrator  │
│ WebSocket/Inbox  │       │  Resend / SES    │       │   APNS & FCM     │
└──────────────────┘       └──────────────────┘       └──────────────────┘
```

### 12.2 Priority Queueing & Delivery Guarantees
*   **Message Broker (BullMQ / Redis):** Outbox notifications are dropped into a highly responsive worker queue. Jobs are picked up by independent consumer worker containers.
*   **Delivery Rules:**
    *   *High Priority (e.g., Password resets, critical inventory drops):* Dispatched instantly with zero delay.
    *   *Medium Priority (e.g., CRM assignment alerts, billing updates):* Batched over 5-minute intervals.
    *   *Low Priority (e.g., Weekly OKR summaries, analytics reports):* Batched and delivered during the tenant's localized non-working hours.

---

## Phase 13: File Storage

### 13.1 Storage Architecture & Security
All uploaded assets (documents, company logos, product images, expense receipts) are stored securely in cloud object storage (such as Google Cloud Storage or AWS S3).
*   **Tenant Bucket Segmentation:** To prevent cross-company access, buckets are divided logically by tenant paths (`bucket/tenants/tenant_id/`).
*   **Zero Public Access:** Access is completely private. The client must request a temporary, signed authorization link (`pre-signed URL`) with an expiration of 15 minutes to retrieve or write files.

### 13.2 File Pipeline Optimization
*   **On-the-Fly Optimization:** Images are automatically processed, resized, and optimized to next-gen formats (WebP) to save bandwidth on mobile devices.
*   **Malware & Virus Scan Integrations:** Upload actions trigger a background worker that runs ClamAV or equivalent scans before confirming the file is safe to display to the company.

---

## Phase 14: Reporting Engine

### 14.1 OLTP vs. OLAP Separation
Executing heavy analytical reports on the primary transaction database (OLTP) during work hours degrades system performance. Business Suite splits transaction and analytics processing to ensure constant responsiveness.

```
┌─────────────────────┐                  ┌─────────────────────┐
│  OLTP PostgreSQL    ├─────────────────►│   OLAP Data Lake    │
│  (Write-Optimized)  │   CDC / Debezium │ (Read-Optimized/dbt)│
└─────────────────────┘                  └─────────────────────┘
```

*   **Change Data Capture (CDC):** Write actions to the primary database stream to a column-oriented analytical database (such as BigQuery or ClickHouse) using modern tools (such as Debezium or batched pipelines).
*   **Pre-computed Materialized Views:** Common aggregates (e.g., Monthly Sales Volumes, Average HR Turnover) are pre-calculated every hour and cached in Redis.

### 14.2 Custom Query & Export Builder
*   **Drag-and-Drop Query Pipeline:** Users can build custom charts dynamically by pairing filters, dimensions, and visual metrics.
*   **High-Volume Export Engine:** Generates highly complex formats (PDF, Excel, CSV) safely inside serverless background workers, protecting the main server thread from CPU exhaustion.

---

## Phase 15: Billing & Subscriptions

### 15.1 Stripe Billing Integration Architecture
The subscription backbone handles payment processing, metered metrics, and localized pricing with deep resiliency.

```
┌──────────────────┐               ┌──────────────────┐
│  Stripe Webhook  ├──────────────►│  Billing Worker  │
│  (Events Loop)   │               │  (DB Updates)    │
└──────────────────┘               └────────┬─────────┘
                                            ▼
                                   ┌──────────────────┐
                                   │ Entitlement DB   │
                                   │ (Enables Modules)│
                                   └──────────────────┘
```

*   **Webhook Resilience:** Webhook handlers save the raw transaction event payloads directly to the database before processing them, protecting the platform against webhook failures during transient connection drops.
*   **Automatic Entitlement Sync:** When a webhook confirms a payment, our Entitlements Engine immediately updates the tenant's permissions table, instantly activating or deactivating modular paths.

### 15.2 Metered Consumption & Dunning Workflows
*   **Consumption Logs:** Services write usage records (e.g., inventory transactions, AI requests) to an event stream. A daily aggregator sums usage and updates Stripe's billing records automatically.
*   **Automated Dunning:** Failed payments trigger customizable email notifications and place accounts into a temporary "Grace Period." If unresolved, the subscription is downgraded, and access is restricted to read-only mode.

---

## Phase 16: AI Integration Layer

```
                        [ User Query Interface ]
                                   │
                                   ▼
                         [ AI Gateway Service ]
                 (Inspects Tokens & Tenant Metadata)
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
┌──────────────────┐                                ┌──────────────────┐
│  Vector DB       │                                │  Google GenAI    │
│  (PgVector RAG)  │◄──► [ Embeds Document Context] │  Gemini SDK      │
└──────────────────┘                                └──────────────────┘
```

### 16.1 AI Architecture & Grounding
Business Suite implements the state-of-the-art `@google/genai` TypeScript SDK on our backend servers.
*   **RAG (Retrieval-Augmented Generation):** To ensure relevant, hallucination-free answers, internal documents (e.g., HR handbook PDF uploads, internal wiki pages) are sliced into text chunks, embedded via Gemini embedding models, and saved inside a `pgvector` enabled database.
*   **Smart Query Flow:** When a user queries, the server fetches matching chunks from the database, builds a grounded context, and sends it to the Gemini model to get an accurate answer.

### 16.2 Token Caching & Safety Guardrails
*   **Context Caching:** Standardized prompts (such as large employee guides or monthly ledger records) leverage Gemini's context caching to reduce API latency and slash token billing.
*   **PII & Compliance Guardrails:** Before payloads leave the platform to the LLM endpoint, a server-side compliance filter automatically redacts sensitive data (such as social security numbers, individual salary values, and credit card numbers).

---

## Phase 17: Deployment Architecture

The platform runs on a robust, multi-region cloud infrastructure (such as Google Cloud Platform) to maximize uptime and reduce latency.

```
                        [ Global Load Balancer ]
                               (Anycast IP)
                                    │
         ┌──────────────────────────┴──────────────────────────┐
         ▼                                                     ▼
┌──────────────────┐                                  ┌──────────────────┐
│  Europe West 1   │                                  │  US Central 1    │
│  Cloud Run Pods  │                                  │  Cloud Run Pods  │
│  ┌────────────┐  │                                  │  ┌────────────┐  │
│  │ API Node   │  │                                  │  │ API Node   │  │
│  ├────────────┤  │                                  │  ├────────────┤  │
│  │ App Node   │  │                                  │  │ App Node   │  │
│  └────────────┘  │                                  │  └────────────┘  │
└────────┬─────────┘                                  └────────┬─────────┘
         │                                                     │
         └──────────────────────────┬──────────────────────────┘
                                    ▼
                         [ Cloud SQL PostgreSQL ]
                         (With regional replicas)
```

### 17.1 Cloud Run Auto-Scaling Metrics
*   **Dynamic Scaling:** Application nodes auto-scale based on concurrent request counts. They scale down to zero instances during quiet hours, reducing server costs to $0.
*   **Multi-Region Deployment:** Deployment nodes are replicated in key regional zones (e.g., `us-central1` and `europe-west1`) to keep request response times under 50ms worldwide.

### 17.2 CI/CD Deployment Pipeline
Every commit runs through automated testing pipelines:
1.  **Continuous Integration:** Triggered on GitHub PRs. Runs ESLint, TypeScript compilation, and Unit/Integration tests.
2.  **Continuous Deployment (Staged Release):** Builds container images, publishes to Artifact Registry, and performs canary rollouts (e.g., 5% -> 25% -> 100%) to production servers.

---

## Phase 18: Security Architecture

### 18.1 Key Management & Secret Protection
*   **Envelope Encryption:** Critical database values (such as OAuth tokens, employee data) are encrypted at rest using local data keys. These keys are protected by an external key management service (such as Google Cloud KMS).
*   **No Hardcoded Secrets:** Infrastructure keys are injected dynamically at runtime from secure secrets storage, completely bypassing source repositories.

### 18.2 Compliance Alignments
*   **SOC 2 Type II:** Continuous audit monitoring via platform trackers (e.g., Vanta, Drata). Complete logs are captured on all structural changes, admin logins, and billing modifications.
*   **GDPR compliance:** Complete implementation of the "Right to be Forgotten" via automated cascading tenant deletion jobs, and localized hosting zones to meet data residency rules.

---

## Phase 19: Scalability Strategy

To scale cleanly to millions of users, Business Suite enforces a multi-tiered scaling strategy:

1.  **Stateless API Nodes:** Server containers do not save internal session records. All state remains in distributed cache clusters (Redis) or databases, allowing us to spin up and shut down containers instantly.
2.  **Edge Caching (CDN):** Static bundles, layout resources, and common images are cached across global edge servers to reduce load on origin nodes.
3.  **Read/Write Split:** Read-heavy services utilize read replicas, keeping primary nodes free to process transactions.
4.  **Database Sharding:** As tenant databases grow, tenants are partitioned across multiple physical database instances based on their tenant plan or location, preventing resource bottlenecks.

---

## Phase 20: Roadmap from MVP to Enterprise

```
                                  [ Phase B ]
                                  Scale Scaling
                                  (Drizzle/Redis,
                                   Edge CDNs, ABAC)
                                         ▲
                   [ Phase A ]           │
                   MVP Launch            │
                   (Single DB, ───►──────┘
                    Clean Arch,
                    REST Core)
```

### 20.1 Milestones & Timeline
*   **Milestone 1: The Core MVP (Months 1–3):** Single database cluster with multi-tenant schema separation, core ERP, CRM, and basic HR modules.
*   **Milestone 2: Optimization & Realtime (Months 4–6):** Integration of redis-backed caching, WebSockets synchronization, background queues, and metered billing.
*   **Milestone 3: Advanced AI & Analytics (Months 7–9):** Multi-region analytical data lakes, fully-grounded Gemini RAG capabilities, and custom analytical reporting builders.
*   **Milestone 4: Enterprise Scale & Compliance (Months 10–12):** ISO 27001 and SOC 2 Type II certifications, database sharding, OIDC/SAML corporate single sign-on support, and 99.99% SLA targets.

### 20.2 Technical Debt Management & Engineering Governance
*   **Architecture Decision Records (ADRs):** All major infrastructure deviations are logged using ADR files inside `/docs/adr` to keep a clear history of decision making.
*   **Automated Security Scans:** Every commit runs through static analysis tools (SonarQube) to catch security flaws and code quality drops before they reach production.
