import { docLayouts } from '@varydocs/model';
import { z } from 'zod';

const navigation = z.array(z.strictObject({
  label: z.string().trim().min(1),
  pages: z.array(z.string().min(1)).min(1),
}));

const localeId = z.string().refine(id => {
  try { return Intl.getCanonicalLocales(id)[0] === id; } catch { return false; }
}, 'Use a canonical language tag such as en or zh-CN.');

const language = z.strictObject({
  id: localeId,
  label: z.string().trim().min(1),
  name: z.string().trim().min(1).optional(),
  dir: z.enum(['ltr', 'rtl']).default('ltr'),
  navigation: navigation.optional(),
});

const i18n = z.strictObject({
  defaultLocale: localeId,
  locales: z.array(language).min(1),
}).superRefine(({ defaultLocale, locales }, context) => {
  const ids = new Set(locales.map(locale => locale.id));
  if (ids.size !== locales.length) context.addIssue({ code: 'custom', path: ['locales'], message: 'Language IDs must be unique.' });
  if (!ids.has(defaultLocale)) context.addIssue({ code: 'custom', path: ['defaultLocale'], message: 'The default language must also appear in locales.' });
});

export const siteConfig = z.strictObject({
  name: z.string().trim().min(1),
  contentDir: z.string().trim().min(1).default('content/docs'),
  style: z.string().trim().min(1).default('minimal'),
  layout: z.enum(docLayouts).optional(),
  navigation: navigation.default([]),
  i18n: i18n.optional(),
});

export type SiteConfig = z.output<typeof siteConfig>;
