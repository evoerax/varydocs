---
title: 主题 API
description: 在已有的 React 应用中，用 GTA6 布局展示编译好的 VaryDocs 内容。
---

## 引入主题

```jsx
import { DocsView } from '@varydocs/react/view';
import { gta6Theme } from '@varydocs/react/themes/gta6';
import '@varydocs/react/themes/gta6.css';

export function Reader({ manifest, page, Body }) {
  return <DocsView manifest={manifest} page={page} Body={Body} theme={gta6Theme} />;
}
```

## 阅读器参数

| 参数 | 来源 |
| --- | --- |
| `manifest` | 当前语言编译生成的文档清单。 |
| `page` | `manifest.pages` 中与当前网址匹配的条目。 |
| `Body` | 对应页面模块的默认导出组件。 |

## 接入搜索

从 `@varydocs/react/components/search` 引入 `DocSearch`，通过阅读器的 `Search` 属性传入。将当前语言的搜索索引传给 `searchDocuments`，读者即可从搜索结果直接定位到相应小节。
