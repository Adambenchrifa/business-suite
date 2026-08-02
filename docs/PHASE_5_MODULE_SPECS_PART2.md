# Business Suite: Module Specifications - Part 2
*Document Classification: Functional & Technical Specification*  
*Target: Modules 13 to 25*

---

## 1. Projects Module

*   **Purpose:** Coordinates company initiatives, milestones, and task deliverables within clear timelines.
*   **Core Features:**
    *   Milestone tracking.
    *   Interactive Gantt chart timelines.
    *   Project financial and budget tracking.
*   **UI Pages & Layouts:**
    *   `/projects`: Grid dashboard of active projects with health indicators and completion percentages.
    *   `/projects/:id/gantt`: Interactive dragging Gantt timeline showing task connections.
*   **Components:**
    *   `ProjectGanttChart`: Recharts/D3 powered timeline mapping task timelines and dependencies.
    *   `ProjectBudgetTracker`: Progress bar comparing actual expenses to budgeted funds.
*   **APIs (Express/REST):**
    *   `GET /api/v1/projects`: Queries tenant projects.
    *   `POST /api/v1/projects/:id/milestones`: Appends a project milestone.
*   **Database Tables:**
    *   `projects`: ID, name, budget, start_date, and end_date.
    *   `project_milestones`: ID, project ID, title, and target_date.
*   **Permissions:** `projects:read`, `projects:write`.
*   **Business Rules:** Project deadlines cannot precede milestone target dates. Budget overruns automatically trigger alerts to the project owner.
*   **Integrations:** Jira, Monday.com.
*   **Future Scalability:** Dynamic Gantt rendering optimized for hundreds of concurrent task edits.

---

## 2. Tasks Module

*   **Purpose:** Tracks and distributes actionable items within project teams.
*   **Core Features:**
    *   Kanban boards for task tracking.
    *   Subtask checklists and time-tracking logs.
    *   File and comment attachments on tasks.
*   **UI Pages & Layouts:**
    *   `/tasks/board`: Drag-and-drop Kanban card board.
    *   `/tasks/list`: Custom-sorted grid of tasks with high-priority filters.
*   **Components:**
    *   `TaskCard`: Draggable component displaying assignee avatar, due dates, priority labels, and checklist progress indicators.
    *   `TimeTrackerButton`: Interactive clock button to log active task hours.
*   **APIs (Express/REST):**
    *   `GET /api/v1/tasks`: Queries tasks.
    *   `PATCH /api/v1/tasks/:id/status`: Updates a task's status.
*   **Database Tables:**
    *   `tasks`: ID, project ID, title, priority, status, and due_date.
    *   `task_time_logs`: ID, task_id, employee_id, and duration_minutes.
*   **Permissions:** `tasks:read`, `tasks:write`, `tasks:time_track`.
*   **Business Rules:** Tasks cannot be closed with open, incomplete checklist subtasks.
*   **Integrations:** Slack, Microsoft Teams.
*   **Future Scalability:** Decoupling task updates into an event stream to handle thousands of concurrent edits.

---

## 3. Calendar Module

*   **Purpose:** Coordinates team availability, meetings, and project deadlines in a unified schedule.
*   **Core Features:**
    *   Shared department schedules.
    *   Resource and meeting room booking systems.
    *   Bidirectional external calendar synchronization.
*   **UI Pages & Layouts:**
    *   `/calendar/view`: Responsive month/week/day calendar grid.
    *   `/calendar/booking`: Room and equipment booking workspace.
*   **Components:**
    *   `CalendarGrid`: Schedule grid with dragging event boxes.
    *   `TimeSlotPicker`: Visual slot selector that hides times already booked by other team members.
*   **APIs (Express/REST):**
    *   `GET /api/v1/calendar/events`: Queries schedule events.
    *   `POST /api/v1/calendar/events`: Creates a calendar event.
*   **Database Tables:**
    *   `calendar_events`: ID, creator_id, title, description, start_time, and end_time.
    *   `resource_bookings`: ID, resource_id, event_id, start_time, and end_time.
