# Business Suite: API Architecture, Event Systems & Real-time Synchronization
*Document Classification: Technical Specification*  
*Target Standard: OpenAPI 3.1, JSON:API, RFC 6455 (WebSockets)*

---

## 1. Complete API Gateway & Routing Model

All client operations execute through a highly resilient, low-latency API Gateway. 

```
                                [ CLIENT APPLICATION ]
                                          │ (HTTPS / WSS)
                                          ▼
                               ┌──────────────────────┐
                               │  Kong / Envoy Edge   │
                               │  API Gateway         │
                               └──────────┬───────────┘
                                          │
         ┌────────────────────────────────┼────────────────────────────────┐
         ▼ (Proxy Route)                  ▼ (gRPC / Internal)              ▼ (Real-time Sync)
┌──────────────────┐             ┌──────────────────┐             ┌──────────────────┐
│   Auth Service   │             │  Module Services │             │ WebSocket Worker │
│  /api/v1/auth    │             │  /api/v1/*       │             │  wss://stream/   │
└──────────────────┘             └──────────────────┘             └──────────────────┘
```

### 1.1 Gateway Directives
*   **SSL Termination & Edge Caching:** TLS 1.3 encryption is handled at the gateway layer.
*   **Tenant Resolution Middleware:** Translates incoming subdomains (e.g., `acme.business-suite.com`) or header injections (`X-Tenant-Id`) into verified tenant identifier contexts.
*   **Dynamic Response Compression:** Automatically applies Brotli/Gzip compression to payloads larger than 1KB.

---

## 2. Authentication & Authorization Flow

Identity verification relies on an asymmetric Token-based Federated Single Sign-On (SSO) architecture.

### 2.1 Multi-Tenant SSO Flow Sequence

```
[ Client Browser ]          [ API Gateway ]            [ Identity Provider ]       [ Tenant Database ]
        │                          │                             │                          │
        │─── 1. Authenticate ─────►│                             │                          │
        │    (SAML/OIDC/UserPass)  │─── 2. Validate Creds ──────►│                          │
        │                          │◄── 3. Return Auth Token ────│                          │
        │◄── 4. Set Session Cookie │                             │                          │
        │    (HTTP-Only JWT)       │                             │                          │
        │                          │                             │                          │
        │─── 5. Request Deal Data ─►│                             │                          │
        │    (Cookie Attached)     │─── 6. Authenticate JWT ─────┼─────────────────────────►│
        │                          │    & Bind DB Search Path    │                          │ (Execute Query)
        │◄── 7. Return Records ────│◄────────────────────────────┼──────────────────────────│
```

### 2.2 Token Management Rules
*   **Access Token (JWT):** Expires after 15 minutes. Contains tenant metadata, active user roles, and fine-grained authorization scopes (RBAC).
*   **Refresh Token:** Saved securely in an HTTP-only, secure, SameSite=Strict cookie with rotation enabled on every exchange.

### 2.3 Fine-Grained Permission Verification (ABAC / RBAC)
*   *Declarative Decorator Pattern:* Controllers use strict decorators to intercept execution:
    ```typescript
    @HasPermission("crm:deals:write")
    @FilterByTenant()
    async createDeal(payload: CreateDealDto) { ... }
    ```

---

## 3. Comprehensive REST Endpoint Schema

All responses follow the standardized JSON:API format to ensure consistent pagination, sorting, and error delivery.

### 3.1 Key Endpoints Directory

| Method | Path | Authentication | Scopes | Description |
| :--- | :--- | :--- | :--- | :--- |
| **POST** | `/api/v1/auth/login` | Public | None | Generates new JWT & session cookies |
| **POST** | `/api/v1/auth/refresh` | Public | None | Rotates access token via secure refresh token cookie |
| **GET** | `/api/v1/crm/deals` | JWT | `crm:deals:read` | Lists tenant deals. Supports pagination & sorting |
| **POST** | `/api/v1/crm/deals` | JWT | `crm:deals:write` | Creates a new pipeline sales deal |
| **GET** | `/api/v1/inventory/items` | JWT | `inventory:items:read`| Scans active warehouse items |
| **PATCH** | `/api/v1/inventory/items/:id`| JWT | `inventory:items:write`| Updates stock limits, reorder levels, and pricing |
| **POST** | `/api/v1/billing/invoices` | JWT | `billing:invoices:write`| Generates automated financial tenant invoice |

### 3.2 Standard JSON:API Response Envelope
```json
{
  "jsonapi": { "version": "1.0" },
  "data": {
    "type": "deals",
    "id": "e8b2b711-cb23-4903-88bb-80cd1e21b79f",
    "attributes": {
      "title": "Enterprise ERP Expansion Deal",
      "value": 150000.00,
      "currency": "USD",
      "status": "open"
    },
    "relationships": {
      "customer": {
        "data": { "type": "customers", "id": "908d13b4-f3c2-466d-a77e-ecde20579e00" }
      }
    }
  },
  "links": {
    "self": "https://api.business-suite.com/api/v1/crm/deals/e8b2b711-cb23-4903-88bb-80cd1e21b79f"
  }
}
```

---

## 4. WebSocket (WSS) Synchronization Engine

To support instantaneous cross-user state propagation, collaboration, and live notifications, we deploy a high-throughput, scale-out WebSocket manager.

```
┌──────────────────┐               ┌──────────────────┐
│   React Client   ├◄─ WebSocket ─►│   WSS Server     │
└──────────────────┘               └────────┬─────────┘
                                            ▲
                                      Redis Pub/Sub
                                            ▼
┌──────────────────┐               ┌──────────────────┐
│   Backend App    ├──── Publish ─►│  Redis Cluster   │
└──────────────────┘               └──────────────────┘
```

### 4.1 Subscription Protocol
Upon successful connection, the client negotiates a subscription handshake to join tenant-specific and user-specific channels:
```json
{
  "action": "subscribe",
  "channel": "tenant:acme_prod_01:crm:deals",
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 4.2 Reconnection & Pulse Safeguards
*   **Heartbeat Handshake:** Clients send `{"type": "ping"}` every 30 seconds. The server replies with `{"type": "pong"}`. If a client misses two consecutive heartbeats, the server closes the connection.
*   **Automatic Offline Buffer Catch-up:** Upon reconnection, the client transmits its last received timestamp. The server queries Redis and streams back missed mutations to ensure state parity.

---

## 5. Event-Driven Messaging & Pub/Sub Topology

To ensure decoupling, modules do not write directly to other domains' database tables. They publish asynchronous events onto an enterprise message backbone.

### 5.1 Canonical Event Format
```json
{
  "event_id": "evt_01j48h0y3e9p4f21789cda021a",
  "event_type": "billing.invoice.paid",
  "timestamp": "2026-08-01T19:35:00Z",
  "tenant_id": "tenant_acme_prod_01",
  "actor_id": "user_44321",
  "payload": {
    "invoice_id": "inv_88231",
    "customer_id": "cust_55410",
    "amount_paid": 5000.00,
    "currency": "USD"
  }
}
```

### 5.2 Event Handlers Routing Directory
*   **Event:** `billing.invoice.paid`
    *   *Subscriber 1 (CRM):* Marks associated pipeline deals as "Won".
    *   *Subscriber 2 (Inventory):* Moves scheduled stock units from "Allocated" to "Dispatched".
    *   *Subscriber 3 (Notifications):* Sends an receipt confirmation email to the customer.
