# 观察手册

独立重建的家庭儿童观察记录、主题手册与 PDF 出版平台。

本项目不依赖、不引用、不迁移旧项目的代码、包、运行数据或业务数据。

## 核心约束

- 每位小朋友独立拥有观察卡片、标签、观察手册与导出文件。
- 家庭只有一位管理员，其余成人成员只读；后台中心仅超级管理员可用。
- 卡片默认按月浏览，支持时间流与月历，并始终显示缩略图而非原图。
- 模板由后台版本化管理；已使用版本不可修改或删除。

## 本地启动

需要 Node.js 22+ 与 pnpm 10。安装依赖后，创建至少 32 字符的开发会话密钥，并初始化 SQLite 数据库和开发账户：

```bash
pnpm install --frozen-lockfile
export SESSION_SECRET="replace-with-a-development-secret-of-at-least-32-characters"
pnpm --filter @observation-handbook/api seed
pnpm --filter @observation-handbook/api db:migrate
```

开发种子创建两个账号，密码均为 `correct-horse-battery-staple`：

- `lin`：家庭管理员和超级管理员
- `zhou`：家庭只读成员

在两个终端分别启动 API 与 Web：

```bash
SESSION_SECRET="replace-with-a-development-secret-of-at-least-32-characters" pnpm dev:api
pnpm dev
```

执行验证：

```bash
pnpm test
pnpm typecheck
pnpm build
```

SQLite 数据库和媒体文件保存在 `apps/api/data/`，已被 Git 忽略。开发环境如需重置数据，可删除该目录后再次执行种子与迁移命令。
