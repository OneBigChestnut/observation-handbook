# 只读完整示例工作台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将公开示例接入现有观察工作台，并提供与真实账号一致的只读卡片、手册和成册浏览流程。

**Architecture:** AuthGate 创建带 `demo` 标记的演示工作区；App 复用真实导航和页面；内容组件通过注入加载器读取本地演示数据。写操作在演示模式下禁用。

**Tech Stack:** React、TypeScript、Vite、现有内容组件与模板布局类型。

**Spec:** `docs/superpowers/specs/2026-08-23-readonly-demo-workspace-design.md`

## Global Constraints

- 公开示例只读，不写入真实家庭数据。
- 卡片、手册、导出页面复用现有组件，不再创建独立展示框架。
- 本阶段不下载 300 张图片；使用现有本地/远程示例素材完成链路验证。

### Task 1: 演示工作区与加载器

**Files:**
- Create: `apps/web/src/demo/demoData.ts`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/auth/AuthGate.tsx`

- [ ] 增加 `demo` 工作区标记和结构化演示数据。
- [ ] 让 AuthGate 的公开入口渲染 App，而不是独立 PublicDemo。
- [ ] 保持退出事件返回匿名登录页。

### Task 2: 现有内容组件的演示加载能力

**Files:**
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/content/ChildContentLoader.tsx`
- Modify: `apps/web/src/content/ChildCollections.tsx`
- Modify: `apps/web/src/content/ExportWorkspace.tsx`

- [ ] 在 demo 模式注入 cards、handbooks、tags、exports 加载器。
- [ ] 隐藏新建、编辑、删除、发布和下载操作。
- [ ] 保留原始导航、缩略图、手册展开和导出列表。

### Task 3: 卡片只读查看

**Files:**
- Modify: `apps/web/src/content/CreateObservationCardForm.tsx`
- Modify: `apps/web/src/content/ChildContentLoader.tsx`
- Test: `apps/web/src/content/ChildContentLoader.spec.tsx`

- [ ] 增加只读模式，复用实时模板画布和原卡片编辑工作台布局。
- [ ] 允许点击演示卡片打开详情，禁止保存、上传、编辑和删除。
- [ ] 增加组件测试验证模板照片、文字和只读状态。

### Task 4: 验证

- [ ] 运行 TypeScript 检查和前端构建。
- [ ] 运行内容组件测试。
- [ ] 浏览器穿测：登录页 → 示例工作台 → 卡片 → 手册 → 导出 → 退出。
