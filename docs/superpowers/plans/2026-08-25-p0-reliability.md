# P0 Reliability Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让小朋友能够安全完成“新建卡片→整理→公开浏览”的最小闭环，不丢草稿、不被权限阻断，匿名访客可浏览公开手册。

**Architecture:** 保留现有 React/Fastify/SQLite 架构。前端在卡片工作台关闭或跳转前保存可恢复草稿；公开阅读接口与家庭写入权限分离；领域访问策略把平台超级管理员作为全局只读/管理主体，同时不改变普通家庭成员隔离规则。

**Tech Stack:** React 19、Fastify 5、Drizzle ORM、SQLite、Vitest、Testing Library。

**Spec:** `docs/superpowers/plans/2026-08-25-p0-reliability.md`

## Global Constraints

- 匿名访客只能浏览已发布公开手册，不能编辑、举报或下载。
- 普通家庭成员只能访问所属家庭；儿童只能编辑自己的档案。
- 卡片工作台离开时不得静默丢失已填写内容。
- 每项修复必须先有失败测试，再实现，再运行相关和全量测试。

---

### Task 1: 修复卡片草稿丢失

**Files:**
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/content/CreateObservationCardForm.tsx`
- Test: `apps/web/src/content/CreateObservationCardForm.spec.tsx`

- [x] 保持卡片工作台挂载状态，打开“新建手册”时不再清空工作台；手册创建后通过刷新键重新加载手册选项。
- [x] 运行相关 Web 测试确认通过。

### Task 2: 允许匿名浏览公开手册

**Files:**
- Modify: `apps/api/src/routes/publications.ts`
- Modify: `apps/api/src/routes/publications.spec.ts`

- [x] 将公开 GET 列表和详情改为无需会话；举报、发布、撤回仍要求登录。
- [x] 将匿名成功测试置红后完成实现。
- [x] 实现最小权限分离。
- [x] 运行 publications 测试和 API 全量测试。

### Task 3: 统一超级管理员家庭访问策略

**Files:**
- Modify: `packages/domain/src/access.ts`
- Modify: `packages/domain/src/access.spec.ts`
- Modify: `apps/api/src/routes/families.spec.ts`

- [x] 增加超级管理员跨家庭读取/管理测试并确认旧策略失败。
- [x] 在访问策略中识别 `platformRole === "super_admin"`，保留儿童只能编辑自己的约束。
- [x] 运行领域、家庭、API 全量测试。

### Task 4: P0 回归验收

**Files:**
- Test: `apps/api/src/routes/publications.spec.ts`
- Test: `apps/web/src/content/CreateObservationCardForm.spec.tsx`

- [x] 验证匿名公开列表/详情。
- [x] 验证新建手册时卡片工作台不卸载，草稿状态保留。
- [x] 验证普通家庭不能跨家庭读取。
- [x] 运行 Web 28、API 28、领域 3 项测试及 Web 生产构建。

### Task 5: P1 儿童记录可靠性

**Files:**
- Modify: `apps/web/src/content/CreateObservationCardForm.tsx`
- Modify: `apps/web/src/styles.css`
- Test: `apps/web/src/content/CreateObservationCardForm.spec.tsx`

- [x] 多图模板在上传前校验照片数量，并显示“还差几张”的儿童可理解提示。
- [x] 将常见 API 错误码转换为可行动提示。
- [x] 手册选择改为复选项，一张卡可同时归入多本手册。
- [x] 运行 Web 全量测试与生产构建。

### Task 6: 手册成册闭环可靠性

**Files:**
- Modify: `apps/web/src/content/ChildCollections.tsx`
- Modify: `apps/web/src/content/ChildContentLoader.tsx`
- Test: `apps/web/src/content/ChildCollections.spec.tsx`
- Test: `apps/web/src/content/ChildContentLoader.spec.tsx`

- [x] 手册列表优先使用用户选择的封面照片，未选择时才回退到首张卡片照片。
- [x] 阅读器保存卡片顺序后保持打开，避免用户误以为排序未保存。
- [x] 手册、卡片加载失败显示明确错误与重试按钮，不再伪装为空状态。
- [x] 增加封面照片与加载失败/重试回归测试。
- [x] 运行 Web 34、API 28 项测试与 Web 生产构建。

### Task 7: 标签库与观察卡联动

**Files:**
- Modify: `apps/api/src/routes/observations.ts`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/content/CreateObservationCardForm.tsx`
- Modify: `apps/web/src/content/ChildCollections.tsx`
- Modify: `apps/web/src/main.tsx`
- Test: `apps/api/src/routes/observations.spec.ts`
- Test: `apps/web/src/content/CreateObservationCardForm.spec.tsx`
- Test: `apps/web/src/content/ChildCollections.spec.tsx`

- [x] 卡片创建和修改以标签 ID 保存；标签名仅用于展示，不能再由卡片保存隐式创建。
- [x] 编辑台输入 `#` 时搜索当前小朋友的标签库；只能选择、移除已存在标签。
- [x] 通过明确的“新建标签”小弹窗创建，成功后立即选中并刷新标签管理页。
- [x] 标签管理页显示卡片使用数，并提供名称、颜色、删除未使用标签的管理入口；已被卡片使用的标签拒绝删除并说明原因。
- [x] 保存失败显示实际可行动原因，而不是统一的“保存失败”。
- [x] 覆盖“选标签后保存”“新建后自动选中”“标签删除保护”的 API 与 Web 回归测试。
