# AUTHORIZATION & RBAC MATRIX

This document specifies the authorization, role-based access control (RBAC), tenant validation, and status code expectations for every endpoint in the Business Suite multi-tenant application.

---

## Roles & Permissions Definitions

- **Unauthenticated**: Anonymous HTTP client without a valid Bearer JWT or access cookie.
- **Member**: Authenticated workspace user with operational read permissions across ERP modules. Restricted from administrative settings, structural modifications, and data mutation/deletion.
- **Admin**: Authenticated workspace user with administrative rights to manage organization resources, inventory catalog, sales/CRM records, and system settings.
- **Owner**: Workspace creator/super-administrator with full control over workspace data and billing configuration.

---

## System Status Code Conventions

- **`200 OK`**: Successful query or updates.
- **`201 Created`**: Successful entity creation.
- **`400 Bad Request`**: Validation error or malformed payload.
- **`401 Unauthorized`**: Missing, invalid, expired, or malformed JWT token.
- **`403 Forbidden`**: Valid authentication but insufficient role permissions OR tenant workspace mismatch/suspension.
- **`404 Not Found`**: Non-existent endpoint, unknown tenant domain, or cross-tenant resource non-disclosure.
- **`429 Too Many Requests`**: Throttled by rate limiting middleware.
- **`500 Internal Server Error`**: Unexpected system/database exception.

---

## Detailed Endpoint Authorization Matrix

