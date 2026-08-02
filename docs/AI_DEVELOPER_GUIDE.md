# Business Suite: AI Developer & Agent Execution Guide
*Classification: Engineering Protocols*  
*Target: AI Coding Assistants, LLMs, and Automation Pipelines*

---

## 1. Executive Protocol for AI Agents

Welcome, AI Engineer. You are tasked with developing and maintaining the Business Suite platform. Because this platform is a complex, multi-tenant enterprise system, you must follow strict operating boundaries. Straying from these protocols will break the system, disrupt database boundaries, or cause token bloat.

Read and memorize the following guidelines before modifying any file.

---

## 2. Core Operational Rules

### 2.1 Never Modify Unrelated Modules
*   **The Scope Boundary:** You are strictly forbidden from modifying any module other than the one specified in your active task prompt.
*   **Preventing Side-Effects:** If you are modifying `/src/modules/crm/`, do not touch `/src/modules/billing/` unless a shared schema update or migration requires a combined transaction.

### 2.2 Respect the Architecture
*   **Layer Boundaries:** Respect clean separation layers:
    *   Do **NOT** write database queries or Drizzle statements directly inside React controllers or view components.
    *   Do **NOT** put Express logic inside the domain layer.
    *   Do **NOT** bypass the application use cases to call repositories directly from HTTP controller handlers.
*   **Tenant Separation:** All repository methods must accept a `tenantId` parameter. Never write a query without appending a `tenantId` match clause unless querying the global `public.tenants` configuration map.

### 2.3 Zero Code Duplication
*   **Check Before Coding:** Always search the codebase to see if similar utility functions, parsers, or formatting engines already exist.
*   **Shared Infrastructure:** Common tasks like phone number formatting, money currency parsing, date ranges, and CSV downloading belong in `/src/shared/utils/`. Do not re-implement them within individual modules.

### 2.4 Reuse Shared Components
*   **Design System Integrity:** We use a strict design system. Always pull from the shared design library:
    *   **Buttons, Cards, Inputs, Modals:** Read and reuse components located in `/src/shared/components/ui/`.
    *   Do not write custom Tailwind wrappers for native buttons or inputs.
    *   Do not introduce alternative UI styling libraries.
*   **Consistent Icons:** We use standard React icons. Always pull icons from `lucide-react`.

### 2.5 Complete Test Suites
*   **Write Tests with Every Feature:** If you create a controller, database table, or use case, you must write matching tests.
*   **Where Tests Live:**
    *   Save backend unit and integration tests under the relevant `__tests__` subdirectory within that module.
    *   Mock all database layers using custom mock repositories when writing unit tests. Do not open raw PostgreSQL connections in unit tests.

### 2.6 Micro-Commit Workflow & Ticket Isolation
*   **Small Changes Only:** Keep code edits precise and highly localized. Avoid writing huge blocks of code at once.
*   **Clean PR Deliveries:** Organize your edits into single, cohesive pull requests. A PR should do one thing perfectly (e.g., "Add lead validation endpoint" or "Create CRM board component"). Do not bundle unrelated changes together.

---

## 3. Recommended Prompt Templates for Downstream Agents

When delegating tasks to other AI models or subagents, use these prompt structures to enforce discipline:

```markdown
Role: Senior AI Developer specializing in Clean Architecture and Multi-Tenant systems.
Task: Implement [Insert Specific Feature / Ticket Code] in the Business Suite codebase.
Strict Guidelines:
1. Limit your edits ONLY to the following files: [Insert File List].
2. Adhere strictly to /docs/DEVELOPMENT_GUIDE.md and /docs/AI_DEVELOPER_GUIDE.md.
3. Reuse existing components in /src/shared/components/. Do not declare custom styles.
4. Verify that total debits balance total credits in any double-entry bookkeeping routes.
5. Provide a full suite of unit and integration tests before considering your work complete.
```
