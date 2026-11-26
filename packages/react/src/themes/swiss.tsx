import { standardComponents } from './components.js';
import type { DocTheme, LayoutSlots } from './types.js';

function SwissLayout({ navigation, article, outline }: LayoutSlots) {
  return <div className="dt-layout dt-layout-swiss">
    {navigation}
    <div className="dt-swiss-column">{article}{outline}</div>
  </div>;
}

export const swissTheme = { id: 'swiss', Layout: SwissLayout, components: standardComponents } satisfies DocTheme;
