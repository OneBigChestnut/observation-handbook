# Observation Handbook Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将观察手册实现为由封面、真实观察卡片和封底组成的可阅读、可排序、可公开和可导出的完整作品。

**Architecture:** 保留现有家庭内容 API 和 React 应用，新增一个复用模板布局快照的 `HandbookReaderModal`，由手册详情数据组装页面序列。手册创建只保存封面/封底模板与照片引用；正文始终从 `cardIds` 查询真实卡片，排序变更只更新 `cardIds`。

**Tech Stack:** React 19、TypeScript、Vite、Vitest、Testing Library、Fastify、Drizzle SQLite、现有 `TemplateLayout`/PDF 渲染能力。

**Spec:** `docs/superpowers/specs/2026-08-23-observation-handbook-reader-design.md`

## Global Constraints

- 手册正文只能来自观察卡片，不能创建独立正文页。
- 封面和封底始终位于页面序列首尾。
- 卡片页面使用保存时的模板布局快照，不重新流式排版。
- 今日记录不嵌入文字编辑框；编辑必须进入卡片编辑工作台。
- 公开手册和公开示例只读，不能编辑、排序、删除或下载。
- 照片只能来自当前小朋友有权限访问的照片资产。
- 不恢复或引入“观察项目”用户界面。

### Task 1: 固化手册页面数据模型

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/api/src/db/schema.ts`
- Modify: `apps/api/src/routes/handbooks.ts`
- Test: `apps/api/src/routes/handbooks.spec.ts`

**Interfaces:**
- 产出 `HandbookPageSource = { kind: "cover" | "card" | "back"; id: string; cardId?: string; templateId?: string; photoId?: string }`。
- 产出 `HandbookSummary.pages` 或等价的可推导字段，正文来源只接受 `cardIds`。

- [ ] 写失败测试：新建手册保存封面/封底模板和照片引用；读取手册时返回模板引用；卡片 ID 缺失时被过滤并返回明确数据。
- [ ] 运行 API 手册测试，确认测试因缺少字段而失败。
- [ ] 最小实现数据库/API 字段和响应映射，保持现有客户端兼容。
- [ ] 运行手册 API 测试与全量 API 测试，确认通过。

### Task 2: 修正新建手册流程

**Files:**
- Modify: `apps/web/src/content/CreateHandbookForm.tsx`
- Modify: `apps/web/src/content/TemplateSelector.tsx`
- Modify: `apps/web/src/main.tsx`
- Test: `apps/web/src/content/CreateHandbookForm.spec.tsx`

**Interfaces:**
- `CreateHandbookForm` 提交 `coverTemplateId`、`backTemplateId`、`coverPhotoId?`、`backPhotoId?`。
- 照片选择器接收当前小朋友的卡片照片缩略图列表，并返回一个照片资产 ID。

- [ ] 写失败测试：选择封面/封底模板和各自照片后，提交 payload 包含全部引用；没有照片时允许创建并显示占位状态。
- [ ] 运行表单测试确认失败。
- [ ] 实现简洁的两段式选择区：手册信息、封面与封底；照片只来自当前小朋友照片库。
- [ ] 删除新建手册页面中无关的标签/卡片大列表和重复说明。
- [ ] 运行表单测试和前端构建。

### Task 3: 建立统一手册页面渲染器

**Files:**
- Create: `apps/web/src/content/HandbookPageRenderer.tsx`
- Modify: `apps/web/src/content/TemplatePreview.tsx` 或现有模板渲染组件
- Test: `apps/web/src/content/HandbookPageRenderer.spec.tsx`

**Interfaces:**
- `HandbookPageRenderer({ page, mode, scale })` 支持 `cover`、`card`、`back` 三种页面。
- `mode` 为 `thumbnail | large | pdf`，三种模式使用同一布局数据。

- [ ] 写失败测试：封面显示标题/制作人/时间；卡片显示卡片原照片和文字；封底显示统计信息；无照片时显示占位框。
- [ ] 运行测试确认失败。
- [ ] 实现固定 A5 画布、照片框、文字框和装饰线的统一渲染。
- [ ] 确保卡片使用 `templateLayout` 快照，不因容器尺寸变化而改变相对位置。
- [ ] 运行渲染器测试并检查缩略图与大图的页面结构一致。

### Task 4: 新增独立手册阅读弹窗

**Files:**
- Create: `apps/web/src/content/HandbookReaderModal.tsx`
- Modify: `apps/web/src/content/ChildCollections.tsx`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/styles.css`
- Test: `apps/web/src/content/HandbookReaderModal.spec.tsx`

**Interfaces:**
- `HandbookReaderModal({ handbook, cards, canEdit, readOnly, onClose, onSaveOrder })`。
- `onSaveOrder(cardIds: string[])` 只接收正文卡片 ID，不包含封面或封底。

