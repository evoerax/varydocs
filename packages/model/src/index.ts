export interface NavigationGroup {
  label: string;
  pages: string[];
}

export interface Heading {
  id: string;
  level: number;
  title: string;
}

export interface DocPage {
  id: string;
  slug: string[];
  title: string;
  description?: string;
  sourcePath: string;
  headings: Heading[];
}

export const docLayouts = ['theme', 'topbar', 'sidebar'] as const;
export type DocLayout = (typeof docLayouts)[number];

export interface DocManifest {
  schemaVersion: 1;
  locale: string;
  dir: "ltr" | "rtl";
  name: string;
  style: string;
  layout?: DocLayout;
  pages: DocPage[];
  navigation: NavigationGroup[];
}

export interface Language {
  id: string;
  label: string;
  dir: 'ltr' | 'rtl';
}

export function localePrefix(locale: string, defaultLocale: string): string {
  return locale === defaultLocale ? '' : '/' + encodeURIComponent(locale);
}

export interface SearchDocument {
  id: string;
  anchor?: string;
  title: string;
  section?: string;
  text: string;
}

export const builtinStyles = [
  { id: 'minimal', name: 'Minimal', category: 'general', description: 'Clean navigation and generous reading space' },
  { id: 'editorial', name: 'Editorial', category: 'general', description: 'Serif type and a long-form reading layout' },
  { id: 'terminal', name: 'Terminal', category: 'general', description: 'Phosphor accents and compact monospace type' },
  { id: 'swiss', name: 'Swiss', category: 'general', description: 'Modular columns, a bold sans-serif hierarchy and vermilion accents' },
  { id: 'brutalism', name: 'Brutalism', category: 'general', description: 'Heavy rules and condensed typography on a yellow field' },
  { id: 'blueprint', name: 'Blueprint', category: 'general', description: 'Fine grid lines and technical drawings on drafting blue' },
  { id: 'gta6', name: 'GTA6', category: 'themed', description: 'Inked headlines, neon-pink navigation and a warm paper reading surface' },
  { id: 'desktop', name: 'Retro Desktop', category: 'themed', description: 'File browser navigation, a document finder and framed code windows' },
] as const;

export function pagePath(page: DocPage, mount = ''): string {
  const parts = page.slug.map(encodeURIComponent);
  return mount + '/' + (parts.length ? parts.join('/') + '/' : '');
}
