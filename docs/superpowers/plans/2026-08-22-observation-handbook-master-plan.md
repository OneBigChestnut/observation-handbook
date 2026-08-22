# 观察手册统一开发总计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Do not dispatch parallel agents. Each changed behavior starts with one failing focused test, then receives one implementation and one verification run.

**Goal:** 在独立的“观察手册”仓库内交付一个必须登录、按小朋友隔离、A5 竖版出版的家庭观察记录系统。

**Architecture:** 本仓库只保留一个 React/Vite 家庭应用和一个 Fastify API；公共空间、家庭端和超级管理员后台是同一应用中的受控左侧导航项，而不是三套前端。API 使用 Drizzle ORM + SQLite，媒体存于本仓库配置的受控目录；浏览器不保存权威业务状态。

**Tech Stack:** React 19、Vite 6、Fastify 5、TypeScript、Drizzle ORM、better-sqlite3、Sharp、Vitest。

**Spec:** `docs/superpowers/specs/2026-08-22-authenticated-observation-platform-design.md`

## This Is the Authoritative Plan

- 本文件取代此前按“基础认证”“持久化内容”“标签驱动手册”拆开的执行顺序；旧计划保留为历史记录，不再作为任务来源。
- `main` 是唯一可交付分支；`codex/authenticated-platform-foundation` 只用于完成当前未提交的手册创建红测和接受合并前验证。
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

**Current state:** in progress. Authentication, child-scoped media/cards/tags/handbooks, and most real-data readers exist on `codex/authenticated-platform-foundation`; the branch has one uncommitted red test for handbook creation.

**Files:**
- Modify: `apps/web/src/api/client.ts`, `apps/web/src/main.tsx`
- Create: `apps/web/src/content/CreateHandbookForm.tsx`
- Test: `apps/web/src/content/CreateHandbookForm.spec.tsx`

**Produces:** `apiClient.createHandbook(childId, payload)` and an administrator-only form that selects existing child tags and cards, then reloads the handbook list.

- [ ] Write/retain the focused failing test for title, introduction, selected tags, selected cards, and `onCreated`.
- [ ] Run `pnpm --filter @observation-handbook/web test -- CreateHandbookForm.spec.tsx`; confirm it fails before the component exists.
- [ ] Implement the form against `POST /api/children/:childId/handbooks`; use only existing child IDs and call `onCreated` after a 201 response.
- [ ] Run `pnpm --filter @observation-handbook/web test -- CreateHandbookForm.spec.tsx && pnpm typecheck`.
- [ ] Run `pnpm test && pnpm typecheck && pnpm --filter @observation-handbook/web build && git diff --check`; merge the verified branch into `main` with commit message `feat: consolidate authenticated observation foundation`.

**Gate:** a fresh clone can run API and web, sign in with the development seed, create a card/tag/handbook for one child, and a reader can only read it.

### Stage 1 — Complete Family Content Lifecycle

**Files:**
- Create: `apps/api/src/routes/observation-lifecycle.spec.ts`
- Modify: `apps/api/src/routes/observations.ts`, `apps/api/src/routes/handbooks.ts`, `apps/api/src/db/schema.ts`
- Create: `apps/web/src/content/ObservationCardEditor.tsx`, `apps/web/src/content/HandbookDetail.tsx`
- Test: `apps/web/src/content/ObservationCardEditor.spec.tsx`, `apps/web/src/content/HandbookDetail.spec.tsx`

**Produces:** `PATCH /api/cards/:cardId`, soft archive/delete with handbook reference checks, explicit handbook card reorder, and completion-state UI.

- [ ] Write tests proving reader mutation is 403, foreign-child mutation is 403, a referenced card cannot be permanently removed, and a reordered handbook persists its positions.
- [ ] Run `pnpm --filter @observation-handbook/api test -- observation-lifecycle.spec.ts`; confirm failure.
- [ ] Implement `active | archived | deleted` card state, audit rows, `affectedHandbookIds`, and explicit `cardIds` order replacement in one database transaction.
- [ ] Write web tests proving archived cards leave normal lists and “完成观察” writes `completedAt` without changing selected cards.
- [ ] Run API/web focused tests, then commit `feat: complete observation content lifecycle`.

**Gate:** the administrator can safely edit/archive a card, see affected handbooks before destructive action, reorder a handbook, and mark its observation complete; readers cannot mutate any item.

### Stage 2 — Global A5 Template Versions and Super-Admin Management

**Files:**
- Modify: `apps/api/src/db/schema.ts`, `apps/api/drizzle/`
- Create: `apps/api/src/routes/templates.ts`, `apps/api/src/routes/templates.spec.ts`
- Create: `apps/web/src/admin/TemplateManagementPage.tsx`, `apps/web/src/admin/TemplateManagementPage.spec.tsx`
- Create: `apps/web/src/content/TemplateSelector.tsx`
- Modify: `apps/web/src/main.tsx`, `apps/web/src/api/client.ts`

