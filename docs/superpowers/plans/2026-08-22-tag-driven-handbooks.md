# 标签驱动观察手册 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让标签成为观察主题入口，使同一小朋友的标签可聚合卡片、创建和维护观察手册。

**Architecture:** 在领域层增加“标签—手册—卡片”关联规则，所有资源继续以 `childId` 隔离。家庭端标签页增加主题详情；从标签详情创建手册时带入该标签已有卡片，后续同标签新卡片可显式加入手册。手册详情显示关联标签，标签统计显示关联手册数量。

**Tech Stack:** TypeScript、React、Vite、Vitest、现有 `@observation-handbook/domain` 包。

**Spec:** `docs/architecture.md`；用户确认的“标签驱动观察手册”需求。

## Global Constraints

- 全站纸张规格固定为 A5 竖版；不得新增 A4 选项或数据。
- 卡片、标签、手册和导出文件必须保持小朋友范围隔离。
- 家庭只有一位管理员；只读成人不得创建、编辑、发布或导出。
- 家庭管理员发布手册后直接公开，无审核；撤回仅影响公共空间。
- 模板版本一旦被使用不得删除，只能停用。

---

### Task 1: 定义标签与手册关联领域规则

**Files:**

- Modify: `packages/domain/src/index.ts`
- Modify: `packages/domain/src/tag-management.spec.ts`

**Interfaces:**

- Produces: `createTaggedHandbook(input)`, `filterCardsByTag(cards, childId, tagName)`, `assertHandbookTagScope(input)`。
- Consumes: 已有 `createObservationHandbook`、`validateHandbookCardChildren`、`createObservationTag`。

- [ ] **Step 1: 写失败测试，要求标签只能聚合同一小朋友的卡片**

```ts
expect(api.filterCardsByTag([
  { childId: "child-lele", tags: ["银杏"] },
  { childId: "child-anan", tags: ["银杏"] },
], "child-lele", "银杏")).toEqual([
  { childId: "child-lele", tags: ["银杏"] },
]);
```

- [ ] **Step 2: 运行失败测试**

Run: `pnpm vitest run packages/domain/src/tag-management.spec.ts`

Expected: FAIL，提示 `filterCardsByTag` 尚未定义。

- [ ] **Step 3: 实现最小标签筛选和范围校验**

```ts
export function filterCardsByTag<T extends { childId: string; tags: string[] }>(cards: T[], childId: string, tagName: string): T[] {
  return cards.filter(card => card.childId === childId && card.tags.includes(tagName));
}

export function assertHandbookTagScope(input: { childId: string; cardChildIds: string[] }): void {
  validateHandbookCardChildren(input.childId, input.cardChildIds);
}
```

- [ ] **Step 4: 为从标签创建手册写失败测试**

```ts
expect(api.createTaggedHandbook({
  childId: "child-lele",
  tagName: "银杏",
  title: "银杏的一年",
  cardChildIds: ["child-lele", "child-lele"],
})).toMatchObject({ childId: "child-lele", tagName: "银杏", status: "ongoing" });
```

- [ ] **Step 5: 实现 `createTaggedHandbook` 并确认测试通过**

```ts
export function createTaggedHandbook(input: {
  childId: string;
  tagName: string;
  title: string;
  cardChildIds: string[];
}): { childId: string; tagName: string; title: string; status: "ongoing" } {
  assertHandbookTagScope(input);
  return { childId: input.childId, tagName: input.tagName.trim(), title: input.title.trim(), status: "ongoing" };
}
```

Run: `pnpm vitest run packages/domain/src/tag-management.spec.ts`

Expected: PASS。

- [ ] **Step 6: 提交领域规则**

```bash
git add packages/domain/src/index.ts packages/domain/src/tag-management.spec.ts
git commit -m "feat: add tag driven handbook rules"
```

### Task 2: 将标签页升级为主题详情入口

**Files:**

- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**

- Consumes: `filterCardsByTag(cards, childId, tagName)`。
- Produces: `selectedTag` 状态与只显示当前小朋友同标签卡片的标签详情视图。

- [ ] **Step 1: 为标签卡片增加打开详情的回调**

```tsx
function TagTile({ tag, onOpen }: { tag: TagSummary; onOpen: (tag: TagSummary) => void }) {
  return <article className="tag-tile" onClick={() => onOpen(tag)}>...</article>;
}
```

- [ ] **Step 2: 新增 `selectedTag` 和当前小朋友卡片范围**

```ts
const [selectedTag, setSelectedTag] = useState<ChildTagSummary | null>(null);
const currentChildCards = cardItems.filter(card => card.childId === currentChildId);
const selectedTagCards = selectedTag ? filterCardsByTag(currentChildCards, currentChildId, selectedTag.name) : [];
```

