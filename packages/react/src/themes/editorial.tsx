import type { DocTheme, LayoutSlots } from './types.js';
import { standardComponents } from './components.js';
import type { CalloutProps } from '../components/callout.js';

function EditorialCallout({ title = 'Note', children }: CalloutProps) {
  return <blockquote className="dt-callout"><strong>{title}</strong><div>{children}</div></blockquote>;
}

function EditorialLayout({ navigation, article, outline }: LayoutSlots) {
  return <div className="dt-layout dt-layout-editorial">
    {navigation}
    <div className="dt-editorial-content">{outline}{article}</div>
  </div>;
}

export const editorialTheme = { id: 'editorial', Layout: EditorialLayout, components: { ...standardComponents, Callout: EditorialCallout } } satisfies DocTheme;
