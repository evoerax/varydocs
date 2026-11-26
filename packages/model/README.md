# @varydocs/model

Dependency-free types and URL helpers for VaryDocs manifests. Use these in a custom renderer, adapter or search interface.

```ts
import { pagePath, type DocPage } from '@varydocs/model';

export function docsUrl(page: DocPage) {
  return pagePath(page, '/product/docs');
}
```

For client-side or server-side document retrieval, import `createDocumentSearch` from `@varydocs/model/search`. Pass one language’s search documents and locale, then call the returned function with a query.