**Produces:** `TemplateVersion` records with `kind: cover | back | card_1 | card_2 | card_3 | card_4`, `state: draft | published | retired`, and admin-only CRUD/version actions.

- [ ] Write API tests: non-super-admin receives 403; all created layouts have `paperSize: "A5"` and `orientation: "portrait"`; a referenced version cannot be edited or deleted and becomes `retired` instead.
- [ ] Run `pnpm --filter @observation-handbook/api test -- templates.spec.ts`; confirm failure.
- [ ] Implement template versions, immutable usage counter/snapshot reference, and published-selector queries by `kind`; reject any paper size other than A5.
- [ ] Write web tests that a card with three photos only lists `card_3` templates and a handbook lists only published cover/back templates.
- [ ] Run focused tests, `pnpm typecheck`, and commit `feat: add immutable A5 template management`.

**Gate:** only a super administrator can manage templates; family administrators can choose but never edit published templates.

### Stage 3 — Publication-Grade Export Jobs

**Files:**
- Modify: `apps/api/src/db/schema.ts`, `apps/api/drizzle/`
- Create: `apps/api/src/exports/preflight.ts`, `apps/api/src/exports/render.ts`
- Create: `apps/api/src/routes/exports.ts`, `apps/api/src/routes/exports.spec.ts`
- Create: `apps/web/src/content/ExportHandbookDialog.tsx`, `apps/web/src/content/ExportFileList.tsx`
- Test: `apps/web/src/content/ExportHandbookDialog.spec.tsx`, `apps/api/src/exports/preflight.spec.ts`

**Produces:** `POST /api/children/:childId/exports`, `GET /api/children/:childId/exports`, `GET /api/exports/:exportId/download`, and `DELETE /api/exports/:exportId`.

- [ ] Write preflight tests for empty handbook, no cover photo, template retired, insufficient image resolution, and text outside safe area.
- [ ] Run `pnpm --filter @observation-handbook/api test -- preflight.spec.ts`; confirm failure.
- [ ] Implement immutable export snapshots containing handbook/card order, cover/back/card template versions, media references, preflight result, output kind, and generated time.
- [ ] Write route tests verifying screen output has `bleedMm: 0` and no crop marks, while print output has `bleedMm: 3` and crop marks; reader requests return 403.
- [ ] Write web test: the only entry point is the header “导出手册” button; dialog completion adds a downloadable file and delete removes only that file record.
- [ ] Run focused tests and commit `feat: add A5 handbook export jobs`.

**Gate:** an administrator can select a handbook and one of two PDF types, pass preflight, download the immutable result, and delete generated files without changing content.

### Stage 4 — Authenticated Public Publishing

**Files:**
- Modify: `apps/api/src/db/schema.ts`, `apps/api/drizzle/`
- Create: `apps/api/src/routes/publications.ts`, `apps/api/src/routes/publications.spec.ts`
- Create: `apps/web/src/content/PublicHandbookList.tsx`, `apps/web/src/content/PublicHandbookReader.tsx`
- Test: `apps/web/src/content/PublicHandbookReader.spec.tsx`
- Modify: `apps/web/src/main.tsx`, `apps/web/src/api/client.ts`

**Produces:** publish, publish-new-version, withdraw, super-admin downlist/restore endpoints, plus authenticated public list/detail projections.

- [ ] Write API tests proving no-session public request is 401; publish stores a snapshot; later handbook edits do not alter it; withdraw and downlist return 404 to public readers.
- [ ] Run `pnpm --filter @observation-handbook/api test -- publications.spec.ts`; confirm failure.
- [ ] Implement immutable publication snapshots with only display-safe thumbnail and text fields; never return original paths, family-member data, tags-management state, exports, or editor metadata.
- [ ] Write web tests that public navigation is visible after login, excludes private/withdrawn content, and no edit action appears for another family.
- [ ] Run focused tests and commit `feat: add authenticated handbook publishing`.

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
- Current baseline: Stage 0 is in progress; Stage 1–6 are not started. Until Stage 0 merges, report the implementation branch as **35%** and `main` as **15%**.

## Self-Review

- This plan resolves prior conflicts by fixing one app shell, one API, one ORM, one database, one A5 specification, one authentication rule, and one integration branch.
- The former Prisma wording in the older design is superseded by this plan’s Drizzle requirement.
- It covers every confirmed subsystem: roles, child isolation, cards/tags/handbooks, templates, screen/print PDF, public space, family accounts, platform administration, audit, responsive navigation, and acceptance verification.
