# 已登录观察手册平台基础 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可本地运行的 API、SQLite 数据库、账号密码登录、会话、家庭成员和小朋友资源范围校验，使后续观察内容不再依赖浏览器内存状态。

**Architecture:** 新增 `apps/api` Fastify 服务，采用 Prisma + SQLite 保存账户、会话、家庭、家庭成员、小朋友和审计日志。服务端将当前会话解析为 `RequestActor`，所有家庭与小朋友 API 都通过该对象校验权限。前端保留现有视觉壳层，先接入登录和当前家庭/小朋友读取，不迁移卡片、标签、手册或 PDF。

**Tech Stack:** TypeScript、Fastify、Prisma、SQLite、Node `crypto.scrypt`、React、Vite、Vitest。

**Spec:** `docs/superpowers/specs/2026-08-22-authenticated-observation-platform-design.md`

## Global Constraints

- 全站纸张规格固定为 A5 竖版；本计划不得引入 A4、横版或纸张选择数据。
- 未登录用户不可访问公共空间、家庭内容或后台接口。
- 每个家庭恰有一名 `admin`；其他家庭成人只能为 `reader`。
- 所有小朋友资源由 `childId` 与当前会话所属家庭共同校验，前端隐藏不能替代服务端校验。
- 密码只保存 `scrypt` 派生哈希；会话令牌只存哈希，浏览器只接收 `httpOnly` Cookie。
- 本计划不导入旧项目或原型运行数据；仅提供明确标注为开发环境的种子账户。
- 不使用多智能体；实施、测试和审查均在当前会话顺序进行。

## Planned File Structure

```text
apps/api/
  package.json                    # API 依赖与开发/测试命令
  tsconfig.json                   # NodeNext TypeScript 配置
  prisma/schema.prisma            # SQLite 数据库模型与枚举
  src/config.ts                   # 数据库、会话 Cookie、媒体目录配置
  src/password.ts                 # scrypt 哈希和校验
  src/auth.ts                     # 会话创建、Cookie 读取、RequestActor
  src/errors.ts                   # 统一 HTTP 业务错误
  src/repositories/family.ts      # 家庭、成员、小朋友读写
  src/routes/auth.ts              # 登录、退出、当前账户、改密
  src/routes/families.ts          # 当前家庭、成员与小朋友 API
  src/app.ts                      # Fastify 应用装配
  src/server.ts                   # 本地服务启动入口
  src/seed.ts                     # 开发环境可重复执行的种子
  src/*.spec.ts                   # Fastify.inject 集成测试
apps/web/src/
  api/client.ts                   # 统一 fetch 封装与 API 类型
  auth/AuthGate.tsx               # 登录门禁与当前会话加载
  app-shell/AppShell.tsx          # 现有侧栏/顶栏的受控壳层
  main.tsx                        # 仅保留根装配，移除硬编码角色与儿童状态
packages/domain/src/
  access.ts                       # 纯领域权限与范围判定
  access.spec.ts                  # 领域范围测试
```

后续内容迁移必须另建计划，顺序为：(1) 卡片、照片、标签与手册关联；(2) 模板版本和媒体缩略图；(3) PDF 快照与预检；(4) 公共空间与后台页面接入。这样基础身份边界可先独立验收。

---

### Task 1: 配置 API 工作区与 SQLite 数据库模型

**Files:**

- Modify: `package.json`
- Modify: `pnpm-workspace.yaml`
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/src/config.ts`
- Create: `apps/api/src/config.spec.ts`

**Interfaces:**

- Produces: Prisma `Account`, `Session`, `Family`, `FamilyMembership`, `Child`, `AuditLog` 模型和 `getApiConfig(env)`。
- Consumes: 根项目的 pnpm 工作区和 TypeScript NodeNext 约定。

- [ ] **Step 1: 写配置的失败测试**

```ts
import { describe, expect, it } from "vitest";
import { getApiConfig } from "./config.js";

