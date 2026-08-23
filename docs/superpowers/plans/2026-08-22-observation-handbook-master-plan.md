# 观察手册统一开发总计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Do not dispatch parallel agents. Each changed behavior starts with one failing focused test, then receives one implementation and one verification run.

**Goal:** 在独立的“观察手册”仓库内交付一个必须登录、按小朋友隔离、A5 竖版出版的家庭观察记录系统。

**Architecture:** 本仓库只保留一个 React/Vite 家庭应用和一个 Fastify API；公共空间、家庭端和超级管理员后台是同一应用中的受控左侧导航项，而不是三套前端。API 使用 Drizzle ORM + SQLite，媒体存于本仓库配置的受控目录；浏览器不保存权威业务状态。

**Tech Stack:** React 19、Vite 6、Fastify 5、TypeScript、Drizzle ORM、better-sqlite3、Sharp、Vitest。

**Spec:** `docs/superpowers/specs/2026-08-23-delivery-convergence-design.md`

## This Is the Authoritative Plan

- 本文件取代此前按“基础认证”“持久化内容”“标签驱动手册”拆开的执行顺序；旧计划保留为历史记录，不再作为任务来源。
- `main` 是唯一可交付分支；浏览器内存原型只保留为视觉参考，不得成为新功能的业务状态来源。
- `codex/authenticated-platform-foundation` 是当前阶段 0 的唯一实现分支；先修复、验证并合并它，再开始阶段 1–6。
- 所有新功能在合并到 `main` 后继续开发；不再创建第二套 schema、第二个 API 或第二个页面壳层。
- 已删除的“儿童自然观察作品集”不被导入、复制、引用或迁移；空 SQLite 数据库必须可独立启动。

## Immutable Product Rules

- 全站固定 A5 竖版；不出现 A4、横版、正方形或纸张大小选择。
- 所有页面（家庭端、公共空间、后台中心）必须登录后才能访问；后台中心只显示给超级管理员。
- 每个家庭恰有一名 `admin`，其他成人均为 `reader`；reader 没有任何写入、发布或导出权限。
- 卡片、标签、手册、导出文件和媒体均严格属于一个小朋友；服务端按当前会话和 `childId` 双重校验。
- 卡片有 1–4 张照片、观察日期、文字和标签；小尺寸界面只加载服务端缩略图。
- 标签可作为创建手册的候选池：创建时带入已有同儿童卡片，未来同标签卡片只能由管理员明确加入，不自动加入。
- 手册必须可直接识别名称、内容介绍、开始时间、完成时间/持续观察状态、最近记录和封面；卡片排序归手册维护。
- 模板由超级管理员管理，固定为 A5 竖版的封面、封底、1/2/3/4 图卡片；已被使用的版本永远冻结，只能停用。
- 导出对话框先选择手册和输出类型；屏幕 PDF 无出血裁切线，印刷 PDF 固定 3 mm 出血与裁切线；生成文件可下载或删除。
- 家庭管理员发布后立即公开；公开读取仅面向已登录账户，发布使用不可变快照，撤回立即隐藏公开版本。
- 删除采用软删除和引用检查；旧项目清理已经完成，不得再以任何方式访问其目录。

## Source and File Boundaries

| Area | Source of truth | Responsibility |
| --- | --- | --- |
| Domain rules | `packages/domain/src/` | 角色、儿童范围、A5、模板状态、导出预检输入校验 |
| Persistent data | `apps/api/src/db/schema.ts`, `apps/api/drizzle/` | Drizzle schema、迁移、SQLite 约束 |
| API services | `apps/api/src/routes/` | 会话、范围授权、审计、媒体、卡片、手册、发布、导出、后台 |
| Media | `apps/api/src/media/` | 原图、缩略图、印刷派生图和授权读取 |
| Web API boundary | `apps/web/src/api/client.ts` | 唯一 fetch 封装与 DTO |
| Web feature UI | `apps/web/src/auth/`, `apps/web/src/content/`, `apps/web/src/admin/` | 登录、家庭端、公共空间、后台页面 |
| Global shell | `apps/web/src/main.tsx` | 路由/导航装配；不得重新成为业务状态仓库 |

