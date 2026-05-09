# Xboard Commercialization Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make this fork ready for the first commercial handoff by improving admin-side node deployment, node cost tracking, business metrics, and basic health protection.

**Architecture:** Keep the existing Laravel/Xboard backend, machine-mode node system, and user portal. Add admin-only fields and APIs around the existing `v2_server`, `v2_server_machine`, `v2_stat_server`, order, and machine load history data.

**Tech Stack:** Laravel 12, MySQL-compatible migrations, Redis-backed node/device state, Workerman node websocket, existing V2 admin APIs, existing admin frontend.

---

## What We Are Building

This phase is not about adding more proxy protocols. The project already has plans, orders, payments, tickets, user traffic, device limits, node groups, node rates, machine binding, and node deployment commands.

Phase 1 adds the missing operator layer:

- Admin can create a machine and copy the install command directly from the management UI.
- Admin can see whether a machine is not connected, online, or stale.
- Admin can record server cost, provider, region, bandwidth, and billing cycle.
- Admin can see estimated revenue, configured cost, gross margin, node traffic usage, and risky nodes.
- Admin can enable simple auto-hide rules so broken or nearly-over-quota nodes disappear from customer subscriptions.

No buyer documentation is part of this phase. The buyer is known; deployment help will be given directly.

---

## Existing Code To Reuse

- Machine install command backend:
  - `scripts/node-install-command.sh`
  - `app/Http/Controllers/V2/Admin/Server/MachineController.php`
  - route group `server/machine` in `app/Http/Routes/V2/AdminRoute.php`

- Machine data:
  - `app/Models/ServerMachine.php`
  - `v2_server_machine`
  - `v2_server_machine_load_history`

- Node data:
  - `app/Models/Server.php`
  - `app/Http/Controllers/V2/Admin/Server/ManageController.php`
  - `app/Http/Requests/Admin/ServerSave.php`
  - `v2_server`

- Stats and revenue:
  - `app/Http/Controllers/V2/Admin/StatController.php`
  - `app/Services/StatisticalService.php`
  - `v2_order`
  - `v2_stat_server`
  - `v2_stat_user`

- Health signals:
  - `ServerService::touchNode`
  - `ServerService::processStatus`
  - `ServerService::updateMetrics`
  - `CheckServer` command
  - `last_check_at`, `last_push_at`, `load_status`, `metrics`, `is_online` accessors on `Server`

---

## Phase 1 Execution Order

### Task 1: Improve Machine Deployment Management

**Purpose:** The operator should not need to remember shell scripts. They should create a machine in the admin panel, copy the command, run it on the VPS, and see it come online.

**Files:**

- Modify: `app/Http/Controllers/V2/Admin/Server/MachineController.php`
- Modify: admin frontend machine page, location to be identified during implementation.
- Test: add or extend feature tests under `tests/Feature/Admin/`

**Backend changes:**

- Add `setup_status` to machine fetch:
  - `not_connected`: `last_seen_at` is null.
  - `online`: `last_seen_at >= now - 180 seconds`.
  - `stale`: `last_seen_at` exists but is older than 180 seconds.
- Add `install_command` to each machine fetch item.
- Do not include raw token as a separate field in fetch. Token should only appear inside the install command or explicit token endpoint.
- Keep existing `installCommand` endpoint.

**Admin UI changes:**

- Machine list shows:
  - Machine name.
  - Status: not connected / online / stale.
  - Last seen time.
  - Attached node count.
  - Copy install command button.
- Machine create/edit modal shows:
  - Name.
  - Notes.
  - Active switch.
  - Generated command after create.

**Acceptance check:**

- Admin can create `hongkong-1`.
- Admin can copy a command like:

```bash
curl -fsSL https://raw.githubusercontent.com/cedar2025/xboard-node/dev/install.sh | sudo bash -s -- --mode machine --panel 'http://153.92.5.18:7001' --token '***' --machine-id 3
```

- After the VPS runs the command, the admin page shows `online`.

---

### Task 2: Add Machine Commercial Fields

**Purpose:** A machine represents a real VPS bill. The admin needs to know what was bought, where, and how much it costs.

