# VaryDocs 文档站

运行 `npm install` 和 `npm run dev`，打开 `/docs/`。点击搜索旁的助手按钮，即可就当前文档提问。未配置模型时，助手会检索相关摘录，并提供跳转到原文小节的链接。

## 接入模型

在服务端环境或本地的 `.env.local` 中设置 `AI_GATEWAY_API_KEY` 和 `VARYDOCS_AI_MODEL`。模型标识使用 Vercel AI Gateway 账户中的 provider/model ID。修改环境变量后重启服务。模型会收到本次对话和命中的文档摘录。私有文档站需要将页面的访问控制同时应用于 `/api/ask/`。

使用支持工具调用的模型时，可在服务端设置 `VARYDOCS_AI_DOCUMENT_SEARCH=1`。当已有摘录不足以回答问题时，助手可以在当前语言的文档中补查一次。

## 构建与部署

助手默认每个服务进程每分钟处理 30 条聊天请求。把 `VARYDOCS_AI_REQUESTS_PER_MINUTE` 设为正整数可调整上限。使用多个实例时，在部署网关设置共享限流。服务端日志中带 `[varydocs:assistant]` 前缀的 JSON 事件包含模型用量、页面语言与标识、处理结果以及读者评分。可按 `responseId` 把评分和相应的用量事件关联起来。日志不包含问题、回答或密钥。

运行 `npm run check` 校验文档与链接，再运行 `npm run build` 和 `npm start` 通过 Node.js 提供生产服务。助手通过 POST 接口流式返回回答。如果站点部署在 `/product` 等子路径，构建和运行时都应将 `VARYDOCS_BASE_PATH` 设为相同的前缀。

构建和运行时将 `VARYDOCS_SITE_URL` 设为公开域名（例如 `https://docs.example.com`），即可生成规范网址、译文链接和站点地图条目。

在 `content/docs` 中编写 Markdown 或 MDX，通过 `varydocs.json` 设置主题和导航。

## 将已有 Starter 升级为双语

将项目的 `@varydocs/*` 依赖升级到同一版本。若原站为英语，将原文移到 `content/docs/en/`，将对应译文按相同的相对路径放入 `content/docs/zh-CN/`。保留站点名称和风格，在 `varydocs.json` 中加入以下字段。

```json
"i18n": {
  "defaultLocale": "en",
  "locales": [{ "id": "en", "label": "English" }, { "id": "zh-CN", "label": "简体中文" }]
}
```

每种语言可用独立的 `navigation` 列出已有页面。运行项目的 `check` 和 `build` 脚本，CLI 会在 `build` 或 `dev` 时补齐本地化路由。可在 `/docs/` 与 `/zh-CN/docs/` 之间切换。缺少对应译文时，语言切换链接会指向目标语言的文档首页。若将已启用双语的站点改回单语，保留的默认语言也可通过带语言前缀的别名访问，规范网址仍指向无前缀的路径。

自定义首页或文档布局可在 Next.js 的 `generateMetadata` 中调用 `@/lib/varydocs-seo` 提供的 `seo.metadata(locale)`（首页）或 `seo.metadata(locale, slug ?? [])`（文档页）。如果已自定义站点地图，可用 `seo.sitemap()` 引入文档与对应译文。
