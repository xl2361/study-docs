# 文章在线编辑服务

该 Worker 只允许站点来源登录，并且只能读取和更新 GitHub 私有仓库 `xl2361/study-docs` 中的 `src/content/posts/**/*.md`。Pages Functions 使用它完成整站账号验证和文章更新，浏览器始终访问 `dayu-study.pages.dev` 同域接口。

## 部署

1. 在 GitHub 创建 Fine-grained personal access token，只授权 `xl2361/study-docs`，Repository permissions 仅开启 `Contents: Read and write`。
2. 将 `wrangler.jsonc` 中的 `ALLOWED_ORIGIN`、仓库和分支改成实际值。
3. 设置三个 Secret，Secret 不要写进 `.env` 或提交到仓库：

```bash
pnpm wrangler secret put ADMIN_PASSWORD --config editor-worker/wrangler.jsonc
pnpm wrangler secret put SESSION_SECRET --config editor-worker/wrangler.jsonc
pnpm wrangler secret put GITHUB_TOKEN --config editor-worker/wrangler.jsonc
```

`ADMIN_PASSWORD` 使用独立的强密码。`SESSION_SECRET` 至少 32 个随机字符，可用密码管理器生成。

4. 部署 Worker：

```bash
pnpm wrangler deploy --config editor-worker/wrangler.jsonc
```

5. 使用 `pnpm build` 构建网站，再用 `pnpm wrangler pages deploy dist --project-name dayu-study --branch main` 部署。Pages Functions 会设置同域 HttpOnly Cookie，并代理编辑请求。

## 安全约束

- 登录账号固定为 `admin`，每个来源 IP 每分钟最多尝试 5 次。签名会话没有服务端到期时间，每次有效访问都会把 Cookie 续期至现代浏览器通常允许的最长持久期限 400 天；关闭浏览器不会退出登录，主动点击“退出”会立即清除会话。
- 登录使用浏览器顶层表单导航响应写入 Cookie，避免部分手机浏览器或 WebView 只在当前进程保存 `fetch` 响应 Cookie。
- 登录令牌只保存在常用的 `HttpOnly`、`Secure`、`SameSite=Lax` Cookie 中，浏览器脚本无法读取；从外部页面或浏览器启动入口打开网站时也会携带 Cookie。
- 未登录访问首页、文章、RSS、搜索索引和站点资源都会跳转登录页。
- Worker 严格校验请求 `Origin`，生产环境不要把 `ALLOWED_ORIGIN` 设置为 `*`。
- 仅支持 `.md`，不允许在线编辑 `.mdx`、站点配置、代码或工作流。
- 单篇文章上限 1 MB，必须具有包含 `title` 的 Frontmatter。
- 保存使用当前 Blob SHA；远端版本变化时返回 409，不会静默覆盖。
- “编辑”状态下的文章和分类改名先保存在当前标签页；点击“更新”后通过 Git Data API 一次提交为一个 GitHub Commit。
- 分支更新使用非强制推进；远端分支变化时整批拒绝，不会覆盖其他提交。
- 每次提交自动更新 Frontmatter 的 `updated` 日期，并在 GitHub 留下 Commit，可在仓库历史中回滚。

## 发布限制

仓库中的 `.github/workflows/deploy.yml` 会在 `master` 收到在线提交后自动检查、构建并部署现有 Cloudflare Pages 项目。GitHub 仓库需要配置 Actions Secret `CLOUDFLARE_API_TOKEN`，该 Token 只授予当前账号的 Cloudflare Pages 编辑权限。

```bash
在线点击“更新”
→ GitHub 产生一个 Commit
→ GitHub Actions 自动运行
→ 部署到 dayu-study.pages.dev
```

Actions 通常需要数分钟完成。界面提交成功后进入只读状态，新静态页面会在工作流完成后生效。

如果使用自定义域名访问网站，必须把 `ALLOWED_ORIGIN` 改成浏览器地址栏中的精确 Origin，并重新部署 Worker。