## Delivery Stages and Acceptance Gates

### Stage 0 — Consolidate the Existing Authenticated Foundation

**Current state:** in progress. Authentication、Drizzle/SQLite、家庭和儿童范围校验、受控媒体缩略图、卡片/标签/手册 API 与部分 Web 读取器已在 `codex/authenticated-platform-foundation` 实现。该分支有未提交的 `CreateHandbookForm` 和测试；表单引用的 `apiClient.createHandbook` 缺失，完整类型检查尚未通过。

**Files:**
- Modify: `apps/web/src/api/client.ts`, `apps/web/src/main.tsx`, `apps/web/src/content/ChildContentLoader.tsx`
- Create: `apps/web/src/content/CreateHandbookForm.tsx`
- Test: `apps/web/src/content/CreateHandbookForm.spec.tsx`

**Produces:** `apiClient.createHandbook(childId, payload)`、管理员专属的手册创建表单，以及在 API 成功后重新加载当前儿童手册列表的受控内容壳层。

- [ ] **Step 1: 补齐客户端写入契约。** 在 `api/client.ts` 定义 `CreateHandbookPayload = { title: string; introduction: string; startedAt: string; completedAt?: string; tagIds: string[]; cardIds: string[] }`，并实现 `createHandbook(childId, payload)`，以 `POST /api/children/:childId/handbooks` 发送 JSON，返回 `{ id: string }`。
- [ ] **Step 2: 先运行类型检查，确认当前失败。** Run: `pnpm typecheck`。Expected: FAIL，提示 `apiClient.createHandbook` 不存在。
- [ ] **Step 3: 验证客户端和表单。** Run: `pnpm --filter @observation-handbook/web test -- CreateHandbookForm.spec.tsx`。Expected: PASS，覆盖标题、介绍、标签、卡片、提交 payload 和 `onCreated`。
- [ ] **Step 4: 接入真实壳层。** 在 `ChildContentLoader` 和 `main.tsx` 中仅对当前 API 返回的儿童、卡片、标签和手册渲染；管理员显示创建卡片、标签、手册入口，reader 不显示任何写入入口。
- [ ] **Step 5: 验证角色和范围。** 保留并运行 API 测试，证明无会话为 401、reader 写入为 403、跨家庭和跨儿童为 403；新增 Web 测试，证明手册创建成功后重新读取当前儿童列表。
- [ ] **Step 6: 运行阶段验收。** Run: `pnpm test && pnpm typecheck && pnpm --filter @observation-handbook/web build && git diff --check`。Expected: PASS。
- [ ] **Step 7: 进行可复现的启动验收。** 从空 SQLite 数据库执行迁移和开发种子，启动 API 与 Web；以管理员创建卡片、标签、手册后刷新页面确认数据保留；以 reader 登录确认只能读取。记录实际命令并更新 README。
- [ ] **Step 8: 提交并合并。** 在实现分支提交 `feat: consolidate authenticated observation foundation`；在 `main` 合并该提交并再次运行完整阶段验收。

**Gate:** 新克隆可从空 SQLite 数据库迁移和启动 API/Web；管理员可以登录并为一个儿童创建卡片、标签和手册，刷新后数据保留；reader 只能读取；无会话、跨家庭和跨儿童请求均被 API 拒绝；所有测试、类型检查、Web 构建和 diff 检查通过。

### Stage 1 — Complete Family Content Lifecycle

**Files:**
- Create: `apps/api/src/routes/observation-lifecycle.spec.ts`
- Modify: `apps/api/src/routes/observations.ts`, `apps/api/src/routes/handbooks.ts`, `apps/api/src/db/schema.ts`
- Create: `apps/web/src/content/ObservationCardEditor.tsx`, `apps/web/src/content/HandbookDetail.tsx`
- Test: `apps/web/src/content/ObservationCardEditor.spec.tsx`, `apps/web/src/content/HandbookDetail.spec.tsx`

