# VaryDocs 文档站

安装项目依赖并运行 `dev` 脚本，在 `/docs/` 预览。文档保存在 `content/docs` 的语言目录下，导航和风格设在 `varydocs.json`。运行 `check` 检查文档与链接，运行 `build` 导出到 `out/`。

构建时将 `VARYDOCS_SITE_URL` 设为公开域名，例如 `https://docs.example.com`，即可生成规范网址、译文链接和站点地图条目。若部署在 `/product` 下，同时设置 `VARYDOCS_BASE_PATH=/product`。在静态服务器上将未找到的路径映射到 `404.html` 并返回 404 状态。

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