- [ ] **Step 3: 渲染标签详情页**

详情页必须显示标签名称、卡片数量、关联手册数量、返回标签列表按钮，以及使用现有 `CardTile` 渲染的缩略卡片网格。

- [ ] **Step 4: 添加紧凑详情布局样式**

```css
.tag-detail { max-width: 1320px; padding: 5px 38px 48px; }
.tag-detail-header { display: flex; align-items: baseline; gap: 12px; }
```

- [ ] **Step 5: 手动验证**

1. 以乐乐身份打开“标签管理”。
2. 点击“银杏”，确认仅出现乐乐的银杏卡片。
3. 切换安安，确认不会显示乐乐的标签详情或卡片。

- [ ] **Step 6: 提交标签详情页**

```bash
git add apps/web/src/main.tsx apps/web/src/styles.css
git commit -m "feat: add tag theme detail view"
```

### Task 3: 从标签主题创建并维护观察手册

**Files:**

- Modify: `apps/web/src/main.tsx`
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/domain/src/tag-management.spec.ts`

**Interfaces:**

- Consumes: `createTaggedHandbook`、标签详情的 `selectedTagCards`。
- Produces: 手册 `tagNames: string[]`、`cardIds: string[]`，以及从标签详情打开的预填充新建手册流程。

- [ ] **Step 1: 扩展前端手册数据结构**

```ts
type Handbook = {
  // existing fields
  tagNames: string[];
  cardIds: string[];
};
```

- [ ] **Step 2: 为标签创建手册写失败测试**

测试必须断言：创建时保存标签名和全部已选卡片 ID；不同 `childId` 的卡片会被拒绝。

- [ ] **Step 3: 在标签详情页添加“由此标签创建手册”按钮**

按钮打开既有新建手册对话框，同时预填：标题为标签名、`tagNames` 为当前标签、`cardIds` 为 `selectedTagCards.map(card => card.id)`。

- [ ] **Step 4: 在新建卡片保存后提供加入关联手册的规则**

当新卡片带有某手册的关联标签时，在卡片编辑器中展示“加入《手册名》”的多选项；默认不自动加入，保存时将选中的手册 `cardIds` 与 `cardCount` 更新。

- [ ] **Step 5: 在手册详情展示关联标签**

```tsx
<div className="tag-row">{handbook.tagNames.map(tag => <span key={tag}>#{tag}</span>)}</div>
```

- [ ] **Step 6: 更新标签统计**

`handbookCount` 必须由当前小朋友的 `handbookItems` 中 `tagNames.includes(tag.name)` 实时计算，而不是维护重复状态。

- [ ] **Step 7: 验证流程**

1. 标签“银杏”详情中创建《银杏的一年》。
2. 确认已有银杏卡片被收录。
3. 新建带“银杏”的卡片，选择加入该手册。
4. 确认手册卡片数与标签关联手册数同步增加。

- [ ] **Step 8: 提交标签创建手册流程**

```bash
git add apps/web/src/main.tsx packages/domain/src/index.ts packages/domain/src/tag-management.spec.ts
git commit -m "feat: create handbooks from observation tags"
```

### Task 4: 回归验证与公开空间一致性

**Files:**

- Modify: `packages/domain/src/handbook.spec.ts`
- Modify: `packages/domain/src/public-space.spec.ts`

**Interfaces:**

- Consumes: 任务 1–3 的标签关联手册数据。
- Produces: 标签关联不影响 A5 导出、公开发布或小朋友隔离的回归保障。

- [ ] **Step 1: 增加公开发布回归测试**

断言公开手册保留 `tagNames`，但公共阅读页不暴露家庭编辑入口。

- [ ] **Step 2: 增加导出回归测试**

断言 A5 屏幕版和印刷版规范仍分别为无裁切线与 3mm 出血裁切线。

- [ ] **Step 3: 运行完整验证**

Run:

```bash
pnpm test
pnpm build
pnpm typecheck
git diff --check
```

Expected: 全部通过。

- [ ] **Step 4: 提交回归测试**

```bash
git add packages/domain/src/handbook.spec.ts packages/domain/src/public-space.spec.ts
git commit -m "test: cover tag driven handbook flows"
```

## Self-Review

- 覆盖范围：任务 1 定义标签、卡片和手册的隔离规则；任务 2 提供主题查看；任务 3 支持从主题创建、持续维护手册；任务 4 覆盖公开、导出与隔离回归。
- 约束检查：计划不引入 A4、家庭自定义模板或自由页面编辑；所有新增流程保留 A5、管理员权限和小朋友隔离。
- 接口检查：任务 2 和任务 3 均消费任务 1 定义的 `filterCardsByTag` 和 `createTaggedHandbook`；任务 4 仅验证前序已经定义的数据字段。
