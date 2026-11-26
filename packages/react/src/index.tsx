import { DocSearch } from './components/search.js';
import { getTheme } from './themes.js';
import { DocsView as ComposableView } from './view.js';
import type { DocsViewProps as ComposableViewProps } from './view.js';
import type { DocTheme } from './themes/types.js';

export { getTheme, themes } from './themes.js';
export type { DocTheme, LayoutSlots, ThemeHeaderProps, ThemePageContext } from './themes/types.js';
export { CopyButton } from './components/copy-button.js';
export { DocsLanguage } from './language.js';
export { getMessages } from './messages.js';
export type { DocMessages } from './messages.js';
export type { DocLayout, MdxBody, PageModules } from './view.js';

export interface DocsViewProps extends Omit<ComposableViewProps, 'theme' | 'Search'> {
  style?: string;
  theme?: DocTheme;
}

export function DocsView({ manifest, style = manifest.style, theme = getTheme(style), ...props }: DocsViewProps) {
  return <ComposableView {...props} manifest={manifest} theme={theme} Search={DocSearch} />;
}
