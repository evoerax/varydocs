---
title: Theme API
description: Use the GTA6 layout in a React application that already has compiled VaryDocs content.
---

## Import the theme

```jsx
import { DocsView } from '@varydocs/react/view';
import { gta6Theme } from '@varydocs/react/themes/gta6';
import '@varydocs/react/themes/gta6.css';

export function Reader({ manifest, page, Body }) {
  return <DocsView manifest={manifest} page={page} Body={Body} theme={gta6Theme} />;
}
```

## Reader inputs

| Input | Where it comes from |
| --- | --- |
| `manifest` | The compiled manifest for the current language. |
| `page` | The entry in `manifest.pages` for the current URL. |
| `Body` | The default export of the module loaded for that page. |

## Add search

Pass `DocSearch` from `@varydocs/react/components/search` as the reader’s `Search` prop. Pass the current language’s search index as `searchDocuments`. The search box will take readers straight to matching headings.
