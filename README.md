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

- `lin`：体验家庭的家庭管理员
- `zhou`：家庭只读成员
- `platform`：超级管理员（用于管理全局模板）

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

## 备份与恢复

停止 API 后备份 SQLite 数据与媒体目录：

```bash
cp -R apps/api/data apps/api/data-backup-$(date +%Y%m%d)
```

恢复时，停止 API，将备份目录复制回 `apps/api/data/`，然后启动 API。生产环境应先验证备份可在独立目录完成迁移、登录与读取。

## 腾讯云部署

在腾讯云轻量应用服务器或云服务器安装 Docker 与 Docker Compose，复制 `.env.production.example` 为 `.env.production` 并设置强随机 `SESSION_SECRET`。将 TLS 证书放入 `deploy/certs/fullchain.pem` 与 `deploy/certs/privkey.pem` 后执行：

```bash
docker compose up -d --build
curl -fsS https://your-domain.example/api/health
```

SQLite 数据库和上传媒体保存在 Docker 卷 `handbook_data`，不可随容器删除。建议每天以计划任务运行 `scripts/backup-data.sh` 到腾讯云 COS 或独立备份盘；恢复前使用 `scripts/restore-verify.sh backup.tgz /tmp/handbook-restore` 验证归档结构。

## 发布前验收

以管理员验证创建 1–4 张照片的卡片、标签、手册、模板选择、屏幕/印刷导出、发布与撤回；以只读成员验证所有写入返回 403。屏幕 PDF 必须为 A5 竖版、无出血和裁切线；印刷 PDF 必须为 A5 竖版、3mm 出血并含裁切线。

SQLite 数据库和媒体文件保存在 `apps/api/data/`，已被 Git 忽略。开发环境如需重置数据，可删除该目录后再次执行种子与迁移命令。
