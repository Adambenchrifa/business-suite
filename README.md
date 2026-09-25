# Business Suite

A multi-tenant ERP / SaaS platform for small and medium businesses — organization management, HR, inventory, and a full sales/CRM pipeline, all isolated per tenant at the database schema level.

Built as a full-stack, production-style architecture project: schema-per-tenant multi-tenancy, JWT auth with refresh-token rotation, role-based access control, and audit logging.

<!-- Add a screenshot or short GIF of the dashboard here -->
<!--

![dashboard](docs/screenshot-dashboard.png)

 -->

## Features

- **Multi-tenant architecture** — each workspace gets its own isolated PostgreSQL schema (`tenant_<domain>`), with dynamic schema routing per request
- **Authentication** — JWT access + refresh tokens, session revocation, email verification flow, password reset
- **Role-based access control (RBAC)** — owner / admin / member roles enforced at the route level
- **Core ERP** — organizations, branches, warehouses, departments, positions, employees, invitations, currencies, tax configuration
- **Inventory** — product categories, brands, units of measure, products & variants, stock locations, stock movements
- **Sales & CRM** — companies, contacts, leads, opportunities, activities, sales orders, delivery orders, invoices
- **Audit logging** — activity trail across tenant actions
- **Rate limiting** — sliding-window limiter on auth and API routes
- **File storage** — per-tenant file uploads

## Tech Stack

**Frontend:** React 19, TypeScript, Vite, Tailwind CSS
**Backend:** Node.js, Express
**Database:** PostgreSQL (Neon), Drizzle ORM
**Auth:** JWT (access + refresh), scrypt password hashing
**CI/CD:** GitHub Actions

## Architecture

Each tenant is provisioned its own PostgreSQL schema at signup. A tenant-resolver middleware sets the connection's `search_path` per request based on the authenticated user's workspace, so all queries are automatically scoped to the correct tenant — no manual `WHERE tenant_id = ...` filtering needed, and no risk of cross-tenant data leaks at the query layer.