**Produces:** `PATCH /api/cards/:cardId`, soft archive/delete with handbook reference checks, explicit handbook card reorder, and completion-state UI.

- [x] Write tests proving reader mutation is 403, foreign-child mutation is 403, a referenced card cannot be archived, and a reordered handbook persists its positions.
- [x] Implement active/archived card state, audit rows, `affectedHandbookIds`, and explicit `cardIds` order replacement.
- [x] Write web tests proving archived cards leave normal lists and “完成观察” writes `completedAt` without changing selected cards.
- [x] Run API/web tests, typecheck, production build, and diff check.

**Gate:** the administrator can safely edit/archive a card, see affected handbooks before destructive action, reorder a handbook, and mark its observation complete; readers cannot mutate any item.

### Stage 2 — Global A5 Template Versions and Super-Admin Management

**Files:**
- Modify: `apps/api/src/db/schema.ts`, `apps/api/drizzle/`
- Create: `apps/api/src/routes/templates.ts`, `apps/api/src/routes/templates.spec.ts`
- Create: `apps/web/src/admin/TemplateManagementPage.tsx`, `apps/web/src/admin/TemplateManagementPage.spec.tsx`
- Create: `apps/web/src/content/TemplateSelector.tsx`
- Modify: `apps/web/src/main.tsx`, `apps/web/src/api/client.ts`

**Produces:** `TemplateVersion` records with `kind: cover | back | card_1 | card_2 | card_3 | card_4`, `state: draft | published | retired`, and admin-only CRUD/version actions.

- [x] Write API tests: non-super-admin receives 403; all created layouts have `paperSize: "A5"` and `orientation: "portrait"`; a referenced version cannot be edited or deleted and becomes `retired` instead.
- [x] Implement template versions, immutable usage references, and published-selector queries by `kind`; A5 portrait values are server-owned and fixed.
- [x] Write web tests that a three-photo card requests only `card_3` templates, and expose the super-admin template management page.
- [x] Run full tests, `pnpm typecheck`, production build, and diff check.

**Gate:** only a super administrator can manage templates; family administrators can choose but never edit published templates.

### Stage 3 — Publication-Grade Export Jobs

**Files:**
- Modify: `apps/api/src/db/schema.ts`, `apps/api/drizzle/`
- Create: `apps/api/src/exports/preflight.ts`, `apps/api/src/exports/render.ts`
- Create: `apps/api/src/routes/exports.ts`, `apps/api/src/routes/exports.spec.ts`
- Create: `apps/web/src/content/ExportHandbookDialog.tsx`, `apps/web/src/content/ExportFileList.tsx`
- Test: `apps/web/src/content/ExportHandbookDialog.spec.tsx`, `apps/api/src/exports/preflight.spec.ts`

**Produces:** `POST /api/children/:childId/exports`, `GET /api/children/:childId/exports`, `GET /api/exports/:exportId/download`, and `DELETE /api/exports/:exportId`.

- [x] Write preflight tests for empty handbook, no cover photo, template retired, insufficient image resolution, and text outside safe area.
- [x] Implement immutable export-job snapshots and authenticated create/list/download/delete routes.
- [x] Verify screen output uses `bleedMm: 0` without crop marks, print uses `bleedMm: 3` with crop marks, and reader writes return 403.
- [x] Add family-side export dialog/workspace with create, download and delete interactions.
- [x] Run full tests, typecheck, production build and diff check.

**Gate:** an administrator can select a handbook and one of two PDF types, pass preflight, download the immutable result, and delete generated files without changing content.

### Stage 4 — Authenticated Public Publishing

**Files:**
- Modify: `apps/api/src/db/schema.ts`, `apps/api/drizzle/`
- Create: `apps/api/src/routes/publications.ts`, `apps/api/src/routes/publications.spec.ts`
- Create: `apps/web/src/content/PublicHandbookList.tsx`, `apps/web/src/content/PublicHandbookReader.tsx`
- Test: `apps/web/src/content/PublicHandbookReader.spec.tsx`
- Modify: `apps/web/src/main.tsx`, `apps/web/src/api/client.ts`

