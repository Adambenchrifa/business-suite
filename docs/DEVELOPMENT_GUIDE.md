# Business Suite: Development & Coding Standards Guide
*Classification: Internal Engineering Standard*  
*Target: Frontend (React 19, TypeScript) & Backend (Node.js, Express, Drizzle ORM)*

---

## 1. Coding Conventions

All code written within Business Suite must adhere to strict type-safety, readability, and clean architectural principles.

### 1.1 TypeScript & Core Coding Rules
*   **No Implicit Any:** Set `"noImplicitAny": true` and `"strict": true` in `tsconfig.json`. Explicit typing is required on all function arguments, return types, and class members.
*   **Named Imports Only:** Do not use default imports or import * wildcard structures (except for external libraries when absolutely necessary). This ensures clean tree-shaking.
    ```typescript
    // ❌ BAD
    import crmController from './controllers/crmController';
    
    // ✅ GOOD
    import { CrmController } from './controllers/crm-controller';
    ```
*   **Avoid Non-Null Assertion:** Do not use the non-null assertion operator (`!`). Always use explicit null-checks, optional chaining (`?.`), or throw meaningful descriptive errors.
*   **Enum Standards:** Always define standard string-based enums instead of numeric or const enums.
    ```typescript
    export enum InvoiceStatus {
      DRAFT = 'draft',
      SENT = 'sent',
      PAID = 'paid',
      OVERDUE = 'overdue',
    }
    ```

### 1.2 Frontend & UI (React 19, Tailwind CSS)
*   **Functional Components Only:** Class components are forbidden. Use functional components with hooks.
*   **React hooks dependency arrays:** Never include arrays or objects inside `useEffect` dependency arrays unless they are strictly stabilized or memoized. Prefer primitive values (strings, numbers, booleans) in dependency arrays to prevent infinite re-render loops.
*   **Styling Rules:** Use Tailwind CSS utility classes exclusively. Inline style attributes are prohibited unless executing dynamic calculations (e.g., Gantt bar widths, progress meters) which should be mapped through CSS custom variables.
*   **Accessibility (WCAG 2.1 AA):** All interactive components (buttons, links, inputs) must include descriptive `aria-label` tags, and colors must maintain a contrast ratio of at least 4.5:1 for body copy.

---

## 2. Naming Conventions

Consistency in naming reduces cognitive load and prevents collision.

| Domain/Concept | Casing Rule | Example |
| :--- | :--- | :--- |
| **Files & Folders** | `kebab-case` | `crm-controller.ts`, `lead-form.tsx` |
| **Classes & Components** | `PascalCase` | `class DealRepository {}`, `function MetricCard() {}` |
| **Variables & Functions** | `camelCase` | `const activeLeads = 12;`, `function getDeals() {}` |
| **Enums & Types** | `PascalCase` | `enum UserRole {}`, `type CustomQuery = {}` |
| **Database Tables** | `snake_case` (plural) | `crm_deals`, `stock_levels` |
| **Database Columns** | `snake_case` (singular)| `deal_value`, `warehouse_id` |

---

## 3. Folder Rules & Separation of Concerns

Modules inside the `src/modules/` directory must keep their concerns strictly separated using Clean Architecture layers:

```
/src/modules/{module_name}/
├── domain/             # Entities, Value Objects, Domain Exceptions (0 dependencies)
├── application/        # Use Cases, Command/Query handlers, interfaces
├── infrastructure/     # Database tables, Drizzle repositories, third-party clients
├── controllers/        # Express Route Controllers, Request schema validations (Zod)
└── ui/                 # React views, custom module components, local styles
```

### Directives:
*   **No Cross-Module Domain Importing:** The domain layer of module A is forbidden from importing files from module B's domain layer. Instead, modules communicate via the shared database registry or the asynchronous event backbone.
*   **UI Placement:** Components used across multiple modules are saved in `/src/shared/components/`. Components specific to a single module are saved inside `/src/modules/{module_name}/ui/components/`.

---

## 4. Architecture Rules & Boundaries

*   **Thin Controllers, Rich Domains:** Controllers should only parse incoming payloads, execute schema validations, delegate execution to application use cases, and format output. Business logic must reside in domain entities.
*   **Repository Pattern:** All database operations must execute through repositories. SQL builders (Drizzle) are isolated inside the infrastructure layer to make swapping data engines easy.
*   **Stateless Operations:** Compute layers must remain completely stateless. User session metadata must live inside the authenticated JWT or distributed caching engines (Redis).

---

## 5. Review Checklist (Pull Request Gates)

Before a PR can be merged to the main branch, it must fulfill the following checks:

- [ ] Code successfully passes local and CI linter checks (`npm run lint`).
- [ ] Code successfully compiles in production configuration (`npm run build`).
- [ ] Code does not introduce any type-casting or raw `any` declarations.
- [ ] Database migrations are backwards-compatible and follow blue-green pipeline rules.
- [ ] Test coverage for any new logic meets or exceeds 80% (unit/integration).
- [ ] No hardcoded secrets, keys, or passwords exist in the changes.
- [ ] The PR has been approved by at least two senior engineers.