*   **Permissions:** `calendar:events:read`, `calendar:events:write`, `calendar:resources:book`.
*   **Business Rules:** Resource bookings cannot overlap. Double-bookings are blocked automatically and return a conflict error.
*   **Integrations:** Google Calendar API, Outlook Calendar, Google Meet.
*   **Future Scalability:** Dynamic calendar event scaling using geographically distributed edge replicas.

---

## 4. Documents Module

*   **Purpose:** Manages company files, contracts, policies, and collaborative articles securely.
*   **Core Features:**
    *   Folder directories and document organization.
    *   Detailed version histories and change tracking.
    *   Document templates with template variables.
*   **UI Pages & Layouts:**
    *   `/documents/explorer`: File explorer layout with drag-and-drop file organization.
    *   `/documents/editor/:id`: Rich text editor with real-time collaborative editing.
*   **Components:**
    *   `FolderTreeView`: Collapsible side panel directory.
    *   `DocumentEditor`: Real-time collaborative text editor component.
*   **APIs (Express/REST):**
    *   `POST /api/v1/documents/upload`: Generates pre-signed upload URLs and saves file metadata.
    *   `GET /api/v1/documents/:id/revisions`: Lists previous versions of a document.
*   **Database Tables:**
    *   `documents`: ID, folder_id, name, file_path, and size.
    *   `document_revisions`: ID, document_id, version, and editor_id.
*   **Permissions:** `documents:read`, `documents:write`, `documents:delete`.
*   **Business Rules:** Deleting a folder moves all child files to a temporary "Trash" folder. Deleted files are permanently purged after 30 days.
*   **Integrations:** Google Drive, AWS S3, OneDrive.
*   **Future Scalability:** Offloading file optimization and scanning processes to serverless background workers.

---

## 5. Reports Module

*   **Purpose:** Consolidates analytics across modules into comprehensive business reports.
*   **Core Features:**
    *   Custom drag-and-drop report builders.
    *   Scheduled email reports and PDF exports.
    *   Financial and inventory balance reconciliations.
*   **UI Pages & Layouts:**
    *   `/reports/dashboard`: Index of saved reports categorized by department.
    *   `/reports/builder`: Canvas workspace to design custom charts.
*   **Components:**
    *   `DraggableChartCanvas`: Dynamic visual chart builder component.
    *   `ExportButton`: Interactive button triggering export formats (PDF, CSV, Excel) in the background.
*   **APIs (Express/REST):**
    *   `GET /api/v1/reports/:id/execute`: Runs analytical queries against the analytics database.
    *   `POST /api/v1/reports/schedule`: Sets up automated report deliveries.
*   **Database Tables:**
    *   `saved_reports`: ID, creator_id, name, config_json, and department_id.
    *   `scheduled_reports`: ID, report_id, cron_schedule, and recipient_list.
*   **Permissions:** `reports:view`, `reports:configure`.
*   **Business Rules:** Heavy analytical queries are automatically redirected to read-only replicas to prevent performance drops on the primary transaction database.
*   **Integrations:** BigQuery, AWS Athena.
*   **Future Scalability:** Decoupled analytical processing using specialized, column-oriented analytical database clusters (OLAP).

---

## 6. Notifications Module

*   **Purpose:** Dispatches in-app, email, and push notifications to keep users informed.
*   **Core Features:**
    *   Dynamic delivery channels (In-App, Email, Push).
    *   User-defined notification preferences.
    *   Automated notification batching.
*   **UI Pages & Layouts:**
    *   `/notifications/inbox`: Centered inbox view of read/unread system notifications.
    *   `/settings/notifications`: Checklist of notification preferences per category.
*   **Components:**
    *   `NotificationToast`: Pop-up alert for real-time notifications.
    *   `InboxNotificationRow`: Interactive list item with quick action buttons.
*   **APIs (Express/REST):**
    *   `GET /api/v1/notifications`: Queries notifications.
    *   `POST /api/v1/notifications/mark-read`: Marks notifications as read.
*   **Database Tables:**
    *   `notifications`: ID, recipient_id, channel, status, and payload.
    *   `notification_preferences`: User ID, channel, and frequency.