describe("api configuration", () => {
  it("uses a local SQLite file and a strict session cookie in production", () => {
    const config = getApiConfig({ NODE_ENV: "production", DATABASE_URL: "file:./test.db", SESSION_SECRET: "a".repeat(32) });
    expect(config.databaseUrl).toBe("file:./test.db");
    expect(config.sessionCookie.secure).toBe(true);
    expect(config.sessionCookie.httpOnly).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm --filter @observation-handbook/api test -- config.spec.ts`

Expected: FAIL，提示 API 包或 `getApiConfig` 尚未定义。

- [ ] **Step 3: 建立工作区包与根命令**

在根 `package.json` 增加 API 命令：

```json
{
  "scripts": {
    "dev:api": "pnpm --filter @observation-handbook/api dev",
    "db:generate": "pnpm --filter @observation-handbook/api prisma:generate",
    "db:migrate": "pnpm --filter @observation-handbook/api prisma:migrate"
  }
}
```

创建 `apps/api/package.json`，至少包含：

```json
{
  "name": "@observation-handbook/api",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "start": "tsx src/server.ts",
    "test": "vitest run",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev"
  }
}
```

依赖使用 `fastify`、`@fastify/cookie`、`@prisma/client`；开发依赖使用 `prisma` 与 `tsx`。在根 `pnpm-workspace.yaml` 中确保包含 `apps/*`。

- [ ] **Step 4: 创建 Prisma 模型**

`apps/api/prisma/schema.prisma` 使用 SQLite，至少定义以下约束：

```prisma
enum FamilyRole { admin reader }
enum PlatformRole { super_admin operations_admin }

model Account {
  id           String             @id @default(cuid())
  username     String             @unique
  passwordHash String
  platformRole PlatformRole?
  sessions     Session[]
  memberships  FamilyMembership[]
  createdAt    DateTime           @default(now())
}

model Family {
  id          String             @id @default(cuid())
  name        String
  memberships FamilyMembership[]
  children    Child[]
  createdAt   DateTime           @default(now())
}

model FamilyMembership {
  accountId String
  familyId  String
  role      FamilyRole
  account   Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  family    Family  @relation(fields: [familyId], references: [id], onDelete: Cascade)
  @@id([accountId, familyId])
  @@index([familyId, role])
}

model Child {
  id       String @id @default(cuid())
  familyId String
  name     String
  family   Family @relation(fields: [familyId], references: [id], onDelete: Cascade)
  @@unique([familyId, name])
}
```

同时定义 `Session`（令牌哈希、过期时间、账户关联）及 `AuditLog`（操作者、家庭范围、动作、目标、JSON 元数据、时间）。数据库事务而非单一 Prisma 唯一索引负责“一个家庭恰有一名管理员”的写入检查。

- [ ] **Step 5: 实现配置并生成 Prisma 客户端**

```ts
export function getApiConfig(env: NodeJS.ProcessEnv) {
  const sessionSecret = env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  return {
    databaseUrl: env.DATABASE_URL ?? "file:./dev.db",
    sessionCookie: { name: "observation_session", httpOnly: true, sameSite: "lax" as const, secure: env.NODE_ENV === "production", path: "/" },
  };
}
```

运行 `pnpm install`，再运行 `pnpm db:generate` 与 Prisma 初始迁移。将 `apps/api/prisma/*.db`、`apps/api/prisma/*.db-journal` 写入 `.gitignore`。

- [ ] **Step 6: 验证配置与数据库模型**

Run: `pnpm --filter @observation-handbook/api test -- config.spec.ts && pnpm db:generate && pnpm db:migrate`

Expected: PASS；SQLite 初始迁移生成，Prisma 客户端生成成功。

- [ ] **Step 7: 提交 API 基础**

```bash
git add package.json pnpm-lock.yaml pnpm-workspace.yaml .gitignore apps/api
git commit -m "feat: add api workspace and sqlite schema"
```

### Task 2: 实现密码、会话与请求身份

**Files:**

- Create: `apps/api/src/password.ts`
- Create: `apps/api/src/password.spec.ts`
- Create: `apps/api/src/auth.ts`
- Create: `apps/api/src/auth.spec.ts`
- Create: `apps/api/src/errors.ts`

**Interfaces:**

- Produces: `hashPassword(password)`, `verifyPassword(password, encodedHash)`, `createSession(accountId)`, `requireActor(request)` 和 `RequestActor`。
- Consumes: Task 1 的 Prisma `Account`/`Session` 与 API 配置。

- [ ] **Step 1: 写密码失败测试**

```ts
it("verifies the original password but rejects a different password", async () => {
  const encoded = await hashPassword("correct-horse-battery-staple");
  await expect(verifyPassword("correct-horse-battery-staple", encoded)).resolves.toBe(true);
  await expect(verifyPassword("wrong-password", encoded)).resolves.toBe(false);
});
```

- [ ] **Step 2: 运行失败测试**

Run: `pnpm --filter @observation-handbook/api test -- password.spec.ts`

Expected: FAIL，提示 `password.ts` 不存在。

- [ ] **Step 3: 实现 scrypt 哈希格式**

使用 `crypto.randomBytes(16)` 创建盐，使用 `crypto.scrypt` 生成 64 字节派生值，并以 `scrypt$<salt-base64>$<hash-base64>` 保存。`verifyPassword` 必须用 `timingSafeEqual` 比较同长度字节串，遇到无效格式返回 `false`。

```ts
export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12) throw new Error("password must contain at least 12 characters");
  // create salt and derive a 64-byte scrypt value
}
```

- [ ] **Step 4: 写会话失败测试**

```ts
it("rejects an expired session token", async () => {
  const { rawToken } = await createSession(prisma, account.id, new Date("2026-08-22T00:00:00Z"));
  await expect(getActorFromToken(prisma, rawToken, new Date("2026-08-23T00:00:00Z"))).resolves.toBeNull();
});
```

- [ ] **Step 5: 实现会话与统一错误**

`createSession` 生成 32 字节随机令牌，只在返回值中暴露一次 `rawToken`，数据库保存 SHA-256 十六进制哈希与 30 天后过期时间。`getActorFromToken` 查询未过期会话及账户和成员关系。`requireActor` 缺少有效会话时抛出 `HttpError(401, "AUTH_REQUIRED")`。

```ts
export type RequestActor = {
  accountId: string;
  username: string;
  platformRole: "super_admin" | "operations_admin" | null;
  memberships: Array<{ familyId: string; role: "admin" | "reader" }>;
};
```

- [ ] **Step 6: 验证密码与会话**

Run: `pnpm --filter @observation-handbook/api test -- password.spec.ts auth.spec.ts`

Expected: PASS；错误密码、无效令牌、过期令牌均无法获得身份。

- [ ] **Step 7: 提交认证基础**

```bash
git add apps/api/src/password.ts apps/api/src/password.spec.ts apps/api/src/auth.ts apps/api/src/auth.spec.ts apps/api/src/errors.ts
git commit -m "feat: add password hashing and authenticated sessions"
```

### Task 3: 定义可复用的家庭与儿童访问规则

**Files:**

- Create: `packages/domain/src/access.ts`
- Create: `packages/domain/src/access.spec.ts`
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/domain/src/family-access.spec.ts`

**Interfaces:**

- Produces: `getFamilyRole(actor, familyId)`, `requireFamilyRead`, `requireFamilyAdmin`, `requireChildAccess`。
- Consumes: `RequestActor` 的等价最小结构和资源的 `familyId`/`childId`。

- [ ] **Step 1: 写跨家庭和只读写入的失败测试**

```ts
const actor = { memberships: [{ familyId: "family-a", role: "reader" as const }] };
expect(() => requireFamilyAdmin(actor, "family-a")).toThrow("FAMILY_ADMIN_REQUIRED");
expect(() => requireFamilyRead(actor, "family-b")).toThrow("FAMILY_ACCESS_DENIED");
```

- [ ] **Step 2: 运行失败测试**

Run: `pnpm test -- packages/domain/src/access.spec.ts`

Expected: FAIL，提示访问函数尚未导出。

- [ ] **Step 3: 实现纯领域范围函数**

```ts
export type FamilyScopedActor = { memberships: Array<{ familyId: string; role: "admin" | "reader" }> };

export function requireFamilyAdmin(actor: FamilyScopedActor, familyId: string): void {
  if (!actor.memberships.some(item => item.familyId === familyId && item.role === "admin")) {
    throw new Error("FAMILY_ADMIN_REQUIRED");
  }
}
```

`requireFamilyRead` 接受 `admin` 和 `reader`；`requireChildAccess` 接收已由仓储读取到的 `{ id, familyId }` 小朋友，并先执行家庭读权限。不要根据前端传来的家庭 ID 判定资源归属。

- [ ] **Step 4: 增加唯一管理员的仓储前置规则测试**

```ts
expect(() => assertFamilyRoleChange([
  { accountId: "a", role: "admin" },
], { accountId: "a", role: "reader" })).toThrow("FAMILY_ADMIN_REQUIRED");
```

`assertFamilyRoleChange` 必须拒绝：添加第二名管理员、移除唯一管理员、将唯一管理员降级。允许管理员替换时必须通过同一数据库事务内的“先加入新管理员、再降级旧管理员”专用操作，而不是普通角色更新。

- [ ] **Step 5: 验证领域规则**

Run: `pnpm test -- packages/domain/src/access.spec.ts packages/domain/src/family-access.spec.ts`

Expected: PASS；跨家庭与只读写入均被拒绝。

- [ ] **Step 6: 提交访问规则**

```bash
git add packages/domain/src/access.ts packages/domain/src/access.spec.ts packages/domain/src/index.ts packages/domain/src/family-access.spec.ts
git commit -m "feat: define family and child access rules"
```

### Task 4: 创建认证与当前会话 API

**Files:**

- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/routes/auth.ts`
- Create: `apps/api/src/routes/auth.spec.ts`
- Create: `apps/api/src/test-support.ts`

**Interfaces:**

- Produces: `POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/me`、`POST /api/auth/change-password`。
- Consumes: Tasks 1–2 的 Prisma、Cookie、密码和会话模块。

- [ ] **Step 1: 写登录 API 的失败测试**

```ts
it("creates an httpOnly session only for valid credentials", async () => {
  const app = await buildTestApp();
  const failed = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "admin", password: "wrong-password" } });
  expect(failed.statusCode).toBe(401);

  const success = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "admin", password: "correct-horse-battery-staple" } });
  expect(success.statusCode).toBe(200);
  expect(success.headers["set-cookie"]).toContain("HttpOnly");
});
```

- [ ] **Step 2: 运行失败测试**

Run: `pnpm --filter @observation-handbook/api test -- routes/auth.spec.ts`

Expected: FAIL，提示 `buildTestApp` 或路由不存在。

- [ ] **Step 3: 装配 Fastify 应用与路由**

`buildApp` 注册 Cookie 插件、错误处理器和认证路由。登录时只在账号存在且密码校验通过时设置 Cookie；失败一律返回 `401 AUTH_INVALID_CREDENTIALS`，不透露账号是否存在。退出时删除服务端会话并清除 Cookie。`GET /me` 只返回账号名、平台角色和当前可访问家庭的 ID/角色，绝不返回密码哈希或令牌。

改密接口只允许当前账户更改自己的密码：验证旧密码，写入新哈希，并删除该账户的其他会话。

- [ ] **Step 4: 增加未登录拒绝测试**

```ts
it("does not expose the current account without a session", async () => {
  const response = await app.inject({ method: "GET", url: "/api/auth/me" });
  expect(response.statusCode).toBe(401);
  expect(response.json()).toMatchObject({ code: "AUTH_REQUIRED" });
});
```

- [ ] **Step 5: 验证认证 API**

Run: `pnpm --filter @observation-handbook/api test -- routes/auth.spec.ts`

Expected: PASS；登录、读取当前账户、退出与改密路径可通过；无会话与错误凭据均被拒绝。

- [ ] **Step 6: 提交认证路由**

```bash
git add apps/api/src/app.ts apps/api/src/routes/auth.ts apps/api/src/routes/auth.spec.ts apps/api/src/test-support.ts
git commit -m "feat: add account authentication api"
```

### Task 5: 实现家庭成员与小朋友 API，并强制范围校验

**Files:**

- Create: `apps/api/src/repositories/family.ts`
- Create: `apps/api/src/routes/families.ts`
- Create: `apps/api/src/routes/families.spec.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**

- Produces: `GET /api/families/current`、`GET/POST /api/families/:familyId/members`、`POST /api/families/:familyId/children`、`GET /api/children/:childId`。
- Consumes: `requireFamilyRead`、`requireFamilyAdmin`、Prisma 事务与 `RequestActor`。

- [ ] **Step 1: 写只读成员拒绝写入的失败测试**

```ts
it("allows a reader to view a family but rejects child creation", async () => {
  const response = await signedReaderRequest(app, { method: "POST", url: `/api/families/${familyId}/children`, payload: { name: "安安" } });
  expect(response.statusCode).toBe(403);
  expect(response.json()).toMatchObject({ code: "FAMILY_ADMIN_REQUIRED" });
});
```

- [ ] **Step 2: 写跨家庭读取失败测试**

```ts
it("does not return a child from another family", async () => {
  const response = await signedFamilyARequest(app, { method: "GET", url: `/api/children/${familyBChildId}` });
  expect(response.statusCode).toBe(403);
  expect(response.json()).toMatchObject({ code: "FAMILY_ACCESS_DENIED" });
});
```

- [ ] **Step 3: 运行失败测试**

Run: `pnpm --filter @observation-handbook/api test -- routes/families.spec.ts`

Expected: FAIL，提示家庭路由或测试辅助函数尚不存在。

- [ ] **Step 4: 实现家庭仓储与写入事务**

仓储只能通过数据库中已读取的 `Family` 或 `Child` 的 `familyId` 调用领域规则。添加成员默认为 `reader`；管理员不可被删除。任何管理员替换必须显式调用 `replaceFamilyAdmin(prisma, familyId, previousAccountId, nextAccountId)`，并在一个 `prisma.$transaction` 中验证新账户已存在、写入新管理员、把旧管理员改为 `reader`。

`GET /api/families/current` 返回当前账户所有家庭的最小信息及各家庭小朋友，不自动选择其他家庭。所有写入在成功后创建 `AuditLog`。

- [ ] **Step 5: 实现路由并记录日志**

家庭管理员可添加只读成人、小朋友；成员和小朋友名称不可为空。家庭读者可以读取本家庭成员和儿童，但不能创建、修改、删除。`GET /api/children/:childId` 必须先从数据库读取儿童，再由其 `familyId` 执行读权限校验。

- [ ] **Step 6: 验证 API 集成测试**

Run: `pnpm --filter @observation-handbook/api test -- routes/families.spec.ts`

Expected: PASS；未登录、只读写入与跨家庭读取均被拒绝；管理员可创建小朋友和只读成员。

- [ ] **Step 7: 提交家庭与儿童 API**

```bash
git add apps/api/src/repositories/family.ts apps/api/src/routes/families.ts apps/api/src/routes/families.spec.ts apps/api/src/app.ts
git commit -m "feat: add family and child scoped api"
```

### Task 6: 以真实会话替换前端硬编码身份与儿童切换器

**Files:**

- Create: `apps/web/src/api/client.ts`
- Create: `apps/web/src/auth/AuthGate.tsx`
- Create: `apps/web/src/auth/LoginPage.tsx`
- Create: `apps/web/src/app-shell/AppShell.tsx`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/styles.css`
- Create: `apps/web/src/auth/AuthGate.spec.tsx`

**Interfaces:**

- Produces: `apiClient.me()`、`apiClient.login()`、`apiClient.currentFamilies()`、`AuthGate` 与由 API 数据驱动的儿童切换器。
- Consumes: Tasks 4–5 的认证、家庭、小朋友 API。

- [ ] **Step 1: 写登录门禁的失败测试**

```tsx
it("shows the login page when the session endpoint returns 401", async () => {
  mockApi.me.mockRejectedValue(new ApiError(401, "AUTH_REQUIRED"));
  render(<AuthGate><div>private application</div></AuthGate>);
  expect(await screen.findByRole("heading", { name: "登录观察手册" })).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行失败测试**

Run: `pnpm --filter @observation-handbook/web test -- AuthGate.spec.tsx`

Expected: FAIL，提示测试命令、`AuthGate` 或 API 客户端尚不存在。若当前前端缺少 DOM 测试运行环境，在本步骤添加 `jsdom`、`@testing-library/react` 和 `@testing-library/jest-dom`，并配置 Vitest。

- [ ] **Step 3: 实现 API 客户端与门禁**

```ts
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, credentials: "include", headers: { "content-type": "application/json", ...init?.headers } });
  if (!response.ok) throw new ApiError(response.status, (await response.json()).code);
  return response.json() as Promise<T>;
}
```

`AuthGate` 初始加载 `/api/auth/me`；收到 `401` 显示登录页；成功后加载当前家庭和小朋友。加载中显示最小化状态，不渲染原型内容。所有 API 调用必须带 `credentials: "include"`。

- [ ] **Step 4: 将壳层拆出并移除硬编码权限**

从 `main.tsx` 移除 `isSuperAdmin = true`、名称字符串推导出的儿童 ID 和固定家庭角色。`AppShell` 仅在 API 返回 `platformRole === "super_admin"` 时显示后台导航；儿童切换器基于当前家庭 API 返回的 `Child[]`。

在本任务中保留卡片、标签、手册、导出区域为“基础数据迁移中”的只读占位说明，不能继续用全局 `seedCards`、`handbooks` 或 `exportFiles` 伪装已持久化功能。公共空间入口始终在 `AuthGate` 内。

- [ ] **Step 5: 验证前端认证流**

Run: `pnpm --filter @observation-handbook/web test -- AuthGate.spec.tsx && pnpm build && pnpm typecheck`

Expected: PASS；未登录只能看登录页，登录后由 API 决定后台入口和儿童列表。

- [ ] **Step 6: 手动验证本地双服务运行**

Run in terminal 1: `SESSION_SECRET=development-only-secret-with-at-least-32-characters DATABASE_URL=file:./dev.db pnpm dev:api`

Run in terminal 2: `pnpm dev`

Expected: 访问 Web 应用先显示登录；用开发种子账号登录后显示其家庭和儿童；只读账号看不到任何创建或发布操作；未登录访问 API 返回 401。

- [ ] **Step 7: 提交前端会话接入**

```bash
git add apps/web/src package.json pnpm-lock.yaml vitest.config.ts
git commit -m "feat: gate family workspace behind authenticated api"
```

### Task 7: 创建开发种子、完整验证与原型边界清理

**Files:**

- Create: `apps/api/src/seed.ts`
- Create: `apps/api/src/seed.spec.ts`
- Modify: `README.md`
- Modify: `.gitignore`
- Modify: `docs/architecture.md`

**Interfaces:**

- Produces: `pnpm --filter @observation-handbook/api seed`、开发账号说明、可重复的空数据库初始化流程。
- Consumes: 任务 1–6 的数据库和认证接口。

- [ ] **Step 1: 写可重复种子的失败测试**

```ts
it("creates one family administrator, one reader and two children without duplicates", async () => {
  await seedDevelopmentData(prisma);
  await seedDevelopmentData(prisma);
  await expect(prisma.familyMembership.count({ where: { familyId } })).resolves.toBe(2);
  await expect(prisma.child.findMany({ where: { familyId } })).resolves.toHaveLength(2);
});
```

- [ ] **Step 2: 运行失败测试**

Run: `pnpm --filter @observation-handbook/api test -- seed.spec.ts`

Expected: FAIL，提示 `seedDevelopmentData` 尚未定义。

- [ ] **Step 3: 实现开发种子**

`seedDevelopmentData` 使用固定用户名但每次先按用户名查找，避免重复。创建一个家庭管理员、一个只读成员和两位小朋友；开发密码写入 README 的本地运行段落，并明确禁止用于生产。种子必须通过 `hashPassword` 写入哈希，不写入明文密码。

- [ ] **Step 4: 更新运行说明与架构约定**

README 必须列出：安装依赖、复制/设置 `SESSION_SECRET`、运行 Prisma 迁移、运行开发种子、分别启动 API 与 Web、开发账号仅限本地。`docs/architecture.md` 必须删除“前端状态即业务状态”的暗示，改为 API 服务端范围校验为权威来源。

- [ ] **Step 5: 运行完整验证**

Run:

```bash
pnpm test
pnpm --filter @observation-handbook/api test
pnpm build
pnpm typecheck
git diff --check
```

Expected: 所有领域/API/前端测试通过；Web 构建和类型检查通过；无格式错误。

- [ ] **Step 6: 进行人工权限回归**

1. 未登录访问 `/api/auth/me`、`/api/families/current` 和未来公共入口，确认均为 401。
2. 用只读成人登录，读取家庭和儿童成功；创建儿童、成员或调用任何写入接口均为 403。
3. 用家庭管理员登录，创建儿童和只读成员成功；不能删除唯一管理员。
4. 以家庭 A 身份读取家庭 B 小朋友，确认返回 403；前端不显示家庭 B 小朋友。
5. 重启 Web 和 API；登录、家庭与小朋友数据仍存在。

- [ ] **Step 7: 提交可运行基础阶段**

```bash
git add apps/api README.md .gitignore docs/architecture.md package.json pnpm-lock.yaml
git commit -m "feat: complete authenticated platform foundation"
```

## Self-Review

- 设计覆盖：任务 1–2 实现 SQLite、密码与会话；任务 3、5 强制家庭和儿童范围；任务 4、6 在 API 与界面落实登录；任务 7 验证可重复初始化和跨重启持久化。
- 约束检查：没有 A4、横版、家庭自定义模板或自由编辑；公共空间仍被 `AuthGate` 包围；不导入旧数据。
- 边界检查：卡片、标签、手册、模板、PDF 与公共发布的真实内容迁移明确留在后续独立计划，避免本阶段以原型内存状态假装完成。
- 类型检查：`RequestActor` 的成员结构与领域 `FamilyScopedActor` 兼容；所有儿童读取使用数据库记录的 `familyId`。
