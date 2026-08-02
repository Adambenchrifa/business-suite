# Business Suite: Monorepo Organization, Workspace & Code Quality Standards
*Document Classification: Technical Specification*  
*Target Standards: ESLint 9, Prettier 3, TypeScript 5.5, Turborepo*

---

## 1. Monorepo Workspace Configuration

To manage multiple services, modules, and frontend builds within a single repository, Business Suite utilizes a highly optimized **Turborepo** workspace workspace. This reduces development friction, shares configurations, and accelerates CI pipelines using global caching.

```
/ (Root Workspace)
├── apps/                       # DEPLOYABLE APPLICATIONS
│   ├── web/                    # React SPA Single Page Portal
│   └── api-server/             # Express Full-Stack Core API Instance
│
├── packages/                   # INTERNAL CONFIGS & REUSABLE LIBRARIES
│   ├── ts-config/              # Shared compilation settings
│   ├── eslint-config/          # Shared linting and formatting presets
│   ├── database/               # Shared Drizzle Schema & Migrations Engine
│   └── shared-types/           # Base business schemas, interfaces, and enums
│
└── turbo.json                  # Turborepo Build & Dependency Pipelines
```

### 1.1 Turborepo Pipeline Configuration (`turbo.json`)
```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

---

## 2. Package Dependency Organization

Monorepo workspace separation prevents dependency bloating and ensures build independence:

*   `apps/web`: Depends on `@business-suite/shared-types` and local visual UI design systems. It does not import server dependencies like `express` or `drizzle-orm`.
*   `apps/api-server`: Depends on `@business-suite/database` and `@business-suite/shared-types`. Completely decoupled from React or styling libraries.
*   `packages/database`: Encapsulates schema definitions, database connection pools, migration executors, and seeding tools.

---

## 3. Shared Libraries & Subsystem Modules

We isolate core operational functionalities into shared, immutable internal modules inside `/packages`:

*   `@business-suite/crypto`: Provides standardized encryption helper tools, salt hashing strategies, and signature validation wrappers.
*   `@business-suite/logger`: Centralized logging module relying on `pino`. Ensures uniform JSON output structures across all running app instances to simplify parsing by log management tools.
*   `@business-suite/i18n`: Global multi-language dictionary configurations supporting dynamic translation resolution on both client and server.

---

## 4. Development & Coding Quality Standards

All team contributors follow strict coding rules to ensure code consistency and prevent errors.

### 4.1 Linting Guidelines (`eslint.config.js`)
*   *Strict Type Checks:* Strict mode (`"strict": true`) is active in `tsconfig.json`. Explicit `any` declarations are strictly forbidden.
*   *Rules Verification:*
    *   No unused imports (`no-unused-vars` matches imports).
    *   Explicit method accessibility modifiers required on all repository classes.
    *   Explicit function return declarations required on all public API controllers.

### 4.2 TypeScript & Type Safety Constraints
1.  **Named Imports Only:** Grouped default imports are banned to optimize treeshaking. Use named curly imports exclusively.
2.  **Enum Standards:** Do not use `const enum`. Use standard, self-documenting string-valued enums:
    ```typescript
    export enum DealStatus {
      OPEN = 'open',
      WON = 'won',
      LOST = 'lost'
    }
    ```
3.  **Nullable Resolution:** Strictly avoid using non-null assertion operators (`!`). Use explicit null checks or throw detailed validation exceptions.

### 4.3 Component & Styling Patterns
*   **Utility Tailwinds:** Inline styles are strictly forbidden. All designs must utilize Tailwind CSS values.
*   **Component Architecture:** Clean separation of concerns:
    *   *Container Components:* Handlers executing fetch hooks, updating caches, and passing data down.
    *   *Presentation Components:* Stateless, pure visual components that receive input props and emit clean, readable callback events.
*   **WCAG 2.1 Accessibility:** Buttons must have readable `aria-label` definitions, and colors must maintain a contrast ratio of at least 4.5:1 for body copy.
