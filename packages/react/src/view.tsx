import type { ComponentPropsWithoutRef, ComponentType, ElementType, ReactNode, Ref } from 'react';
import { pagePath } from '@varydocs/model';
import type { DocLayout, DocManifest, DocPage, SearchDocument } from '@varydocs/model';
import { AppearanceSelect } from './components/appearance.js';
import { ReaderTopbar } from './components/reader-topbar.js';
import { DocsLanguage } from './language.js';
import { getMessages } from './messages.js';
import type { DocMessages } from './messages.js';
import type { DocSearchProps } from './components/search.js';
import type { DocTheme, ThemePageContext } from './themes/types.js';

export type { DocTheme, LayoutSlots, ThemeHeaderProps, ThemePageContext } from './themes/types.js';
export type { DocLayout } from '@varydocs/model';

export type MdxBody = ComponentType<{ components: Record<string, ElementType> }>;
export type PageModules = Record<string, () => Promise<{ default: MdxBody }>>;

type LinkProps = ComponentPropsWithoutRef<'a'> & { href: string; ref?: Ref<HTMLAnchorElement> };

export interface DocsViewProps {
  manifest: DocManifest;
  page: DocPage;
  Body: MdxBody;
  /** Base path plus a mount path, without a trailing slash. */
  mount?: string;
  /** Path prefix for root-relative assets, without a trailing slash. */
  assetBase?: string;
  theme: DocTheme;
  /** Overrides the layout in the manifest for a full-page reader. */
  layout?: DocLayout;
  Search?: ComponentType<DocSearchProps>;
  headerActions?: ReactNode;
  components?: Record<string, ElementType>;
  Link?: ComponentType<LinkProps>;
  searchIndex?: string;
  searchDocuments?: SearchDocument[];
  embedded?: boolean;
  messages?: Partial<DocMessages>;
}

