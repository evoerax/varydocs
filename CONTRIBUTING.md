# Contributing to VaryDocs · 参与贡献

Use Node.js 22.12 or later, pnpm 10 and Python 3. From the checkout run `pnpm install --frozen-lockfile`, `pnpm test` and `pnpm build`. To try a change outside the workspace, run `pnpm pack:local` and `node scripts/smoke-release.mjs`. The [release checklist](RELEASE-CHECKLIST.zh-CN.md) includes keyboard, accessibility and bundle checks.

For a bug, open an issue using the [bug report template](.github/ISSUE_TEMPLATE/bug.yml). Include a minimal Markdown/MDX page or component import, your package versions, expected behavior and the actual output. For a change to the CLI or an adapter, include the template, language, theme, deployment prefix and build command. Remove API keys from logs. For a change to a public package, describe the impact on existing imports, generated projects and both English and Chinese UI.

使用 Node.js 22.12 以上、pnpm 10 和 Python 3。按上面的命令安装、运行测试并构建。在本仓库的 Issues 中使用「Bug report · 问题反馈」提交最小复现，说明系统版本、操作命令、预期与实际结果。涉及文档时请附一段可复现的 Markdown 或 MDX；涉及主题、语言或部署时请附相关配置。改动公开 API 或模板时，请说明旧项目如何升级。
