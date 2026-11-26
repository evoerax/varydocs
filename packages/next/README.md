# @varydocs/next

Connect compiled VaryDocs content to a Next.js 16 App Router site using React 19. Compile the content before running Next.

```js
import { createDocsLoader } from '@varydocs/next/loader';
import { manifest, modules } from './.varydocs/index.mjs';

const docs = createDocsLoader({ manifest, modules, mount: '/docs' });
const home = await docs.load([]);
```

Pass the loaded props to `DocsView` from `@varydocs/react/view` with the selected theme and its stylesheet. For canonical URLs, language alternates and sitemap entries, call `createDocsSeo` from `@varydocs/next/seo` with a public HTTP(S) origin in `siteUrl`, `defaultLocale` and the compiled `locales` map. Set `basePath` on both helpers for a subpath deployment.

The `varydocs init` command from `@varydocs/cli` creates a working App Router template.