export function DocsView({
  manifest, page, Body, mount = '/docs', assetBase = '', theme, layout, Search, headerActions, components, Link,
  searchIndex, searchDocuments, embedded = false, messages: overrides,
}: DocsViewProps) {
  const { Layout, Header } = theme;
  const readerLayout = embedded ? 'theme' : layout ?? manifest.layout ?? 'theme';
  const locale = manifest.locale ?? 'en';
  const messages = getMessages(locale, { ...theme.messages?.(locale), ...overrides });
  const PageHeading = embedded ? 'h2' : 'h1';
  const hrefs = Object.fromEntries(manifest.pages.map(item => [item.id, pagePath(item, mount)]));
  const pagesById = new Map(manifest.pages.map(item => [item.id, item]));
  const sequence = manifest.navigation.flatMap(group => group.pages);
  const current = sequence.indexOf(page.id);
  const previous = pagesById.get(sequence[current - 1]);
  const next = pagesById.get(sequence[current + 1]);
  const root = hrefs.index ?? mount + '/';
  const SiteLink = Link ?? 'a';
  const groups = manifest.navigation.map(group => ({
    label: group.label,
    pages: group.pages.map(id => ({ id, title: pagesById.get(id)?.title ?? id, href: hrefs[id] })),
  }));
  const context = { locale, pageTitle: page.title, pageId: page.id, sourcePath: page.sourcePath, groups };

  function BodyLink({ href, 'data-varydocs-route': isDoc, ...props }: ComponentPropsWithoutRef<'a'> & {
    'data-varydocs-route'?: string | boolean;
  }) {
    if (isDoc && href) return <SiteLink {...props} href={mount + href} />;
    if (href?.startsWith('/') && !href.startsWith('//')) href = assetBase + href;
    return <a {...props} href={href} />;
  }

  function BodyImage({ src, ...props }: ComponentPropsWithoutRef<'img'>) {
    if (src?.startsWith('/') && !src.startsWith('//')) src = assetBase + src;
    return <img {...props} src={src} loading={props.loading ?? 'lazy'} />;
  }

  const Callout = theme.components.Callout;
  const Table = theme.components.table;
  const localized = {
    ...(Callout ? { Callout: ({ title, ...props }: { title?: string }) => <Callout {...props} title={title ?? messages.note} /> } : {}),
    ...(Table ? { table: (props: ComponentPropsWithoutRef<'table'>) => <Table {...props} aria-label={messages.table} /> } : {}),
  };

  const brand = <SiteLink className="dt-brand" href={root}>
    {!Header && <span className="dt-brand-mark" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65"
        strokeLinecap="round" strokeLinejoin="round" focusable="false">
        <path d="M9 3.5h7l4 4v9h-11z M16 3.5v4h4M12 11h5m-5 2.75h3 M5 7.5v13h11" />
      </svg>
    </span>}
    {Header ? manifest.name : <bdi>{manifest.name}</bdi>}
  </SiteLink>;
  const search = Search && (searchIndex || searchDocuments) ?
    <Search indexUrl={searchIndex} documents={searchDocuments} hrefs={hrefs} /> : null;
  const actions = <>
    {headerActions}
    <AppearanceSelect locale={locale} labels={messages.appearance} />
  </>;
  const header = Header ? <Header brand={brand} actions={<>{search}{actions}</>} context={context} /> :
    <header className="dt-header dt-header-default" data-search={search ? '' : undefined}>
      <div className="dt-header-inner">
        {brand}
        {search && <div className="dt-header-search">{search}</div>}
        <div className="dt-header-actions">{actions}</div>
      </div>
    </header>;
  const navigation = <aside className="dt-sidebar">
    {readerLayout === 'sidebar' && <div className="dt-reader-sidebar-header">{header}</div>}
    <details className="dt-mobile-menu">
      <summary>{messages.pages}</summary>
      <Navigation groups={groups} pageId={page.id} label={messages.navigation} Link={SiteLink} />
    </details>
    <div className="dt-desktop-menu">
      <Navigation groups={groups} pageId={page.id} label={messages.navigation} Link={SiteLink} />
    </div>
  </aside>;
  const outline = page.headings.length ? <nav className="dt-outline" aria-label={messages.outline}>
    <p>{messages.outline}</p>
    <ul>{page.headings.map(heading => <li key={heading.id} data-level={heading.level}>
      <a href={'#' + encodeURIComponent(heading.id)}>{heading.title}</a>
    </li>)}</ul>
  </nav> : null;
  const article = <article className="dt-article" id="doc-content" tabIndex={embedded ? undefined : -1}>
    <header className="dt-page-header">
      <PageHeading className="dt-page-title">{page.title}</PageHeading>
      {page.description && <p>{page.description}</p>}
    </header>
    <div className="dt-prose">
      <Body components={{ a: BodyLink, img: BodyImage, ...theme.components, ...localized, ...components }} />
    </div>
    {(previous || next) && <nav className="dt-pagination" aria-label={messages.pagination}>
      {previous && <SiteLink href={hrefs[previous.id]}><small>{messages.previous}</small>{previous.title}</SiteLink>}
      {next && <SiteLink href={hrefs[next.id]}><small>{messages.next}</small>{next.title}</SiteLink>}
    </nav>}
  </article>;

  return <DocsLanguage locale={locale} messages={messages}><div className="dt-shell" data-doc-theme={theme.id}
    data-doc-layout={readerLayout} data-embedded={embedded} lang={locale} dir={manifest.dir ?? 'ltr'}>
    {!embedded && <a href="#doc-content" className="dt-skip">{messages.skip}</a>}
    {readerLayout === 'theme' && header}
    {readerLayout === 'topbar' && <ReaderTopbar>{header}</ReaderTopbar>}
    <Layout navigation={navigation} article={article} outline={outline} context={context} />
  </div></DocsLanguage>;
}

function Navigation({ groups, pageId, label, Link }: {
  groups: ThemePageContext['groups']; pageId: string; label: string;
  Link: ComponentType<LinkProps> | 'a';
}) {
  return <nav aria-label={label}>
    {groups.map(group => <div key={group.label} className="dt-nav-group">
      <p>{group.label}</p>
      <ul>{group.pages.map(item => <li key={item.id}>
        <Link href={item.href} aria-current={pageId === item.id ? 'page' : undefined}>{item.title}</Link>
      </li>)}</ul>
    </div>)}
  </nav>;
}
