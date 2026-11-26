import { standardComponents } from './components.js';
import type { DocTheme, LayoutSlots, ThemeHeaderProps } from './types.js';

function Gta6Header({ brand, actions, context }: ThemeHeaderProps) {
  const { groups, locale, pageId } = context;
  const links = groups.length === 1 ? groups[0].pages.map(page => ({ ...page, inSection: false })) : groups.flatMap(group => {
    const first = group.pages[0];
    return first ? [{ ...first, title: group.label, inSection: group.pages.some(page => page.id === pageId) }] : [];
  });
  return <header className="dt-header dt-gta6-header">
    <div className="dt-gta6-identity">{brand}<span className="dt-gta6-edition">GTA6</span></div>
    {links.length > 0 && <nav className="dt-gta6-sections" aria-label={locale.startsWith('zh') ? '主要栏目' : 'Sections'}>
      {links.slice(0, 4).map(link => <a key={link.id} href={link.href}
        aria-current={pageId === link.id ? 'page' : link.inSection ? 'location' : undefined}>{link.title}</a>)}
    </nav>}
    <div className="dt-header-actions">{actions}</div>
  </header>;
}

function Gta6Layout({ navigation, article, outline, context }: LayoutSlots) {
  const group = context?.groups.find(group => group.pages.some(page => page.id === context.pageId));
  const entry = group?.pages[0];
  return <div className="dt-layout dt-layout-gta6" data-outline={outline ? true : undefined}>
    {navigation}
    <div className="dt-gta6-reading">
      {group && entry && <p className="dt-gta6-path">
        {entry.id === context?.pageId ? group.label : <a href={entry.href}>{group.label}</a>}
        <span aria-hidden="true"> / </span>{context?.pageTitle}
      </p>}
      {article}
    </div>
    {outline}
  </div>;
}

export const gta6Theme = { id: 'gta6', Header: Gta6Header, Layout: Gta6Layout, components: standardComponents } satisfies DocTheme;
