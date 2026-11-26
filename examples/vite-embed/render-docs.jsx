import React from 'react';
import { createRoot } from 'react-dom/client';
import { DocSearch } from '@varydocs/react/components/search';
import { DocsView } from '@varydocs/react/view';
import { localePrefix, pagePath } from '@varydocs/core/model';

function decodePart(part) {
  try { return decodeURIComponent(part); } catch { return part; }
}

export async function renderDocs({ theme, components, defaultLocale, languages, locales, searchUrls }) {
  const base = import.meta.env.BASE_URL.replace(/\/$/u, '');
  const segments = window.location.pathname.slice(base.length).split('/').filter(Boolean).map(decodePart);
  const locale = Object.hasOwn(locales, segments[0]) ? segments.shift() : defaultLocale;
  const { manifest, modules } = locales[locale];
  const page = manifest.pages.find(entry => entry.slug.join('/') === segments.join('/'));
  const mount = base + localePrefix(locale, defaultLocale);
  document.documentElement.lang = locale;
  document.documentElement.dir = manifest.dir;

  const root = createRoot(document.getElementById('root'));
  if (!page) {
    root.render(<main><h1>{locale === 'zh-CN' ? '页面不存在' : 'Document not found'}</h1>
      <a href={mount + '/'}>{locale === 'zh-CN' ? '返回文档' : 'Back to documentation'}</a></main>);
    return;
  }

  const { default: Body } = await modules[page.id]();
  document.title = page.title + ' · ' + manifest.name;
  const languageSwitch = <nav className="dt-header-languages" aria-label={locale === 'zh-CN' ? '语言' : 'Languages'}>
    {languages.filter(language => language.id !== locale).map(language => {
      const translated = locales[language.id].manifest.pages.find(entry => entry.id === page.id);
      const otherMount = base + localePrefix(language.id, defaultLocale);
      return <a key={language.id} lang={language.id} hrefLang={language.id}
        href={translated ? pagePath(translated, otherMount) : otherMount + '/'}>{language.label}</a>;
    })}
  </nav>;
  // The initial fragment can arrive before the asynchronously loaded page mounts.
  function scrollToFragment(main) {
    if (main && window.location.hash) {
      document.getElementById(decodePart(window.location.hash.slice(1)))?.scrollIntoView();
    }
  }
  root.render(<main ref={scrollToFragment}>
    <DocsView manifest={manifest} page={page} Body={Body} theme={theme} components={components}
      mount={mount} assetBase={base} Search={DocSearch} searchIndex={searchUrls[locale]}
      headerActions={languageSwitch} />
  </main>);
}
