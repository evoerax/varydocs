---
title: Embed in React
description: Mount VaryDocs inside an existing React app.
---

## Compile content

Use `buildDocs()` from `@varydocs/core` during your build. The generated manifest and page imports are written to `.varydocs/`.

## Render a page

For a site with one theme, import the reader, theme, and matching stylesheet separately. Let your router select the page from the manifest and load its MDX module as `Body`.

```jsx
import { DocsView } from '@varydocs/react/view';
import { swissTheme } from '@varydocs/react/themes/swiss';
import '@varydocs/react/themes/swiss.css';

export function SwissDocs({ manifest, page, Body }) {
  return <DocsView manifest={manifest} page={page} Body={Body} theme={swissTheme} />;
}
```

This bundles the Swiss layout and shared document styles. CLI-generated sites select these imports from the `style` in `varydocs.json` on each build. For an app that offers all built-in themes at runtime, use `DocsView` from `@varydocs/react` with `@varydocs/react/styles.css`.

Use the `mount` prop to place documentation under a subpath. The host handles routing and deployment. The standalone Vite example includes Markdown and MDX in both languages.

## Import a component

```tsx
import { Tab, Tabs } from '@varydocs/react/components/tabs';
import '@varydocs/react/components/tabs.css';
```

Other component entry points include `callout`, `steps`, `code-block`, `copy-button`, and `search`. These entry points work in an existing React or Next.js application.

A standalone `Tabs` needs only the two imports above. Its browser bundle excludes the reader, theme layouts, and search. Installing `@varydocs/react` in a React app brings in the dependency-free `@varydocs/model`. Install `@varydocs/core` in a project that compiles Markdown or MDX.

## Configure languages

Configure multiple languages in `varydocs.json`. Set `i18n.defaultLocale` to one of the locale IDs. The `i18n.locales` array contains objects with `id` and `label` fields.

```json
{
  "name": "My Docs",
  "i18n": {
    "defaultLocale": "en",
    "locales": [
      { "id": "en", "label": "English" },
      { "id": "zh-CN", "label": "简体中文" }
    ]
  }
}
```

Put each language under `content/docs/`. For example, `content/docs/en/setup.mdx` and `content/docs/zh-CN/setup.mdx` share the same relative path so the language switcher opens the counterpart page. Each language can declare its own navigation and gets a separate search index.