| Module | Endpoint | Method | Required Auth | Tenant Validation Required | Allowed Roles | Rejected Roles | Expected Status Codes |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- | :--- |
| **Health** | `/api/health` | GET | None | No | Public | None | 200, 500 |
| **Auth** | `/api/v1/auth/register` | POST | None | Optional | Public | None | 201, 400, 429, 500 |
| **Auth** | `/api/v1/auth/login` | POST | None | Optional | Public | None | 200, 400, 401, 429, 500 |
| **Auth** | `/api/v1/auth/logout` | POST | None | Optional | Public | None | 200 |
| **Auth** | `/api/v1/auth/refresh` | POST | None | Optional | Public | None | 200, 401, 429 |
| **Auth** | `/api/v1/auth/forgot-password` | POST | None | Optional | Public | None | 200, 400, 429 |
| **Auth** | `/api/v1/auth/reset-password` | POST | None | Optional | Public | None | 200, 400, 429 |
| **Auth** | `/api/v1/auth/verify-email` | POST | None | Optional | Public | None | 200, 400, 429 |
| **Auth** | `/api/v1/auth/me` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/organization` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/organization` | PUT | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 400, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/branches` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/branches` | POST | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 201, 400, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/branches/:id` | PUT | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 400, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/branches/:id` | DELETE | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/warehouses` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/warehouses` | POST | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 201, 400, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/warehouses/:id` | PUT | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 400, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/warehouses/:id` | DELETE | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/departments` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/departments` | POST | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 201, 400, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/departments/:id` | PUT | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 400, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/departments/:id` | DELETE | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/positions` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/positions` | POST | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 201, 400, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/positions/:id` | PUT | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 400, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/positions/:id` | DELETE | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/employees` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/employees` | POST | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 201, 400, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/employees/:id` | PUT | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 400, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/employees/:id` | DELETE | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/invitations` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/invitations` | POST | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 201, 400, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/invitations/:id` | DELETE | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/currencies` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/currencies` | POST | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 201, 400, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/currencies/:id` | PUT | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 400, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/currencies/:id` | DELETE | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/taxes` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/taxes` | POST | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 201, 400, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/taxes/:id` | PUT | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 400, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/taxes/:id` | DELETE | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/sequences` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **ERP Foundation** | `/api/v1/erp/sequences/:id` | PUT | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 400, 401, 403, 404 |
| **File Storage** | `/api/v1/erp/files` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **File Storage** | `/api/v1/erp/files` | POST | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 201, 400, 401, 403, 404 |
| **File Storage** | `/api/v1/erp/files/:id` | DELETE | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 401, 403, 404 |
| **Audit Logs** | `/api/v1/erp/logs` | GET | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 401, 403, 404 |
| **Notifications** | `/api/v1/erp/notifications` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **Notifications** | `/api/v1/erp/notifications/:id/read` | PUT | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **Notifications** | `/api/v1/erp/notifications/read-all` | PUT | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **Inventory** | `/api/v1/erp/inventory/categories` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **Inventory** | `/api/v1/erp/inventory/categories` | POST | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 201, 400, 401, 403, 404 |
| **Inventory** | `/api/v1/erp/inventory/categories/:id` | PUT | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 400, 401, 403, 404 |
| **Inventory** | `/api/v1/erp/inventory/categories/:id` | DELETE | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 401, 403, 404 |
| **Inventory** | `/api/v1/erp/inventory/brands` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **Inventory** | `/api/v1/erp/inventory/brands` | POST | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 201, 400, 401, 403, 404 |
| **Inventory** | `/api/v1/erp/inventory/brands/:id` | PUT | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 400, 401, 403, 404 |
| **Inventory** | `/api/v1/erp/inventory/brands/:id` | DELETE | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 401, 403, 404 |
| **Inventory** | `/api/v1/erp/inventory/uoms` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **Inventory** | `/api/v1/erp/inventory/uoms` | POST | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 201, 400, 401, 403, 404 |
| **Inventory** | `/api/v1/erp/inventory/uoms/:id` | PUT | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 400, 401, 403, 404 |
| **Inventory** | `/api/v1/erp/inventory/uoms/:id` | DELETE | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 401, 403, 404 |
| **Inventory** | `/api/v1/erp/inventory/products` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **Inventory** | `/api/v1/erp/inventory/products` | POST | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 201, 400, 401, 403, 404 |
| **Inventory** | `/api/v1/erp/inventory/products/:id` | PUT | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 400, 401, 403, 404 |
| **Inventory** | `/api/v1/erp/inventory/products/:id` | DELETE | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 401, 403, 404 |
| **Inventory** | `/api/v1/erp/inventory/products/:productId/variants` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **Inventory** | `/api/v1/erp/inventory/products/:productId/variants` | POST | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 201, 400, 401, 403, 404 |
| **Inventory** | `/api/v1/erp/inventory/products/variants/:id` | DELETE | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 401, 403, 404 |
| **Inventory** | `/api/v1/erp/inventory/locations` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **Inventory** | `/api/v1/erp/inventory/locations` | POST | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 201, 400, 401, 403, 404 |
| **Inventory** | `/api/v1/erp/inventory/locations/:id` | PUT | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 400, 401, 403, 404 |
| **Inventory** | `/api/v1/erp/inventory/locations/:id` | DELETE | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 401, 403, 404 |
| **Inventory** | `/api/v1/erp/inventory/stock-levels` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **Inventory** | `/api/v1/erp/inventory/movements` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **Inventory** | `/api/v1/erp/inventory/movements` | POST | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 201, 400, 401, 403, 404 |
| **Inventory** | `/api/v1/erp/inventory/valuation` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **Inventory** | `/api/v1/erp/inventory/dashboard` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **Sales / CRM** | `/api/v1/erp/crm/companies` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **Sales / CRM** | `/api/v1/erp/crm/companies` | POST | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 201, 400, 401, 403, 404 |
| **Sales / CRM** | `/api/v1/erp/crm/companies/:id` | PUT | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 400, 401, 403, 404 |
| **Sales / CRM** | `/api/v1/erp/crm/companies/:id` | DELETE | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 401, 403, 404 |
| **Sales / CRM** | `/api/v1/erp/crm/contacts` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **Sales / CRM** | `/api/v1/erp/crm/contacts` | POST | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 201, 400, 401, 403, 404 |
| **Sales / CRM** | `/api/v1/erp/crm/contacts/:id` | PUT | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 400, 401, 403, 404 |
| **Sales / CRM** | `/api/v1/erp/crm/contacts/:id` | DELETE | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 401, 403, 404 |
| **Sales / CRM** | `/api/v1/erp/crm/leads` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **Sales / CRM** | `/api/v1/erp/crm/leads` | POST | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 201, 400, 401, 403, 404 |
| **Sales / CRM** | `/api/v1/erp/crm/leads/:id` | PUT | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 400, 401, 403, 404 |
| **Sales / CRM** | `/api/v1/erp/crm/leads/:id` | DELETE | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 401, 403, 404 |
| **Sales / CRM** | `/api/v1/erp/crm/opportunities` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **Sales / CRM** | `/api/v1/erp/crm/opportunities` | POST | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 201, 400, 401, 403, 404 |
| **Sales / CRM** | `/api/v1/erp/crm/opportunities/:id` | PUT | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 400, 401, 403, 404 |
| **Sales / CRM** | `/api/v1/erp/crm/opportunities/:id` | DELETE | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 401, 403, 404 |
| **Sales / CRM** | `/api/v1/erp/crm/activities` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **Sales / CRM** | `/api/v1/erp/crm/activities` | POST | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 201, 400, 401, 403, 404 |
| **Sales / CRM** | `/api/v1/erp/crm/activities/:id` | DELETE | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 401, 403, 404 |
| **Sales / CRM** | `/api/v1/erp/sales/orders` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **Sales / CRM** | `/api/v1/erp/sales/orders` | POST | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 201, 400, 401, 403, 404 |
| **Sales / CRM** | `/api/v1/erp/sales/orders/:id/status` | PUT | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 400, 401, 403, 404 |
| **Sales / CRM** | `/api/v1/erp/sales/orders/:id` | DELETE | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 401, 403, 404 |
| **Sales / CRM** | `/api/v1/erp/sales/deliveries` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **Sales / CRM** | `/api/v1/erp/sales/deliveries` | POST | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 201, 400, 401, 403, 404 |
| **Sales / CRM** | `/api/v1/erp/sales/invoices` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
| **Sales / CRM** | `/api/v1/erp/sales/invoices` | POST | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 201, 400, 401, 403, 404 |
| **Sales / CRM** | `/api/v1/erp/sales/invoices/:id/status` | PUT | Bearer JWT | Yes | `owner`, `admin` | `member`, Unauthenticated | 200, 400, 401, 403, 404 |
| **Sales / CRM** | `/api/v1/erp/sales/dashboard` | GET | Bearer JWT | Yes | `owner`, `admin`, `member` | Unauthenticated | 200, 401, 403, 404 |
