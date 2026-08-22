# 持久化观察内容 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将每个小朋友的观察卡片、图片、标签和观察手册持久化到 Drizzle/SQLite，并让家庭端读取真实内容。

**Architecture:** 在现有家庭与儿童表上增加内容与媒体关联表。媒体文件存于受控本地目录，数据库保存元数据和相对路径；所有内容路由都先解析会话，再以资源所属儿童的家庭范围授权。前端按当前儿童读取 API，逐步删除对应全局示例状态。

**Tech Stack:** TypeScript、Fastify、Drizzle ORM、SQLite、`@fastify/multipart`、Sharp、React、Vite、Vitest。

**Spec:** `docs/superpowers/specs/2026-08-22-persistent-observation-content-design.md`

## Global Constraints

- 全站纸张规格固定为 A5 竖版；不得新增 A4、横版、家庭自定义模板或自由页面编辑。
- 观察卡片、标签、手册和媒体均由 `childId` 隔离；不得信任客户端传入的家庭 ID。
- 卡片创建必须有 1–4 张当前儿童的图片；所有列表页面只返回缩略图 URL。
- 家庭管理员可写，家庭只读成员只可读；未登录一律 401，越权一律 403。
- 标签同一儿童内名称唯一；同标签新卡片不会自动加入手册。
- 本计划不实现模板版本、PDF、公共发布或后台真实内容管理。
- 不导入原型数据；所有关键写入创建审计日志。

---

### Task 1: 内容关系 schema 与领域校验

**Files:**
- Modify: `apps/api/src/db/schema.ts`
- Create: `apps/api/drizzle/0001_persistent_observation_content.sql`
- Modify: `packages/domain/src/index.ts`
- Create: `packages/domain/src/persistent-content.spec.ts`

**Interfaces:**
- Produces: `mediaAssets`, `observationCards`, `cardPhotos`, `tags`, `cardTags`, `handbooks`, `handbookCards`, `handbookTags` Drizzle 表；`assertCardPhotoCount`, `assertSameChildIds`。
- Consumes: `children`、`auditLogs` 与既有 `CARD_PHOTO_LIMIT`。

- [ ] **Step 1: Write failing domain tests**

```ts
import { assertCardPhotoCount, assertSameChildIds } from "./index.js";

it("requires one through four photos for every card", () => {
  expect(() => assertCardPhotoCount(0)).toThrow("1 to 4 photos");
  expect(() => assertCardPhotoCount(1)).not.toThrow();
  expect(() => assertCardPhotoCount(4)).not.toThrow();
  expect(() => assertCardPhotoCount(5)).toThrow("1 to 4 photos");
});

it("rejects cross-child associations", () => {
  expect(() => assertSameChildIds("child-a", ["child-a", "child-b"])).toThrow("child scope violation");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @observation-handbook/domain test -- persistent-content.spec.ts`

Expected: FAIL because the validation functions do not exist.

- [ ] **Step 3: Add the schema and validations**

Add tables with the following non-null foreign keys and constraints: `media_assets.child_id`, `observation_cards.child_id`, `card_photos(card_id, media_asset_id, position)`, `tags.child_id`, `card_tags(card_id, tag_id)`, `handbooks.child_id`, `handbook_cards(handbook_id, card_id, position)`, `handbook_tags(handbook_id, tag_id)`. Use composite primary keys for the three join tables, `uniqueIndex("tags_child_name_unique").on(tags.childId, tags.name)`, and child/date indexes for card and handbook queries. Generate a Drizzle migration; foreign keys cascade only when their owning content record is removed.

```ts
export function assertCardPhotoCount(photoCount: number): void {
  if (!Number.isInteger(photoCount) || photoCount < 1 || photoCount > CARD_PHOTO_LIMIT) throw new Error("a card requires 1 to 4 photos");
}

export function assertSameChildIds(childId: string, relatedChildIds: string[]): void {
  if (relatedChildIds.some(id => id !== childId)) throw new Error("child scope violation");
}
```

- [ ] **Step 4: Run validation and migration checks**

Run: `pnpm --filter @observation-handbook/domain test -- persistent-content.spec.ts && pnpm db:generate && pnpm db:migrate`