- [ ] 写失败测试：点击手册后出现弹窗；左侧有封面、每张卡片和封底缩略图；右侧显示当前大图；列表下方不出现内嵌展开区。
- [ ] 运行测试确认失败。
- [ ] 实现遮罩、关闭按钮、当前页高亮、上一页/下一页和键盘 Escape 关闭。
- [ ] 将 `ChildHandbookList` 的 `openedId`/`handbook-spread` 内嵌预览替换为弹窗入口。
- [ ] 运行组件测试并验证移动端滚动布局。

### Task 5: 实现手册内卡片排序

**Files:**
- Modify: `apps/web/src/content/HandbookReaderModal.tsx`
- Modify: `apps/web/src/content/ChildCollections.tsx`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/api/src/routes/handbooks.ts`
- Test: `apps/web/src/content/HandbookReaderModal.spec.tsx`
- Test: `apps/api/src/routes/handbooks.spec.ts`

**Interfaces:**
- 首次页面序列使用 `cardIds` 的数值/创建 ID 升序。
- 保存排序调用 `apiClient.updateHandbook(handbookId, { cardIds })`。

- [ ] 写失败测试：首次打开按 ID 排序；调整模式支持拖动或上移/下移；封面/封底不可移动；取消恢复原顺序。
- [ ] 运行前后端测试确认失败。
- [ ] 实现排序模式、保存/取消状态和服务端持久化。
- [ ] 过滤已删除卡片 ID，保存前禁止重复 ID。
- [ ] 运行相关测试和全量前端/API 测试。

### Task 6: 处理卡片归属、归档和空手册

**Files:**
- Modify: `apps/api/src/routes/observations.ts`
- Modify: `apps/api/src/routes/handbooks.ts`
- Modify: `apps/web/src/content/ChildContentLoader.tsx`
- Modify: `apps/web/src/content/HandbookReaderModal.tsx`
- Test: `apps/api/src/routes/observations.spec.ts`
- Test: `apps/web/src/content/ChildContentLoader.spec.tsx`

**Interfaces:**
- 归档卡片时同步从所有相关 `cardIds` 移除。
- 手册无正文卡片时返回合法空状态，不生成伪正文页面。

- [ ] 写失败测试：归档卡片后手册不再显示失效页；空手册显示封面/封底和“还没有收录观察卡片”。
- [ ] 运行测试确认失败。
- [ ] 实现关系清理和空状态。
- [ ] 确认今日记录仍只显示标签、手册、日期和操作按钮。
- [ ] 运行相关测试。

### Task 7: 统一公开展示与 PDF 导出

**Files:**
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/content/PublicHandbookReader.tsx`
- Modify: `apps/web/src/content/ExportWorkspace.tsx`
- Modify: `apps/api/src/exports/pdf.ts`
- Test: `apps/web/src/content/PublicHandbookReader.spec.tsx`
- Test: `apps/api/src/routes/exports.spec.ts`

**Interfaces:**
- 公开手册复用 `HandbookReaderModal`，传入 `readOnly=true`。
- PDF 页面顺序与阅读器页面序列完全一致：封面、保存后的卡片顺序、封底。

- [ ] 写失败测试：公开阅读器显示同样的左右分栏；无编辑/排序/下载按钮；PDF 包含封面、全部卡片和封底。
- [ ] 运行测试确认失败。
- [ ] 接入统一渲染器和页面序列构建函数。
- [ ] 删除或旁路旧的独立公开阅读布局，避免出现两套手册框架。
- [ ] 运行公开展示和导出测试。

### Task 8: 完成端到端回归与文档

**Files:**
- Modify: `README.md`
- Create: `tests/e2e/handbook-reader.spec.ts`
- Modify: `docs/superpowers/specs/2026-08-23-observation-handbook-reader-design.md`

- [ ] 编写端到端场景：登录家庭 → 新建手册 → 选择封面/封底模板和照片 → 创建卡片并归入手册 → 打开手册 → 调整顺序 → 保存 → 公开 → 导出。
- [ ] 编写公开示例场景：匿名进入 → 打开手册 → 左侧切页 → 确认不能编辑、排序和下载。
- [ ] 运行前端全量测试、API 全量测试、生产构建和 Playwright 场景。
- [ ] 更新 README 的手册模型、权限边界和导出说明。
- [ ] 检查规格与实现是否一致，记录未覆盖的部署问题。

## 完成标准

- 手册阅读器不再以内嵌区域展开。
- 每本手册页面顺序明确为封面、真实卡片、封底。
- 卡片页面的缩略图、大图和 PDF 使用同一模板快照。
- 初次生成按卡片 ID 排序，后续排序可保存。
- 封面和封底可独立选模板与照片，并显示动态手册信息。
- 公开示例和公开手册只读。
- 前端、API、端到端测试和生产构建全部通过。
