import { createDocsLoader } from '@varydocs/next/loader';
import { DocsView } from '@varydocs/react/view';
import { AppearanceSelect } from '@varydocs/react/components/appearance';
import { SiteLanguages } from './site-languages';
import { DocSearch } from '@varydocs/react/components/search';
import { localePrefix, pagePath } from '@varydocs/core/model';
import { defaultLocale, languages, locales } from '@/.varydocs/index.mjs';
import { theme } from '@/.varydocs/theme.mjs';
import { headerActions } from './header-actions.jsx';

export { defaultLocale };
export const basePath = process.env.VARYDOCS_BASE_PATH ?? '';
export const otherLanguages = () => languages.filter(language => language.id !== defaultLocale).map(language => ({ locale: language.id }));

function mount(locale) {
  return localePrefix(locale, defaultLocale) + '/docs';
}

export function docsFor(locale) {
  return createDocsLoader({
    ...locales[locale], basePath, mount: mount(locale),
    searchPath: localePrefix(locale, defaultLocale) + '/varydocs-search.json',
  });
}

export function SiteLayout({ locale, children }) {
  return <html lang={locale} dir={locales[locale].manifest.dir}><body style={{ margin: 0 }}>{children}</body></html>;
}

function LanguageSwitch({ locale, slug }) {
  const others = languages.filter(language => language.id !== locale);
  if (!others.length) return null;
  const links = others.map(({ id, label }) => {
    const home = basePath + localePrefix(id, defaultLocale);
    if (slug === undefined) return { id, label, href: home + '/' };
    const page = locales[id].manifest.pages.find(doc => doc.slug.join('/') === slug.join('/'));
    const prefix = home + '/docs';
    return { id, label, href: page ? pagePath(page, prefix) : prefix + '/', fallback: !page };
  });
  return <SiteLanguages locale={locale} links={links} basePath={basePath} siteEntry={slug === undefined && locale === defaultLocale} />;
}

export function Home({ locale }) {
  const { name, style } = locales[locale].manifest;
  return <main className="dt-shell" data-doc-theme={style}>
    <div className="dt-header dt-home-actions">
      <LanguageSwitch locale={locale} />
      <AppearanceSelect locale={locale} />
    </div>
    <div className="dt-layout"><div className="dt-page-header">
      <h1 className="dt-page-title">{name}</h1>
      <p><a href={basePath + mount(locale) + '/'}>{locale.startsWith('zh') ? '阅读文档' : 'Read the documentation'}</a></p>
    </div></div>
  </main>;
}

export async function Documentation({ locale, slug = [] }) {
  const props = await docsFor(locale).load(slug);
  return <main>
    <DocsView {...props} theme={theme} Search={DocSearch} headerActions={<>
      <LanguageSwitch locale={locale} slug={slug} />
      {headerActions({ locale, page: props.page, basePath })}
    </>} />
  </main>;
}
