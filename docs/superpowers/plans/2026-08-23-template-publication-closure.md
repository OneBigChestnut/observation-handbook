# 模板出版闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将全局 A5 固定模板从权限元数据升级为可选择、可冻结、可用于真实导出的出版闭环。

**Architecture:** 模板版本保存固定版式规范与状态；家庭仅选择已发布版本。手册保存封面/封底模板，卡片保存按照片数量匹配的卡片模板；导出任务读取这些引用、执行预检并将模板与内容快照写入不可变任务记录。

**Tech Stack:** React 19、TypeScript、Fastify 5、Drizzle/SQLite、Sharp、jsPDF、Vitest。

**Spec:** `docs/superpowers/specs/2026-08-23-delivery-convergence-design.md`

## Global Constraints

- 全站固定 A5 竖版；模板种类仅为封面、封底、1/2/3/4 图卡片。
- 家庭不可创建模板或进入自由页面编辑器；仅超级管理员管理全局版本。
- 已被手册、卡片或导出任务引用的模板版本不可修改或删除，只能停用。
- 停用版本不能用于新建内容；历史手册和导出按其快照保留。
- 所有新行为先以失败测试定义，再写实现；不得引入第二套业务状态。

---

### Task 1: 扩展模板与内容引用的数据模型

**Files:**
- Modify: `apps/api/src/db/schema.ts`
- Create: `apps/api/drizzle/0002_template_references.sql`
- Modify: `apps/api/src/routes/handbooks.ts`
- Modify: `apps/api/src/routes/observations.ts`
- Test: `apps/api/src/routes/templates.spec.ts`

**Interfaces:**
- Produces: `TemplateVersion.layout`、`Handbook.coverTemplateId`、`Handbook.backTemplateId`、`ObservationCard.templateId`。
- Consumes: `TemplateVersion.kind/state` and card media count.

- [ ] **Step 1: Write the failing API tests**

```ts
expect((await app.inject({ method: "POST", url: "/api/children/c/handbooks", headers: { cookie }, payload: {
  title: "河流", introduction: "", startedAt: "2026-01-01", cardIds: [], tagIds: [], coverTemplateId: "cover-live", backTemplateId: "back-live"
} })).statusCode).toBe(201);
expect((await app.inject({ method: "POST", url: "/api/children/c/cards", headers: { cookie }, payload: {
  observedAt: "2026-01-01", text: "", mediaAssetIds: ["media-a", "media-b"], tagNames: [], templateId: "card-two-live"
} })).statusCode).toBe(201);
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm vitest run apps/api/src/routes/templates.spec.ts`

Expected: FAIL because content routes do not accept or persist template IDs.

- [ ] **Step 3: Add migration and server validation**

```ts
const template = await database.query.templateVersions.findFirst({ where: eq(templateVersions.id, templateId) });
if (!template || template.state !== "published" || template.kind !== requiredKind) return reply.code(400).send({ code: "TEMPLATE_SELECTION_INVALID" });
```

Persist the selected IDs and insert `templateUsages` with `referenceType` `handbook_cover`, `handbook_back`, or `observation_card`.

- [ ] **Step 4: Run the focused test and verify pass**

Run: `pnpm vitest run apps/api/src/routes/templates.spec.ts`

Expected: PASS; invalid kind, retired template, and mismatched photo-count selection return 400.

### Task 2: 完成超级管理员模板工作台

**Files:**
- Modify: `apps/web/src/admin/TemplateManagementPage.tsx`
- Modify: `apps/web/src/admin/TemplateManagementPage.spec.tsx`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/api/src/routes/templates.ts`

**Interfaces:**
- Consumes: `TemplateSummary { id, name, kind, state, layout }`.
- Produces: create/edit/publish/retire operations for unused template versions.

- [ ] **Step 1: Write the failing UI test**

```tsx
render(<TemplateManagementPage loadTemplates={load} createTemplate={create} updateTemplate={update} retireTemplate={retire} />);
await user.click(screen.getByRole("button", { name: "新建模板" }));
await user.selectOptions(screen.getByLabelText("模板类型"), "card_2");
await user.click(screen.getByRole("button", { name: "发布模板" }));
expect(create).toHaveBeenCalledWith(expect.objectContaining({ kind: "card_2", state: "published" }));
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm vitest run apps/web/src/admin/TemplateManagementPage.spec.tsx`

Expected: FAIL because the current page is a list with only a stop-use action.

- [ ] **Step 3: Implement editor and visual preview**

Implement a compact schema-owned layout panel: title position, text alignment, photo grid and paper-safe margins are selectable only from fixed presets. Render the preview from `layout`; do not expose a free canvas or arbitrary CSS editor.

- [ ] **Step 4: Run the focused test and verify pass**

Run: `pnpm vitest run apps/web/src/admin/TemplateManagementPage.spec.tsx`

Expected: PASS; super administrator can create draft/published versions, edit only unused ones, and retire used ones.

### Task 3: 在家庭内容流程中接入已发布模板

**Files:**
- Modify: `apps/web/src/content/CreateHandbookForm.tsx`
- Modify: `apps/web/src/content/CreateObservationCardForm.tsx`
- Modify: `apps/web/src/content/TemplateSelector.tsx`
- Modify: `apps/web/src/content/CreateHandbookForm.spec.tsx`
- Modify: `apps/web/src/content/CreateObservationCardForm.spec.tsx`

**Interfaces:**
- Consumes: `GET /api/templates?kind=cover|back|card_1|card_2|card_3|card_4`.
- Produces: handbook `coverTemplateId/backTemplateId` and card `templateId` in API payloads.

- [ ] **Step 1: Write failing form tests**

```tsx
expect(await screen.findByRole("option", { name: "自然封面" })).toBeInTheDocument();
await user.selectOptions(screen.getByLabelText("封面模板"), "cover-natural");
await user.click(screen.getByRole("button", { name: "创建手册" }));
expect(createHandbook).toHaveBeenCalledWith("child-a", expect.objectContaining({ coverTemplateId: "cover-natural" }));
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `pnpm vitest run apps/web/src/content/CreateHandbookForm.spec.tsx apps/web/src/content/CreateObservationCardForm.spec.tsx`

