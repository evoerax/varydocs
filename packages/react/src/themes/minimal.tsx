import type { DocTheme, LayoutSlots } from './types.js';
import { standardComponents } from './components.js';

function MinimalLayout({ navigation, article, outline }: LayoutSlots) {
  return <div className="dt-layout dt-layout-minimal">{navigation}{article}{outline}</div>;
}

export const minimalTheme = { id: 'minimal', Layout: MinimalLayout, components: standardComponents } satisfies DocTheme;
