# Your VaryDocs site

Run `npm install` and `npm run dev`, then open `/docs/`. The assistant button beside search opens a conversation about the current documentation. With no model configured, it retrieves relevant excerpts and links to the source sections.

## Connect a model

Set `AI_GATEWAY_API_KEY` and `VARYDOCS_AI_MODEL` in the server environment or in a local `.env.local` file. Use the provider/model ID from your Vercel AI Gateway account. Restart the server after changing these settings. The model receives the conversation and matching documentation excerpts. For a private site, apply its access controls to `/api/ask/` as well as the document pages.

If your model supports tool calling, set `VARYDOCS_AI_DOCUMENT_SEARCH=1` in the server environment to let the assistant search the current language's documentation once more when it needs evidence.

## Build and deploy

The assistant limits chat requests to 30 per minute per server process. Set `VARYDOCS_AI_REQUESTS_PER_MINUTE` to a positive integer to change it. Apply a shared limit at your gateway for multiple instances. The server log includes `[varydocs:assistant]` JSON events with model usage, the document locale and page, the outcome, and reader ratings. You can match a rating with the answer's usage event by response ID. The events omit questions, answers and credentials.

Run `npm run check` to validate documents and links, then `npm run build` and `npm start` to serve the production site with Node.js. The assistant uses a streaming POST route. When deploying under a prefix such as `/product`, set `VARYDOCS_BASE_PATH` to that prefix for both build and runtime.

Set `VARYDOCS_SITE_URL` to the public origin, such as `https://docs.example.com`, at build and runtime to enable canonical URLs, translation links and sitemap entries.

Edit Markdown and MDX in `content/docs`. Set the theme and navigation in `varydocs.json`.

## Add a language to an existing starter

Upgrade the project's `@varydocs/*` dependencies together. For an English starter, move the existing documents under `content/docs/en/` and add translations under `content/docs/zh-CN/` with matching relative paths. Keep the existing site name and style. Add this field to `varydocs.json`:

```json
"i18n": {
  "defaultLocale": "en",
  "locales": [{ "id": "en", "label": "English" }, { "id": "zh-CN", "label": "简体中文" }]
}
```

Each language can set its own `navigation` to list the pages available in that language. Run the project's `check` and `build` scripts. The CLI fills in missing localized routes during build or dev. Test `/docs/`, `/zh-CN/docs/` and their language switcher. A missing translation links to that language's document index. If you later keep only the default language, its previously generated localized routes also serve a language-prefixed alias and advertise the unprefixed canonical URL.

Custom home pages and document layouts can use the starter's `seo.metadata(locale)` (home) or `seo.metadata(locale, slug ?? [])` (document) from `@/lib/varydocs-seo` in Next.js `generateMetadata`. If you own the sitemap, use `seo.sitemap()` to include existing translated pages.
