import { createDocsSeo } from '@varydocs/next/seo';
import { defaultLocale, locales } from '@/.varydocs/index.mjs';

export const seo = createDocsSeo({
  siteUrl: process.env.VARYDOCS_SITE_URL, basePath: process.env.VARYDOCS_BASE_PATH,
  defaultLocale, locales,
});
