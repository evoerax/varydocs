# @varydocs/react

Use individual documentation components in a React 19 project. Import the component stylesheet once.

```tsx
import { Tabs, Tab } from '@varydocs/react/components/tabs';
import '@varydocs/react/components/tabs.css';

export function Commands() {
  return <Tabs><Tab title="npm"><code>npm run dev</code></Tab><Tab title="pnpm"><code>pnpm dev</code></Tab></Tabs>;
}
```

For a single-theme site, import `DocsView` from `@varydocs/react/view`, pass the theme from `@varydocs/react/themes/swiss`, and load `@varydocs/react/themes/swiss.css`. Other component subpaths include `callout`, `steps`, `search`, `copy-button` and `code-block`. Each has a matching CSS entry. Standalone components work without the content compiler.

Use `layout="topbar"` for a pinned site header with navigation below, or `layout="sidebar"` for site controls above a separately scrolling navigation rail. `DocsView` also reads `manifest.layout` and defaults to `"theme"`. Each option uses the active theme's own header, navigation and article layout. Embedded readers use the theme layout.

The GTA6 theme ships Barlow Condensed Black (regular and italic) and Explora Regular under the SIL Open Font License 1.1. The license notices accompany the fonts. [Barlow Condensed license](styles/assets/barlow-condensed-OFL.txt) · [Explora license](styles/assets/explora-OFL.txt)