*   **Permissions:** `notifications:read`, `notifications:preferences:manage`.
*   **Business Rules:** Non-urgent notifications are batched and delivered as a daily digest email during non-working hours.
*   **Integrations:** SendGrid, OneSignal, FCM (Firebase Cloud Messaging).
*   **Future Scalability:** Dispatch pipelines processed asynchronously via high-throughput background queues.

---

## 7. AI Assistant Module

*   **Purpose:** Provides contextual help, report analysis, and automated data entry using AI models.
*   **Core Features:**
    *   Conversational search across all system documents and data.
    *   Natural-language report generation.
    *   Automated OCR-driven metadata extraction.
*   **UI Pages & Layouts:**
    *   `/ai/assistant`: Side panel chat interface.
*   **Components:**
    *   `AssistantChatWindow`: Conversational interface displaying message history, markdown content, and suggestions.
    *   `ContextTokenBadge`: Visual indicator showing token consumption and cache status.
*   **APIs (Express/REST):**
    *   `POST /api/v1/ai/query`: Runs grounded natural-language requests against the Gemini API.
    *   `POST /api/v1/ai/embeddings/sync`: Slices and embeds new documents to the vector database.
*   **Database Tables:**
    *   `ai_conversations`: ID, user_id, title, and created_at.
    *   `ai_messages`: ID, conversation_id, sender, and content.
*   **Permissions:** `ai:assistant:use`, `ai:assistant:configure`.
*   **Business Rules:** The AI assistant strictly respects user access levels. It will never return data from documents the active user does not have permission to view.
*   **Integrations:** Google GenAI SDK (Gemini models), PgVector.
*   **Future Scalability:** Reducing API latency using Gemini's context caching capabilities.

---

## 8. Automation Module

*   **Purpose:** Executes automated workflows when specific system events are triggered.
*   **Core Features:**
    *   Visual "If This, Then That" (IFTTT) workflow builders.
    *   Event listener triggers (e.g., when a lead is created).
    *   Webhook delivery systems.
*   **UI Pages & Layouts:**
    *   `/automation/workflows`: Index of active and inactive automation rules.
    *   `/automation/builder`: Node-based canvas workspace to design automation pipelines.
*   **Components:**
    *   `WorkflowNodeCanvas`: Visual workspace component to wire triggers, conditions, and actions.
*   **APIs (Express/REST):**
    *   `POST /api/v1/automation/workflows`: Saves or modifies an automation rule.
    *   `POST /api/v1/automation/webhooks`: Registers webhooks.
*   **Database Tables:**
    *   `automation_workflows`: ID, creator_id, name, trigger_event, and steps_json.
    *   `automation_execution_logs`: ID, workflow_id, execution_status, and error_messages.
*   **Permissions:** `automation:workflows:manage`.
*   **Business Rules:** Loop prevention safeguards block workflows that trigger themselves in a continuous loop.
*   **Integrations:** Zapier, Make, Slack Webhooks.
*   **Future Scalability:** Workflows executed asynchronously by dedicated serverless workers.

---

## 9. Mobile Module

*   **Purpose:** Responsive interface optimized for mobile and native device integration.
*   **Core Features:**
    *   Touch-target-optimized layouts.
    *   Biometric lock support.
    *   Background geolocation capabilities.
*   **UI Pages & Layouts:**
    *   Adapts web pages (/crm, /tasks) into a single-column layout.
*   **Components:**
    *   `MobileBottomNav`: Sticky navigation bar for quick access.
    *   `BiometricPrompt`: Security overlay component checking device biometrics.
*   **APIs (Express/REST):**
    *   Shares standard web API routes with device-optimized payload sizes.
*   **Database Tables:**
    *   `user_device_registrations`: ID, user_id, push_token, and OS.
*   **Permissions:** Inherits permissions from the user's role.
*   **Business Rules:** Geolocation data is encrypted locally and is only transmitted while the app is active in the background.
*   **Integrations:** Capacitor, FCM.
*   **Future Scalability:** Client-side caching optimized for devices with low storage.

---

## 10. Desktop Module

*   **Purpose:** Responsive layout optimized for multi-window desktop monitors and keyboard navigation.
*   **Core Features:**
    *   Custom keyboard shortcut actions.
    *   Multi-window panel docking.
    *   Local system integrations (such as direct file system writes and hardware scanners).