Expected: FAIL because forms do not load or submit template IDs.

- [ ] **Step 3: Implement constrained selectors**

Use `TemplateSelector` for cover and back in the handbook form. Select card kind only from uploaded-photo count, then require one matching published template before submit. Show an explicit empty-state if the platform has not published that required type.

- [ ] **Step 4: Run focused tests and verify pass**

Run: `pnpm vitest run apps/web/src/content/CreateHandbookForm.spec.tsx apps/web/src/content/CreateObservationCardForm.spec.tsx`

Expected: PASS; families can select only published matching templates and payloads carry their IDs.

### Task 4: 真实模板快照与 PDF 导出

**Files:**
- Modify: `apps/api/src/routes/exports.ts`
- Modify: `apps/api/src/exports/preflight.ts`
- Create: `apps/api/src/exports/render.ts`
- Modify: `apps/api/src/routes/exports.spec.ts`
- Modify: `apps/web/src/content/ExportWorkspace.tsx`
- Modify: `apps/web/src/content/ExportHandbookDialog.spec.tsx`

**Interfaces:**
- Consumes: stored handbook/card template IDs, template layout, ordered cards and media.
- Produces: export snapshot `{ handbook, cards, templates, preflight, format }` and a valid PDF binary.

- [ ] **Step 1: Write failing export tests**

```ts
const result = await app.inject({ method: "POST", url: "/api/children/c/exports", headers: { cookie }, payload: { handbookId: "h", kind: "print" } });
expect(result.statusCode).toBe(201);
expect(result.json().export.snapshot).toContain("coverTemplateId");
expect(result.json().export.snapshot).toContain("preflight");
```

- [ ] **Step 2: Run focused test and verify failure**

Run: `pnpm vitest run apps/api/src/routes/exports.spec.ts`

Expected: FAIL because export snapshots currently contain only title and paper settings.

- [ ] **Step 3: Implement snapshot, preflight, and renderer**

Resolve all selected versions before creating a job. Fail with `EXPORT_PREFLIGHT_FAILED` for empty handbooks, missing cover/back/card templates, retired selected versions, low-resolution media, or unsafe text layout. Generate screen A5 (148×210 mm) and print A5 plus 3 mm bleed/crop marks (154×216 mm) from frozen layout data using `render.ts`.

- [ ] **Step 4: Run focused test and verify pass**

Run: `pnpm vitest run apps/api/src/routes/exports.spec.ts apps/api/src/exports/preflight.spec.ts apps/web/src/content/ExportHandbookDialog.spec.tsx`

Expected: PASS; PDF is non-placeholder, export contains immutable template/data/preflight snapshots, and reader export creation is denied.

### Task 5: 端到端回归与体验数据

**Files:**
- Modify: `apps/api/src/seed.ts`
- Modify: `apps/api/src/seed.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: Write failing seed assertion**

```ts
expect((await database.select().from(templateVersions).where(eq(templateVersions.state, "published"))).length).toBeGreaterThanOrEqual(6);
```

- [ ] **Step 2: Run focused test and verify failure**

Run: `pnpm vitest run apps/api/src/seed.spec.ts`

Expected: FAIL because the development seed has no usable published template set.

- [ ] **Step 3: Seed the platform template catalogue**

Create at least one published fixed preset for cover, back, and each 1–4 photo card kind; assign them to the four demonstration handbooks and their cards. Document the platform login, family login, and template-to-export verification flow.

- [ ] **Step 4: Run final verification**

Run: `pnpm test && pnpm typecheck && pnpm build && git diff --check`

Expected: all tests, type check, build, and whitespace validation pass.