Expected: PASS; the generated migration contains all eight tables and no A4/landscape field.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/drizzle packages/domain/src/index.ts packages/domain/src/persistent-content.spec.ts
git commit -m "feat: add persistent observation content schema"
```

### Task 2: 受控媒体上传与缩略图读取

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/config.ts`
- Create: `apps/api/src/media/storage.ts`
- Create: `apps/api/src/routes/media.ts`
- Create: `apps/api/src/routes/media.spec.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Produces: `storeChildImage(input): Promise<StoredMedia>`, `GET /api/media/:mediaId/thumbnail`, `POST /api/children/:childId/media`.
- Consumes: `mediaAssets`, `requireChildAccess`, session actor and `MEDIA_DIR` configuration.

- [ ] **Step 1: Write a failing media route test**

```ts
it("stores an administrator image and only returns its thumbnail to the owning family", async () => {
  const upload = await signedAdminRequest(app, { method: "POST", url: "/api/children/child-a/media", payload: multipartPng("leaf.png") });
  expect(upload.statusCode).toBe(201);
  const { media } = upload.json();
  expect((await signedFamilyRequest(app, { url: `/api/media/${media.id}/thumbnail` })).statusCode).toBe(200);
  expect((await signedOtherFamilyRequest(app, { url: `/api/media/${media.id}/thumbnail` })).statusCode).toBe(403);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @observation-handbook/api test -- media.spec.ts`

Expected: FAIL because the media route is absent.

- [ ] **Step 3: Implement minimal image storage**

Install `@fastify/multipart` and `sharp`. Add `mediaDirectory` to `ApiConfig`, defaulting to `./data/media`. `storeChildImage` must reject non-image MIME types, write the original using a UUID key, generate a 480px-wide JPEG thumbnail with `sharp`, and insert `media_assets` only after both files succeed. Register multipart with a 12 MB file limit. Thumbnail reads must load the media row first, call `requireChildAccess`, then return the thumbnail file; no static directory mount is allowed.

- [ ] **Step 4: Verify media behavior**

Run: `pnpm --filter @observation-handbook/api test -- media.spec.ts && pnpm --filter @observation-handbook/api test`

Expected: PASS; reader upload is 403, invalid MIME is 400, cross-family thumbnail is 403.

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/src/config.ts apps/api/src/media apps/api/src/routes/media.ts apps/api/src/routes/media.spec.ts apps/api/src/app.ts
git commit -m "feat: add child scoped media thumbnails"
```

### Task 3: 卡片与标签 API

**Files:**
- Create: `apps/api/src/routes/observations.ts`
- Create: `apps/api/src/routes/observations.spec.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Produces: `GET/POST /api/children/:childId/cards`, `GET/POST /api/children/:childId/tags`.
- Consumes: Task 1 tables, Task 2 `mediaAssets`, `assertCardPhotoCount`, `assertSameChildIds`.

- [ ] **Step 1: Write failing API tests**

```ts
it("creates a card with current-child media and tags, but rejects a reader or foreign media", async () => {
  const response = await signedAdminRequest(app, { method: "POST", url: "/api/children/child-a/cards", payload: { observedAt: "2026-08-22", text: "叶子变黄了", mediaAssetIds: ["media-a"], tagNames: ["银杏"] } });
  expect(response.statusCode).toBe(201);
  expect((await signedReaderRequest(app, { method: "POST", url: "/api/children/child-a/cards", payload: { observedAt: "2026-08-22", mediaAssetIds: ["media-a"], tagNames: [] } })).statusCode).toBe(403);
  expect((await signedAdminRequest(app, { method: "POST", url: "/api/children/child-a/cards", payload: { observedAt: "2026-08-22", mediaAssetIds: ["media-b"], tagNames: [] } })).statusCode).toBe(403);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @observation-handbook/api test -- observations.spec.ts`

Expected: FAIL because the observation routes are absent.

- [ ] **Step 3: Implement transactional writes and read projections**

For `POST cards`, trim text, validate ISO date and 1–4 `mediaAssetIds`, check every media asset belongs to the path child, upsert trimmed tag names per child, then insert card/photos/tags and `card.created` audit log in one database transaction. `GET cards` returns `{ id, observedAt, text, photos: [{ id, thumbnailUrl }], tags: [{ id, name, color }] }`; accept optional `month=YYYY-MM` only after format validation. `GET tags` computes card and handbook counts for the path child; `POST tags` creates a color-bearing tag and rejects a duplicate with 409.

- [ ] **Step 4: Verify all access paths**

Run: `pnpm --filter @observation-handbook/api test -- observations.spec.ts && pnpm test`

Expected: PASS; no returned photo contains an original file path; all list reads are child-scoped.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/observations.ts apps/api/src/routes/observations.spec.ts apps/api/src/app.ts
git commit -m "feat: add child scoped cards and tags"
```

### Task 4: 手册与显式关联 API

**Files:**
- Create: `apps/api/src/routes/handbooks.ts`
- Create: `apps/api/src/routes/handbooks.spec.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Produces: `GET/POST /api/children/:childId/handbooks`, `GET/PATCH /api/handbooks/:handbookId`.
- Consumes: Task 3 cards/tags and Task 1 handbook relations.

- [ ] **Step 1: Write failing handbook tests**

```ts
it("prefills a handbook from one tag without automatically adding a later matching card", async () => {
  const create = await signedAdminRequest(app, { method: "POST", url: "/api/children/child-a/handbooks", payload: { title: "银杏的一年", introduction: "四季观察", startedAt: "2026-03-10", tagIds: ["tag-ginkgo"] } });
  expect(create.statusCode).toBe(201);
  expect(create.json().handbook.cardIds).toEqual(["card-ginkgo-1"]);
  await createMatchingCard("card-ginkgo-2");
  expect((await signedFamilyRequest(app, { url: `/api/handbooks/${create.json().handbook.id}` })).json().handbook.cardIds).toEqual(["card-ginkgo-1"]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @observation-handbook/api test -- handbooks.spec.ts`

Expected: FAIL because handbook routes are absent.

- [ ] **Step 3: Implement handbook transactions**

`POST` requires non-empty title and introduction, accepts ISO start/completed dates, tag IDs, and optional explicit card IDs. It verifies all references belong to the path child, combines selected tag cards only at creation, assigns sequential positions, and creates a `handbook.created` audit log. `PATCH` replaces only explicitly submitted card/tag relations after the same validation. `GET` returns only thumbnail photo URLs and reports `status: "completed"` exactly when `completedAt` is non-null.

- [ ] **Step 4: Verify the feature**

Run: `pnpm --filter @observation-handbook/api test -- handbooks.spec.ts && pnpm --filter @observation-handbook/api test`

Expected: PASS; readers cannot create or patch, and a cross-child card/tag is rejected with 403.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/handbooks.ts apps/api/src/routes/handbooks.spec.ts apps/api/src/app.ts
git commit -m "feat: add observation handbooks and explicit links"
```

### Task 5: 家庭端真实内容读取

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Create: `apps/web/src/content/ChildContentLoader.tsx`
- Create: `apps/web/src/content/ChildContentLoader.spec.tsx`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Produces: `apiClient.cards(childId, month)`, `apiClient.tags(childId)`, `apiClient.handbooks(childId)` and a current-child content loader.
- Consumes: Tasks 3–4 API response projections and existing `Workspace` current-child selection.

- [ ] **Step 1: Write failing loader tests**

```tsx
it("reloads only the selected child's cards and renders thumbnail URLs", async () => {
  render(<ChildContentLoader childId="child-a" loadCards={vi.fn().mockResolvedValue([{ id: "card-a", photos: [{ thumbnailUrl: "/api/media/media-a/thumbnail" }] }])} />);
  expect(await screen.findByRole("img")).toHaveAttribute("src", "/api/media/media-a/thumbnail");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @observation-handbook/web test -- ChildContentLoader.spec.tsx`

Expected: FAIL because the content loader is absent.

- [ ] **Step 3: Replace the three read views**

Load cards, tags and handbook summaries when `childId` changes. Preserve the compact archive layout and the month/timeline/calendar selector, but show a concise empty state when an API result is empty. Render only `thumbnailUrl` in card tiles. Remove `seedCards`, `handbooks`, `tags` and `childTags` from the active family views; leave template, PDF and public sections explicitly isolated until their own migrations.

- [ ] **Step 4: Verify web and full regression**

Run: `pnpm --filter @observation-handbook/web test && pnpm build && pnpm typecheck && pnpm test && git diff --check`

Expected: PASS; switching children produces separate content requests and no active card view references Unsplash.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/api/client.ts apps/web/src/content apps/web/src/main.tsx apps/web/src/styles.css
git commit -m "feat: load child observation content from api"
```