*   **UI Pages & Layouts:**
    *   High-density multi-column grids and dashboards.
*   **Components:**
    *   `KeyboardShortcutLegend`: Overlapping dialog listing navigation shortcuts.
    *   `DockablePanelSystem`: Dragging panel layout engine.
*   **APIs (Express/REST):**
    *   Shares standard web API routes.
*   **Database Tables:**
    *   Shares standard database structures.
*   **Permissions:** Inherits standard permissions.
*   **Business Rules:** Sessions require re-authentication if the app remains in the background for more than 4 hours.
*   **Integrations:** Electron, local print systems.
*   **Future Scalability:** High-performance local caching using SQLite WebAssembly.

---

## 11. Settings Module

*   **Purpose:** Central control panel to configure company metadata, preferences, and module subscriptions.
*   **Core Features:**
    *   Tenant profile configuration.
    *   Module activations and deactivations.
    *   Theme customizer.
*   **UI Pages & Layouts:**
    *   `/settings/profile`: Form to update tenant details, name, address, and logo.
    *   `/settings/modules`: Grid of toggles to activate/deactivate platform modules.
*   **Components:**
    *   `ModuleToggleCard`: Informative card showing pricing structures and activation toggles.
*   **APIs (Express/REST):**
    *   `PATCH /api/v1/settings/profile`: Updates profile records.
    *   `POST /api/v1/settings/modules/toggle`: Activates/deactivates specific system modules.
*   **Database Tables:**
    *   `tenant_settings`: ID, preferences_json, active_modules_list, and theme_details.
*   **Permissions:** `settings:tenant:manage`.
*   **Business Rules:** Disabling a module flags its database tables as read-only.
*   **Integrations:** Stripe Billing (module pricing updates).
*   **Future Scalability:** Dynamic config values cached globally in Redis.

---

## 12. Audit Logs Module

*   **Purpose:** Immutable records tracking all user actions to ensure compliance and security.
*   **Core Features:**
    *   Immutable system logging.
    *   Searchable action trails by user, IP, or resource.
    *   Automated compliance reporting.
*   **UI Pages & Layouts:**
    *   `/admin/audit-logs`: High-density table listing system activities.
*   **Components:**
    *   `AuditRowViewer`: Dialog detailing state differences (Before vs. After).
*   **APIs (Express/REST):**
    *   `GET /api/v1/audit-logs`: Queries system logs.
*   **Database Tables:**
    *   `audit_logs`: ID, user_id, action_type, before_state, after_state, IP, and timestamp.
*   **Permissions:** `audit_logs:read`.
*   **Business Rules:** Audit logs are strictly append-only. Under no circumstances can logs be edited, deleted, or cleared.
*   **Integrations:** Elastic Stack, Datadog.
*   **Future Scalability:** Archiving historic logs to low-cost cloud storage buckets.

---

## 13. Administration Module

*   **Purpose:** Platform-owner portal to manage tenants, view global statistics, and configure database settings.
*   **Core Features:**
    *   Tenant provisioning and suspension dashboards.
    *   Database connection health monitors.
    *   Platform-wide notification broadcasting.
*   **UI Pages & Layouts:**
    *   `/admin/tenants`: Grid listing active and inactive tenant accounts.
    *   `/admin/infrastructure`: Graph panel displaying server resources.
*   **Components:**
    *   `TenantControlPanel`: Dialog to suspend, delete, or modify a tenant's database configuration.
*   **APIs (Express/REST):**
    *   `GET /api/v1/admin/tenants`: Queries registered tenants.
    *   `POST /api/v1/admin/tenants/provision`: Manages the database schema setup for new tenants.
*   **Database Tables:**
    *   Queries the `public.tenants` table from the central database.
*   **Permissions:** Requires global SuperAdmin credentials.
*   **Business Rules:** Deleting a tenant executes a cascade script that permanently deletes all its dynamic database schemas.
*   **Integrations:** GCP Cloud Resource Manager, SendGrid.
*   **Future Scalability:** Dynamic tenant provisioning managed using serverless functions.