**Produces:** publish, publish-new-version, withdraw, super-admin downlist/restore endpoints, plus authenticated public list/detail projections.

- [x] Write API tests proving unauthenticated public requests are rejected, publication snapshots survive later handbook edits, and withdrawal returns 404.
- [x] Implement authenticated immutable publication snapshots and withdraw routes with family-admin authorization.
- [x] Add public list and reader components using display-safe projections only.
- [x] Run full tests, typecheck, production build and diff check.

**Gate:** any logged-in household may read published handbooks, while only the owning family administrator can publish or withdraw.

### Stage 5 — Member, Family, and Audit Administration

**Files:**
- Modify: `apps/api/src/routes/families.ts`, `apps/api/src/routes/auth.ts`
- Create: `apps/api/src/routes/admin.ts`, `apps/api/src/routes/admin.spec.ts`
- Create: `apps/web/src/admin/FamilyAccountPage.tsx`, `apps/web/src/admin/AuditLogPage.tsx`
- Test: `apps/web/src/admin/FamilyAccountPage.spec.tsx`, `apps/web/src/admin/AuditLogPage.spec.tsx`
- Modify: `apps/web/src/main.tsx`, `apps/web/src/api/client.ts`

**Produces:** administrator member add/remove/reset-password routes and super-admin family-account/audit pages.

- [ ] Write route tests: an admin can add/remove readers but cannot remove the sole admin; reset creates a one-time temporary password and logs the action; ordinary admins receive 403 from `/api/admin/*`.
- [ ] Run `pnpm --filter @observation-handbook/api test -- admin.spec.ts`; confirm failure.
- [ ] Implement member lifecycle transactions, password-reset flag, paginated audit projection, and super-admin-only family status controls without exposing family content editing.
- [ ] Write web tests that the family page hides all writes for readers and that the backend navigation item is absent for non-super-admins.
- [ ] Run focused tests and commit `feat: add family and platform administration`.

**Gate:** the requested three backend areas—family/member accounts, templates, audit logs—are separate pages and have server-enforced roles.

### Stage 6 — Final Acceptance and Release Preparation

**Files:**
- Create: `apps/api/src/routes/acceptance.spec.ts`
- Create: `apps/web/src/acceptance/observation-flow.spec.tsx`
- Modify: `README.md`

**Produces:** reproducible local startup, acceptance fixtures, and a truthful release checklist.

- [ ] Write an end-to-end API flow: admin logs in, adds reader, creates 1–4 photo card, tags it, creates/finishes handbook, selects A5 templates, creates screen/print exports, publishes, withdraws; reader can only read.
- [ ] Run `pnpm test && pnpm typecheck && pnpm --filter @observation-handbook/web build && pnpm --filter @observation-handbook/api test`.
- [ ] Render one screen PDF and one print PDF; visually verify A5 dimensions, no marks for screen output, and 3 mm bleed/crop marks for print output.
- [ ] Verify desktop, tablet, and mobile left navigation/drawer behavior and independent workspace scrolling.
- [ ] Update README with exact setup, migration, seed, API/web startup, test, backup, and restore commands; commit `docs: add observation handbook release guide`.

**Gate:** all product rules above have automated evidence; `main` is clean, runnable, and does not reference the deleted project.

## Progress Reporting Contract

- Report only two percentages: **implementation branch completion** and **`main` deliverable completion**.
- A stage counts only after its acceptance gate passes and its commit is present on `main`.
- Do not count visual prototypes, uncommitted code, unchecked historical-plan tasks, or inherited old-project functionality.
- Current baseline: Stages 0–4 are merged on `main`; Stages 5–6 are not started. Report the implementation branch and `main` deliverable as **70%**.

## Self-Review

- This plan resolves prior conflicts by fixing one app shell, one API, one ORM, one database, one A5 specification, one authentication rule, and one integration branch.
- The former Prisma wording in the older design is superseded by this plan’s Drizzle requirement.
- It covers every confirmed subsystem: roles, child isolation, cards/tags/handbooks, templates, screen/print PDF, public space, family accounts, platform administration, audit, responsive navigation, and acceptance verification.