**Files:**

- Create migration: `database/migrations/YYYY_MM_DD_000001_add_commercial_fields_to_v2_server_machine_table.php`
- Modify: `app/Models/ServerMachine.php`
- Modify: `app/Http/Controllers/V2/Admin/Server/MachineController.php`
- Modify: admin frontend machine page.

**Fields:**

- `provider_name` string nullable.
- `provider_region` string nullable.
- `provider_plan` string nullable.
- `monthly_cost` integer nullable, stored in cents.
- `cost_currency` string length 8 nullable, default `USD`.
- `traffic_limit_gb` integer nullable.
- `billing_cycle` string nullable, examples: `monthly`, `quarterly`, `yearly`.
- `purchase_url` text nullable.

**Admin UI labels:**

- Provider.
- Region.
- Plan.
- Monthly cost.
- Currency.
- Traffic limit.
- Billing cycle.
- Purchase URL.

**Acceptance check:**

- Admin can enter:

```text
Provider: BandwagonHost
Region: Hong Kong HKHK_8
Plan: SPECIAL 40G KVM PROMO V5 - HONG KONG CN2 GIA
Monthly cost: 89.99
Currency: USD
Traffic limit: 500
Billing cycle: monthly
```

- The machine list persists and displays this data.

---

### Task 3: Add Node Commercial Fields

**Purpose:** A node is what users see. It can share the same machine cost or have its own cost and traffic rules. Admin needs node-level cost and notes for premium node control.

**Files:**

- Create migration: `database/migrations/YYYY_MM_DD_000002_add_commercial_fields_to_v2_server_table.php`
- Modify: `app/Models/Server.php`
- Modify: `app/Http/Requests/Admin/ServerSave.php`
- Modify: `app/Http/Controllers/V2/Admin/Server/ManageController.php`
- Modify: admin frontend node create/edit page.

**Fields:**

- `provider_name` string nullable.
- `provider_plan` string nullable.
- `monthly_cost` integer nullable, stored in cents.
- `cost_currency` string length 8 nullable, default `USD`.
- `traffic_cost_per_gb` integer nullable, stored in cents.
- `commercial_notes` text nullable.

**Rules:**

- These fields are admin-only.
- Do not expose them in user portal APIs or subscription outputs.
- If node `monthly_cost` is empty, commercial metrics can fall back to its machine cost.

**Acceptance check:**

- Admin can mark `香港01` as premium and record its monthly cost.
- User subscription still only contains ordinary proxy fields.

---

### Task 4: Build Commercial Metrics Service And API

**Purpose:** Give the operator a simple business view: income, cost, gross margin, traffic usage, and which nodes are becoming risky.

**Files:**

- Create: `app/Services/CommercialMetricsService.php`
- Create: `app/Http/Controllers/V2/Admin/CommercialController.php`
- Modify: `app/Http/Routes/V2/AdminRoute.php`
- Test: `tests/Feature/Admin/CommercialMetricsTest.php`

**Endpoints:**

- `GET /commercial/overview`
- `GET /commercial/nodes`
- `GET /commercial/machines`

**Overview metrics:**

- Current month paid revenue from `v2_order`.
- Configured monthly machine cost.
- Configured monthly node cost.
- Estimated gross margin.
- Online node count.
- Offline node count.
- Current month total traffic.

**Node metrics:**

- Node name.
- Host.
- Provider.
- Rate.
- Show/enabled state.
- Online state.
- Monthly traffic used.
- Traffic limit.
- Traffic usage percentage.
- Monthly cost.
- Estimated risk label:
  - `ok`
  - `offline`
  - `traffic_high`
  - `hidden`

**Machine metrics:**

- Machine name.
- Provider.
- Region.
- Monthly cost.
- Traffic limit.
- Last seen.
- Setup status.
- Attached node count.
- Last load status.

**Important wording:**

- Use `estimated` for margin. This is an operator estimate, not accounting-grade profit.

**Acceptance check:**

- Admin can see configured cost and estimated margin.
- API does not return machine tokens.

---

