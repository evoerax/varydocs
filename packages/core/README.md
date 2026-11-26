# @varydocs/core

Compile Markdown and MDX on Node.js 22.12 or later. In a directory with a `varydocs.json` site configuration and a `content/docs/index.md` document with a frontmatter title, run the build from a Node module.

```js
import { buildDocs } from '@varydocs/core';

await buildDocs(process.cwd());
```

The generated `.varydocs/index.mjs` exports `manifest` and `modules` for the default language, alongside a `locales` map for multilingual sites. The `searchByLocale` export in `.varydocs/search.mjs` contains the search entries for each language. To validate without writing files, call `buildDocs(process.cwd(), { write: false })`. Read the [English writing guide](docs/en/index.mdx) or [中文写作指南](docs/zh-CN/index.mdx).
