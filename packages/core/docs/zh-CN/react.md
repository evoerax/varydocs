---
title: 嵌入 React
description: 把 VaryDocs 文档渲染到已有 React 应用。
---

## 编译文档

在构建中调用 @varydocs/core 的 buildDocs()。页面清单和逐页导入模块会生成到 .varydocs/。

## 渲染页面

如果站点只用一种主题，分别引入阅读器、主题和对应的样式表。由宿主路由在清单里找到当前页面，加载对应的 MDX 模块，作为 `Body` 传入。

```jsx
import { DocsView } from '@varydocs/react/view';
import { swissTheme } from '@varydocs/react/themes/swiss';
import '@varydocs/react/themes/swiss.css';

export function SwissDocs({ manifest, page, Body }) {
  return <DocsView manifest={manifest} page={page} Body={Body} theme={swissTheme} />;
}
```

这组入口会打包 Swiss 布局和文档共用的样式。新建的 CLI 项目会在每次构建时按 `varydocs.json` 的 `style` 选择对应入口。若应用需要在运行时提供所有内置主题，可以从 `@varydocs/react` 引入 `DocsView`，搭配 `@varydocs/react/styles.css`。

通过 `mount` 指定文档的路径前缀。独立的 Vite 示例在两种语言下均包含 Markdown 和 MDX。

## 按需引入组件

```tsx
import { Tab, Tabs } from '@varydocs/react/components/tabs';
import '@varydocs/react/components/tabs.css';
```

还可以单独引入 `callout`、`steps`、`code-block`、`copy-button` 和 `search`。这些入口可用于已有的 React 或 Next.js 应用。

页面上只用 `Tabs` 时，上面的两行导入就够了。它的浏览器产物只包含标签页和所需的共享代码。在已有 React 项目里安装 `@varydocs/react`，只会额外引入零依赖的 `@varydocs/model`。需要编译 Markdown 或 MDX 的项目再安装 `@varydocs/core`。

## 配置多语言

在 `varydocs.json` 中配置多语言。将 `i18n.defaultLocale` 设为已声明的语言 ID。`i18n.locales` 是对象数组，每项都有 `id` 和 `label`。

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

将每种语言的文档放在 `content/docs/` 下的单独目录。例如 `content/docs/en/setup.mdx` 和 `content/docs/zh-CN/setup.mdx` 使用相同的相对路径，读者切换语言时会打开同一页面的译文。各语言可以独立定义导航，并各自生成搜索索引。
