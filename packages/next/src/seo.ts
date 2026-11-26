import { localePrefix, pagePath } from '@varydocs/model';
import type { DocManifest } from '@varydocs/model';
import type { Metadata, MetadataRoute } from 'next';

interface SeoOptions {
  siteUrl?: string;
  basePath?: string;
  mount?: string;
  defaultLocale: string;
  locales: Record<string, { manifest: DocManifest }>;
}

/** Resolve canonical and translated URLs from the same manifests used by the reader. */
export function createDocsSeo({ siteUrl, basePath = '', mount = '/docs', defaultLocale, locales }: SeoOptions) {
  let origin: string | undefined;
  if (siteUrl) {
    const url = new URL(siteUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.username ||
        url.password || url.search || url.hash) {
      throw new Error('VARYDOCS_SITE_URL must be an HTTP(S) origin. Set VARYDOCS_BASE_PATH separately.');
    }
    origin = url.origin;
  }
  const languages = Object.keys(locales);
  const urls = new Map<string, Record<string, string>>();
  const homes: Record<string, string> = {};
  if (origin) {
    for (const locale of languages) {
      const prefix = origin + basePath + localePrefix(locale, defaultLocale);
      homes[locale] = prefix + '/';
      for (const page of locales[locale].manifest.pages) {
        const translations = urls.get(page.id) ?? {};
        translations[locale] = pagePath(page, prefix + mount);
        urls.set(page.id, translations);
      }
    }
  }
  return {
    metadata(locale: string, slug?: string[]): Metadata {
      const translations = slug ? urls.get(slug.join('/') || 'index') : homes;
      const canonical = translations?.[locale];
      return canonical ? { alternates: { canonical, languages: translations } } : {};
    },
    sitemap(): MetadataRoute.Sitemap {
      const result: MetadataRoute.Sitemap = [];
      for (const translations of [homes, ...urls.values()]) {
        for (const url of Object.values(translations)) {
          result.push({ url, alternates: { languages: translations } });
        }
      }
      return result;
    },
  };
}
