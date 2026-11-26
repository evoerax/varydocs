import { standardComponents } from './components.js';
import type { DocTheme, LayoutSlots } from './types.js';

function BlueprintLayout({ navigation, article, outline }: LayoutSlots) {
  return <div className="dt-layout dt-layout-blueprint">{navigation}{article}{outline}</div>;
}

export const blueprintTheme = { id: 'blueprint', Layout: BlueprintLayout, components: standardComponents } satisfies DocTheme;
