import type { DocTheme, LayoutSlots } from './types.js';
import { standardComponents } from './components.js';
import type { CalloutProps } from '../components/callout.js';

function TerminalCallout({ title = 'Note', children }: CalloutProps) {
  return <aside className="dt-callout"><strong>[ {title} ]</strong><div>{children}</div></aside>;
}

function TerminalLayout({ navigation, article, outline }: LayoutSlots) {
  return <div className="dt-layout dt-layout-terminal">
    {navigation}
    <div className="dt-terminal-content">{article}{outline}</div>
  </div>;
}

export const terminalTheme = { id: 'terminal', Layout: TerminalLayout, components: { ...standardComponents, Callout: TerminalCallout } } satisfies DocTheme;
