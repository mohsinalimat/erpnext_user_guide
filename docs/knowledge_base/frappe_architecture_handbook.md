# Frappe Architecture Handbook

**Version**: 1.0  
**Based on**: Frappe Framework v16 (source analysis)  
**Date**: 2026-06-09  

> This handbook is a comprehensive, source‑code‑driven analysis of the Frappe v16 framework. It covers application lifecycles, frontend/backend execution flows, the Document ORM, report engines, bench internals, realtime architecture, hooks, and production‑safe extension patterns. All information is derived from the official Frappe v16 repository and supporting technical documents.

---

## Table of Contents

1. [Introduction](#1-introduction)  
2. [High‑Level Architecture](#2-high-level-architecture)  
3. [Application Lifecycle](#3-application-lifecycle)  
   - 3.1 Login Lifecycle  
   - 3.2 Logout Lifecycle  
   - 3.3 Boot Process  
4. [Desk SPA Architecture](#4-desk-spa-architecture)  
5. [Routing Lifecycle](#5-routing-lifecycle)  
6. [Form Lifecycle](#6-form-lifecycle)  
   - 6.1 Frontend Form Events  
   - 6.2 Backend Document Lifecycle  
   - 6.3 Save, Submit, Cancel, Amend, Delete, Rename  
7. [Child Table Lifecycle](#7-child-table-lifecycle)  
8. [Permissions & Security](#8-permissions--security)  
9. [Report Lifecycles](#9-report-lifecycles)  
   - 9.1 Script Report  
   - 9.2 Query Report  
10. [List View & Other Views](#10-list-view--other-views)  
11. [Workspace & Dashboard](#11-workspace--dashboard)  
12. [Notifications & Assignment](#12-notifications--assignment)  
13. [Realtime & WebSockets](#13-realtime--websockets)  
14. [Scheduler Architecture](#14-scheduler-architecture)  
15. [Worker & Background Jobs](#15-worker--background-jobs)  
16. [Bench Commands Deep Dive](#16-bench-commands-deep-dive)  
    - 16.1 `bench start`  
    - 16.2 `bench restart`  
    - 16.3 `bench migrate`  
    - 16.4 `bench build`  
17. [Asset Pipeline & Build System](#17-asset-pipeline--build-system)  
18. [Hooks Framework & Extension Points](#18-hooks-framework--extension-points)  
19. [Migration System](#19-migration-system)  
20. [Production‑Safe Customization Strategies](#20-production-safe-customization-strategies)  
21. [Source Code Reference Map](#21-source-code-reference-map)  
22. [Appendices](#22-appendices)  
    - A. Form Event Matrix  
    - B. Controller Hook Matrix  
    - C. Migration Order  
    - D. Bench Process List  
    - E. Sequence Diagrams  

---

## 1. Introduction

This document is the definitive technical reference for Frappe Framework version 16. It is intended for senior Frappe/ERPNext architects, developers, and system integrators who need to understand the framework’s internal execution flow, extension points, and production behaviour.

The analysis is based on:
- Actual source code from the Frappe v16 repository (Python and JavaScript)
- Extracted call graphs and lifecycle traces
- Official documentation and community patterns


---

## 2. High‑Level Architecture

Frappe is a **metadata‑driven full‑stack framework**. The core layers are:

```
Browser (Desk SPA)
    │
    ▼
HTTP / WebSocket
    │
    ▼
frappe.app (WSGI entrypoint)
    │
    ▼
frappe.handler (request router)
    │
    ▼
frappe.model.document.Document (ORM)
    │
    ▼
MariaDB / PostgreSQL
```

Supporting services:
- **Redis Cache** – session storage, caching, pub/sub
- **Redis Queue** – RQ‑based background job queue
- **Socket.IO** – realtime updates
- **Scheduler** – cron‑like job execution
- **Workers** – short, default, long queues
- **Vite / esbuild** – asset compilation

All metadata (DocTypes, fields, permissions) is stored in the database and loaded dynamically.

---

## 3. Application Lifecycle

### 3.1 Login Lifecycle

**Frontend sequence:**
1. User submits credentials via `/login` page.
2. Client calls `frappe.call('login')` or posts to `login_via_password`.
3. On success, session cookies are stored and `frappe.init` runs.

**Backend sequence (frappe/auth.py, frappe/sessions.py):**
```
LoginManager.authenticate()
    ├── check_password()
    ├── validate_ip_address()
    └── validate_user()
LoginManager.post_login()
    ├── create session in Redis
    ├── set `sid` cookie
    └── trigger `after_login` hook
frappe.get_bootinfo()
    └── returns user, roles, permissions, workspaces, etc.
```

**Supported authentication methods:**
- Password
- API key + secret
- OAuth / SAML / Social Login
- LDAP

**Hooks executed:**
- `on_login` (in `hooks.py`) – after session creation, before desk loads.

### 3.2 Logout Lifecycle

**Frontend:**
- User clicks logout → `frappe.call('logout')` → clear local storage → redirect to `/login`

**Backend (frappe/sessions.py):**
```
Session.delete_session()
    ├── remove session from Redis
    ├── invalidate cookie
    └── execute `logout_hook` (in hooks.py)
```

**Hooks executed:**
- `on_logout`

### 3.3 Boot Process

After login, the desk loads `/desk`. The client receives a `boot` JSON containing:
- `user` (user info)
- `roles`
- `defaults`
- `workspaces`
- `notifications`
- `permissions` (cached)
- `translations`
- `navbar_items`

The boot data is stored in `frappe.boot` and used throughout the SPA.

---

## 4. Desk SPA Architecture

The Desk is a **single‑page application** (SPA) built on:
- `frappe.router` – client‑side routing (HTML5 History API)
- `frappe.views` – view factories (List, Form, Report, Tree, etc.)
- `frappe.ui.form` – form controller
- `frappe.model` – client‑side document wrapper
- `frappe.call` – AJAX / RPC abstraction

No full page reloads occur during normal navigation.

---

## 5. Routing Lifecycle

**Sequence:**
1. User clicks a menu item or doctype link.
2. `frappe.set_route(route, ...)` is called.
3. `frappe.router` parses the route, e.g. `["List", "Sales Invoice"]`.
4. Route history is recorded.
5. The appropriate view class is instantiated:
   - `ListView` for `["List", ...]`
   - `FormView` for `["Form", ...]`
   - `ReportView` for `["query-report", ...]`
6. The view loads metadata and data via `frappe.call`.
7. `before_load` and `onload` view events fire.
8. The UI is rendered.

**Client‑side events:**
- `frappe.router.on("change")` – global route change hook.
- `before_navigate` (hook in `hooks.py` on server side) – before route change.

---

## 6. Form Lifecycle

### 6.1 Frontend Form Events (frappe.ui.form.Controller)

When opening an existing document:
```
Route → get_doc (server) → form constructor
    ├── setup(frm)            # once, when form instance is created
    ├── before_load(frm)      # before data is loaded from server
    ├── onload(frm)           # after data is loaded, before DOM render
    ├── refresh(frm)          # after render, also on every refresh
    └── onload_post_render(frm)
```

**Save‑related client events:**
```
validate(frm) → before_save(frm) → frappe.call('save') → after_save(frm) → refresh(frm)
```

**Submit/cancel client events:**
```
before_submit(frm) → on_submit(frm) (client) → refresh
before_cancel(frm) → after_cancel(frm) → refresh
```

**Field‑specific events:**
- `<fieldname>_changed` – when a field value changes.
- `<fieldname>_validate` – client‑side field validation.

### 6.2 Backend Document Lifecycle (frappe.model.document.Document)

**Load document (GET):**
```
frappe.desk.form.load.getdoc()
    ├── has_permission(doctype, "read")
    ├── Document.load_from_db()
    ├── load child tables
    └── apply field‑level permissions (read‑only)
```

**Insert (new document):**
```python
doc.insert()
# Execution order:
before_insert
before_naming
autoname
before_validate
validate
before_save
db_insert
after_insert
on_update
```

**Save (existing document):**
```python
doc.save()
# Execution order:
before_validate
validate
before_save
db_update
on_update
```

**Submit:**
```python
doc.submit()
# Execution order:
before_validate
validate
before_submit
db_update (set docstatus=1)
on_submit
```

**Cancel:**
```python
doc.cancel()
# Execution order:
before_cancel
db_update (set docstatus=2)
on_cancel
```

**Rename:**
```python
frappe.rename_doc()
# Execution order:
before_rename → rename operation → after_rename
```

**Delete (trash):**
```python
doc.delete()
# Execution order:
on_trash → delete children → delete communications → after_delete
```

### 6.3 Special Flows

**Amend** (from a cancelled document):
- Copies the cancelled document → sets `amended_from` → saves as new → automatically submits.

**Child table handling** during parent save:
- Each child row triggers `before_insert` / `validate` (server side).
- After parent update, child rows are inserted/updated/deleted with `idx` reordering.

---

## 7. Child Table Lifecycle

Child tables are regular DocTypes with a `parentfield` and `parent` link.

**When parent form is saved:**
1. Client sends child table data as part of the document.
2. Server compares existing child rows with incoming data.
3. Deleted rows are removed from database.
4. New rows are inserted (trigger `before_insert`, `validate`).
5. Updated rows are saved (trigger `validate`, `on_update`).
6. `idx` field is re‑indexed.

**Events available in child table controller:**
- `before_insert`
- `validate`
- `on_update`

---

## 8. Permissions & Security

Frappe uses a **multi‑layer permission system**:

1. **Role‑based permissions** – defined in `Role` and `DocType` permission levels (read, write, create, delete, submit, cancel, etc.).
2. **User permissions** – restrict document access based on link fields (e.g., user can only see customers assigned to their territory).
3. **Sharing** – explicit sharing of a document with another user via `DocShare`.
4. **Owner rules** – user can access documents they own even without role permission (configurable).
5. **Permission Query Conditions** – custom SQL `WHERE` clauses added via `permission_query_conditions` hook.
6. **`has_permission` hook** – custom Python method to override permission checks.

**Evaluation flow** (per request):
```
frappe.has_permission(doctype, perm_type, doc)
    ├── check if system manager → True
    ├── apply role permissions
    ├── apply user permissions (if any)
    ├── apply DocShare
    └── call custom has_permission hook
```

**Field‑level permissions** – read‑only fields are marked in boot and enforced on save.

---

## 9. Report Lifecycles

### 9.1 Script Report

A **Script Report** is a custom Python report defined in:
`{app}/{app}/report/{report_name}/{report_name}.py` and `.js`.

**Lifecycle:**
1. User navigates to report URL.
2. Client loads report metadata and `.js` file.
3. `.js` defines filters and `onload` event.
4. User clicks **Run** → `frappe.call` to `execute` method.
5. Server executes `before_start(filters)` (if defined).
6. Server executes `get_data(filters)` – must return `{columns, data, chart, summary}`.
7. Server may call `get_columns(filters)` (dynamic columns).
8. Data is returned to client and rendered by `frappe.views.QueryReport`.
9. User can export (CSV/Excel/PDF) or drill down.

**Example structure:**
```python
def execute(filters=None):
    columns = [{"label": "Customer", "fieldname": "customer", "fieldtype": "Data"}]
    data = frappe.db.sql("SELECT name FROM `tabCustomer`", as_dict=1)
    return columns, data
```

### 9.2 Query Report

**Query Report** is built via the Report Builder UI (no Python).  
Lifecycle is similar but the SQL is stored in the `Report` doc and executed directly.

**Events (client‑side):**
- `onload(report)`
- `refresh(report)`

---

## 10. List View & Other Views

**List View lifecycle:**
1. Route `["List", "DocType"]` → `frappe.views.ListView`.
2. Load list metadata (fields, filters, sort order).
3. Fetch first page via `frappe.get_list`.
4. Render table / cards.
5. Events: `onload`, `before_render`, `refresh`.

**Kanban View, Calendar View, Tree View** follow similar patterns.

---

## 11. Workspace & Dashboard

**Workspace** (a configurable page): loaded from `Workspace` doctype.  
Contains:
- Links (to reports, views, custom URLs)
- Charts (from `Dashboard Chart`)
- Number Cards
- Shortcuts

**Dashboard** (on home): user‑configurable with charts and cards.

**Loading sequence:**
- Boot includes workspace data.
- On `/desk#workspace/...`, the workspace controller renders blocks.
- Charts fetch data via `frappe.call('frappe.desk.doctype.dashboard_chart.dashboard_chart.get_chart_data')`.

---

## 12. Notifications & Assignment

**Notification Rule** (doctype):  
Triggers when a document is saved and condition matches.
- Can send email, create a **Notification Log** (bell icon), or both.
- Evaluation occurs in `frappe.core.doctype.notification_log.notification_log.evaluate_trigger`.

**Assignment Rule** (doctype):  
Automatically assigns documents to users based on conditions.  
When triggered, creates a **ToDo** and optionally sends an email.

---

## 13. Realtime & WebSockets

Frappe uses **Socket.IO** for realtime events.

**Server‑side publish:**
```python
frappe.publish_realtime(event="my_event", message={"data": 123}, user="user@example.com")
```

**Client‑side subscription:**
```javascript
frappe.realtime.on("my_event", function(data) { ... });
```

**Built‑in realtime events:**
- `doc_update` – when any document is saved (sent to all users with access)
- `list_update` – when list view data changes
- `progress` – for long background jobs

**Connection:**  
Desk establishes WebSocket connection after login. Falls back to polling if WebSockets are unavailable.

---

## 14. Scheduler Architecture

The **scheduler** runs periodic jobs defined in `hooks.py` under `scheduler_events`.

**Configuration example:**
```python
scheduler_events = {
    "daily": ["myapp.tasks.daily_cleanup"],
    "hourly": ["myapp.tasks.hourly_sync"],
    "cron": {
        "0 2 * * *": ["myapp.tasks.nightly_report"]
    }
}
```

**Lifecycle:**
- `bench start` launches a `schedule` process.
- It sleeps and wakes at configured intervals (cron‑like).
- Each job is **enqueued** as a background job (not executed in the scheduler process).
- The scheduler uses Redis for locking to prevent overlapping runs.

**Important:** The scheduler does not execute business hooks like `before_save` or `on_login` – only the functions listed in `scheduler_events`.

---

## 15. Worker & Background Jobs

Frappe uses **RQ (Redis Queue)** for background jobs.

**Queues:**
- `short` – for fast jobs (< 1 min)
- `default` – for regular jobs
- `long` – for long‑running jobs (report generation, heavy data migration)

**Enqueuing a job:**
```python
frappe.enqueue("myapp.tasks.process_data", queue="long", docname=name, timeout=3600)
```

**Worker lifecycle:**
- Each queue has one or more worker processes.
- Worker polls Redis for new jobs.
- When a job is picked, it is executed in a new Python subprocess (or thread depending on configuration).
- After completion, result is stored and `on_enqueue_success` hook may fire.

**Worker processes are started by `bench start`** – they are long‑lived and recycle after a certain number of jobs.

---

## 16. Bench Commands Deep Dive

### 16.1 `bench start`

**Purpose:** Start development environment services concurrently.

**Processes launched (from `Procfile`):**
- `redis-cache` – Redis instance for caching
- `redis-queue` – Redis instance for RQ (can be same as cache with different DB)
- `web` – Gunicorn / Waitress WSGI server (port 8000)
- `socketio` – Socket.IO server (port 9000)
- `schedule` – scheduler process
- `worker-short` – RQ worker for short queue
- `worker-default` – RQ worker for default queue
- `worker-long` – RQ worker for long queue
- `watch` – Vite/esbuild asset watcher (re‑builds on file change)

**Hook execution:**  
**No Frappe business hooks are executed** (no `before_migrate`, `after_migrate`, `on_login`, `doc_events`).  
Only module imports and global initialisation (e.g., `hooks.py` loading, app registry) happen.

### 16.2 `bench restart`

**Development:** Sends SIGTERM to all processes in the Procfile, then starts them again.  
**Production:** Relies on supervisor/systemd to restart services.

**Hook execution:** Same as `bench start` – no business hooks.

### 16.3 `bench migrate`

**Purpose:** Synchronise database with current codebase (apps and core).

**Execution order (as in `frappe/migrate.py`):**
```
SiteMigration.run()
    ├── before_migrate hooks
    ├── run patches (patches.txt for each app)
    ├── sync doctypes (schema changes, add missing columns)
    ├── sync jobs (scheduler job definitions)
    ├── sync fixtures (CSV/JSON data)
    ├── sync dashboards, workspace
    ├── update translations
    ├── rebuild search index
    └── after_migrate hooks
```

**Important:**  
- Patches are executed in order and tracked in `tabPatch Log`.  
- Schema sync uses `ALTER TABLE` (MySQL/MariaDB) or `CREATE OR REPLACE` (PostgreSQL).  
- If any patch fails, the transaction is rolled back.  
- `before_migrate` and `after_migrate` are the only hooks triggered by migration.

### 16.4 `bench build`

**Purpose:** Compile frontend assets (JS, CSS) using esbuild.

**Process:**
1. Discover assets from installed apps (`public/` folders).
2. Read entry points defined in `webpack.config.js` (or default).
3. esbuild processes each entry:
   - Transpile JS/TS to ES5
   - Compile SCSS
   - Minify (in production mode)
4. Output to `sites/assets/[app-name]/dist/`.
5. Generate `manifest.json` and `assets.json`.

**Modes:**
- `bench build` – development (no minify, source maps)
- `bench build --production` – minified, hashed filenames

**Hook execution:** No hooks.

---

## 17. Asset Pipeline & Build System

Frappe v16 switched from webpack to **esbuild** for performance.

**Key files:**
- `esbuild/esbuild.js` – main build script
- `esbuild/frappe-html.js` – HTML template bundling
- `frappe/public/js/frappe` – core desk framework

**Asset serving:**  
Via the WSGI server at `/assets/[app-name]/...` (in development) or via nginx (production).

**Cache busting:**  
Production builds generate content‑hashed filenames (e.g., `desk.bundle.ABC123.js`).

---

## 18. Hooks Framework & Extension Points

All hooks are defined in `hooks.py` of each app.

**List of major hooks:**

| Hook | When executed |
|------|---------------|
| `on_login` | After successful login, before desk loads. |
| `on_logout` | During logout. |
| `before_migrate` | At start of `bench migrate`. |
| `after_migrate` | At end of `bench migrate`. |
| `doc_events` | For server‑side document events (validate, on_update, etc.). |
| `scheduler_events` | For periodic tasks. |
| `override_whitelisted_methods` | Replace built‑in API methods. |
| `override_doctype_class` | Replace document controller class. |
| `permission_query_conditions` | Add custom permission filters. |
| `has_permission` | Override permission check. |
| `fixtures` | Define data to be included in `bench migrate`. |
| `bootinfo` | Add custom data to boot JSON. |

**Example doc_events:**
```python
doc_events = {
    "Sales Invoice": {
        "validate": "myapp.api.validate_sales_invoice",
        "on_submit": "myapp.api.on_submit_sales_invoice"
    }
}
```

**Note:** `override_doctype_class` is the preferred way to replace the entire behaviour of a DocType without monkey‑patching.

---

## 19. Migration System

The migration system is responsible for applying data patches and schema changes across versions.

**Patch file (`patches.txt`):**  
List of Python module paths, one per line.  
Each patch is executed **only once** and recorded in `tabPatch Log`.

**Patch execution order:**  
Across apps defined in `installed_apps` (order matters). Within an app, the order in `patches.txt`.

**Fixture system (`fixtures.py`):**  
Define CSV/JSON files to be imported during `bench migrate`. Used for seeding master data like Roles, Users, System Settings.

**Search index rebuild:**  
After migration, the global search index (if enabled) is rebuilt.

---

## 20. Production‑Safe Customization Strategies

Based on architect‑level recommendations from the source analysis:

1. **Avoid modifying core files** – use custom apps and hooks.
2. **Prefer `override_doctype_class` over monkey‑patching** – it is designed for replacement.
3. **Use `doc_events` for adding logic without subclassing.**
4. **Keep client scripts UI‑focused** – heavy processing should be on server or background jobs.
5. **Use `frappe.enqueue` for long‑running tasks** (email blast, report generation).
6. **Never rely on `after_migrate` for runtime initialisation** – it only runs during migration.
7. **Use `scheduler_events` for recurring automation.**
8. **Design customisations to be upgrade‑safe** – test with new versions before production upgrade.

**Monkey‑patching (e.g., `frappe.model.document.Document.save = new_save`) is strongly discouraged** because it breaks across upgrades, leads to unexpected behaviour, and is hard to debug. Use the provided override mechanisms.

---

## 21. Source Code Reference Map

| Component | Path in repository |
|-----------|--------------------|
| WSGI entry | `frappe/app.py` |
| Authentication | `frappe/auth.py`, `frappe/sessions.py` |
| Request handler | `frappe/handler.py` |
| ORM core | `frappe/model/document.py`, `frappe/model/base_document.py` |
| Boot info | `frappe/boot.py` |
| Desk form load | `frappe/desk/form/load.py` |
| Desk form save | `frappe/desk/form/save.py` |
| Query report | `frappe/desk/query_report.py` |
| Realtime | `frappe/realtime.py` |
| Background jobs | `frappe/utils/background_jobs.py` |
| Scheduler | `frappe/utils/scheduler.py` |
| Migration | `frappe/migrate.py` |
| Frontend router | `frappe/public/js/frappe/router.js` |
| Frontend form | `frappe/public/js/frappe/form/form.js` |
| Frontend list view | `frappe/public/js/frappe/views/list.js` |
| Asset build | `esbuild/esbuild.js` |

---

## 22. Appendices

### A. Form Event Matrix (Frontend)

| Event | Trigger |
|-------|---------|
| `setup(frm)` | Form instance created |
| `before_load(frm)` | Before data fetch |
| `onload(frm)` | After data loaded, before render |
| `refresh(frm)` | After render, on every refresh |
| `validate(frm)` | Before save (client) |
| `before_save(frm)` | Before save request |
| `after_save(frm)` | After successful save |
| `before_submit(frm)` | Before submit request |
| `on_submit(frm)` | After submit response |
| `before_cancel(frm)` | Before cancel request |
| `after_cancel(frm)` | After cancel response |

### B. Controller Hook Matrix (Server, Document methods)

| Method | Insert | Save | Submit | Cancel | Rename | Delete |
|--------|--------|------|--------|--------|--------|--------|
| `before_insert` | ✓ |  |  |  |  |  |
| `before_naming` | ✓ |  |  |  |  |  |
| `autoname` | ✓ |  |  |  |  |  |
| `before_validate` | ✓ | ✓ | ✓ |  |  |  |
| `validate` | ✓ | ✓ | ✓ |  |  |  |
| `before_save` | ✓ | ✓ |  |  |  |  |
| `after_insert` | ✓ |  |  |  |  |  |
| `on_update` | ✓ | ✓ | ✓ |  |  |  |
| `before_submit` |  |  | ✓ |  |  |  |
| `on_submit` |  |  | ✓ |  |  |  |
| `before_cancel` |  |  |  | ✓ |  |  |
| `on_cancel` |  |  |  | ✓ |  |  |
| `before_rename` |  |  |  |  | ✓ |  |
| `after_rename` |  |  |  |  | ✓ |  |
| `on_trash` |  |  |  |  |  | ✓ |
| `after_delete` |  |  |  |  |  | ✓ |

### C. Migration Order (bench migrate)

1. `before_migrate` hooks
2. Patches (`patches.txt` in each app)
3. Schema sync (add missing columns/tables)
4. Doctype sync (update metadata cache)
5. Job sync (scheduled job definitions)
6. Fixtures import
7. Dashboard / workspace sync
8. Translations compilation
9. Search index rebuild
10. `after_migrate` hooks

### D. Bench Process List (bench start)

| Process | Purpose |
|---------|---------|
| `redis-cache` | Redis for caching and sessions |
| `redis-queue` | Redis for RQ |
| `web` | WSGI server (Gunicorn) |
| `socketio` | Socket.IO server |
| `schedule` | Scheduler process |
| `worker-short` | RQ worker (short queue) |
| `worker-default` | RQ worker (default queue) |
| `worker-long` | RQ worker (long queue) |
| `watch` | Vite/esbuild file watcher |

### E. Sequence Diagrams (Simplified)

**Login:**
```
Browser → frappe.call('login') → auth.py → validate credentials → create session in Redis → return boot → Desk loads
```

**Save Document:**
```
Form → validate (client) → before_save → frappe.call('save') → handler → Document.save() → before_validate → validate → before_save → db_update → on_update → response → after_save (client) → refresh
```

**bench migrate:**
```
CLI → frappe/migrate.py → before_migrate → patches → schema sync → fixtures → after_migrate → site ready
```

---

*This handbook is a faithful representation of Frappe v16 as observed in the official source repository. It is intended for architects who require deep technical understanding for custom development, performance tuning, and upgrade planning.*
```