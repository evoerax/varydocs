'use client';

import { useEffect } from 'react';

function preferredLocale(locales, key) {
  try {
    const saved = localStorage.getItem(key);
    if (locales.includes(saved)) return saved;
  } catch {
    // Keep explicit language links usable when a visitor cannot save a choice.
    return;
  }

  for (const tag of navigator.languages ?? [navigator.language]) {
    let candidate = tag.toLowerCase();
    while (candidate) {
      const exact = locales.find(locale => locale.toLowerCase() === candidate);
      if (exact) return exact;
      const regional = locales.find(locale => locale.toLowerCase().startsWith(candidate + '-'));
      if (regional) return regional;
      const separator = candidate.lastIndexOf('-');
      if (separator < 0) break;
      candidate = candidate.slice(0, separator);
    }
  }
}

export function SiteLanguages({ locale, links, basePath, siteEntry }) {
  const key = 'varydocs:language:' + (basePath || '/');
  useEffect(() => {
    if (!siteEntry || window.location.pathname.replace(/\/$/u, '') !== basePath) return;
    const preferred = preferredLocale([locale, ...links.map(link => link.id)], key);
    const target = links.find(link => link.id === preferred);
    if (target) window.location.replace(target.href + window.location.search + window.location.hash);
  }, [locale, links, basePath, siteEntry, key]);

  function remember(id) {
    try { localStorage.setItem(key, id); } catch { /* The link works without storage. */ }
  }

  return <nav className="dt-header-languages" aria-label={locale.startsWith('zh') ? '语言' : 'Languages'}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>
    </svg>
    {links.map(({ id, href, label, fallback }) =>
      <a key={id} href={href} hrefLang={id} lang={id} onClick={() => remember(id)}>{label}
        {fallback && <span lang={locale}>{locale.startsWith('zh') ? '（文档首页）' : ' (docs home)'}</span>}
      </a>)}
  </nav>;
}
