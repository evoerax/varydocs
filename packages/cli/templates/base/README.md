# Your VaryDocs site

Install dependencies with your package manager, run the `dev` script and open `/docs/`.

- Edit Markdown or MDX in `content/docs`.
- Set the style and navigation in `varydocs.json`.
- Run the `check` script to validate documents and links.
- Run the `build` script to export the site to `out/`.

Set `VARYDOCS_SITE_URL` to your public origin, for example `https://docs.example.com`, at build time to generate canonical URLs, translation links and sitemap entries. For a site at `https://docs.example.com/product/`, also set `VARYDOCS_BASE_PATH=/product`. Configure your static host to serve `404.html` with status 404 for missing paths.

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