### Task 5: Add Node Health Policy Fields

**Purpose:** Let admin choose which nodes should protect themselves from bad customer experience or overage cost.

**Files:**

- Create migration: `database/migrations/YYYY_MM_DD_000003_add_health_policy_fields_to_v2_server_table.php`
- Modify: `app/Models/Server.php`
- Modify: `app/Http/Requests/Admin/ServerSave.php`
- Modify: admin frontend node create/edit page.

**Fields:**

- `auto_hide_enabled` boolean default false.
- `auto_hide_reason` string nullable.
- `auto_hide_at` integer nullable.
- `health_offline_minutes` integer nullable default 30.
- `health_traffic_threshold` integer nullable default 95.
- `health_cpu_threshold` integer nullable default 95.

**Rules:**

- `show` still controls customer visibility.
- `enabled` still controls whether the machine should run the node.
- Auto-hide changes `show` to false.
- Auto-hide does not change `enabled`.
- Auto-hide records reason and timestamp.

**Acceptance check:**

- Admin can enable auto-hide on `香港01`.
- Admin can configure threshold values.

---

### Task 6: Implement Auto-Hide Command

**Purpose:** Automatically hide bad or risky nodes from customer subscriptions.

**Files:**

- Create: `app/Services/NodeHealthPolicyService.php`
- Create: `app/Console/Commands/ApplyNodeHealthPolicy.php`
- Modify: `app/Console/Kernel.php`
- Test: `tests/Feature/Admin/NodeHealthPolicyTest.php`

**Command:**

```bash
php artisan node:apply-health-policy
```

**Rules:**

- Skip if `auto_hide_enabled` is false.
- Hide when node has no recent heartbeat for `health_offline_minutes`.
- Hide when node traffic usage reaches `health_traffic_threshold`.
- Hide when latest machine or node CPU load reaches `health_cpu_threshold`.
- First version does not auto-show recovered nodes. Admin must manually show the node again.

**Reason values:**

- `offline`
- `traffic_threshold`
- `cpu_threshold`

**Acceptance check:**

- A stale node with auto-hide enabled becomes hidden.
- A near-quota node with auto-hide enabled becomes hidden.
- A healthy node remains visible.
- A hidden node is not returned to user subscriptions.

---

### Task 7: Add Admin Ops Application

**Purpose:** Make the new commercial API usable in a maintainable admin operations app without editing the upstream compiled admin dist.

**Files:**

- Create: `apps/admin-ops`
- Create: `resources/views/admin_ops.blade.php`
- Modify: `routes/web.php`
- Create build script: `scripts/build-admin-ops.sh`

**UI sections:**

- Business summary:
  - Month revenue.
  - Configured monthly cost.
  - Estimated gross margin.
  - Month traffic.
- Node risk list:
  - Offline nodes.
  - High traffic nodes.
  - Hidden nodes.
- Machine list:
  - Setup status.
  - Provider.
  - Region.
  - Cost.
  - Last seen.
- Copy install command.
- Edit commercial machine fields.
- Node list:
  - Provider.
  - Cost.
  - Traffic usage.
  - Auto-hide state and reason.

**Acceptance check:**

- Admin can open `/admin-ops`, log in with an admin account, and manage the commercial operations workflow without using SSH except to run the copied node install command.

---

## Verification

Backend:

```bash
php artisan test
```

If `apps/admin-ops` is changed:

```bash
scripts/build-admin-ops.sh
```

If `apps/user-portal` is changed, also run:

```bash
scripts/build-user-portal-theme.sh
rg "changed text or behavior keyword" storage/theme/Northline/assets
```

This Phase 1 plan should avoid `apps/user-portal` unless we explicitly decide to polish the customer portal later.

---

## Commit Strategy

Use one commit per task:

1. `feat: improve machine deployment management`
2. `feat: add machine commercial metadata`
3. `feat: add node commercial metadata`
4. `feat: add commercial metrics api`
5. `feat: add node health policy fields`
6. `feat: apply node health policies`
7. `feat: add commercial dashboard ui`

Do not mix unrelated UI polish into these commits.
