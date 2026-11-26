import { standardComponents } from './components.js';
import type { DocTheme, LayoutSlots } from './types.js';

function BrutalismLayout({ navigation, article, outline }: LayoutSlots) {
  return <div className="dt-layout dt-layout-brutalism">
    <div className="dt-brutalism-index">{navigation}{outline}</div>
    {article}
  </div>;
}

export const brutalismTheme = { id: 'brutalism', Layout: BrutalismLayout, components: standardComponents } satisfies DocTheme;
