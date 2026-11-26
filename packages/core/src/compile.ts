import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { compile } from '@mdx-js/mdx';
import matter from 'gray-matter';
import type { Root } from 'hast';
import remarkGfm from 'remark-gfm';
import type { Node, Parent } from 'unist';
import { z } from 'zod';
import { analyzePage } from './analyze.js';
import type { DocumentIndex } from './analyze.js';
import { siteConfig } from './config.js';
import { pagePath } from './model.js';
import type { DocManifest, DocPage, Language, SiteConfig } from './model.js';

interface SourcePage {
  page: DocPage;
  file: string;
  body: string;
}

const frontmatter = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
});

export async function readConfig(root: string): Promise<SiteConfig> {
  const filename = resolve(root, 'varydocs.json');
  try {
    return siteConfig.parse(JSON.parse(await readFile(filename, 'utf8')));
  } catch (error) {
    throw new Error('Cannot read ' + filename + ': ' + (error as Error).message);
  }
}

export function contentPath(root: string, config: SiteConfig): string {
  const target = resolve(root, config.contentDir);
  const within = relative(resolve(root), target);
  if (!within || within === '..' || within.startsWith('..' + sep) || isAbsolute(within)) {
    throw new Error('contentDir must be a subdirectory of the project.');
  }
  return target;
}

function pageSlug(file: string): string[] {
  const parts = file.replace(/\.mdx?$/u, '').split('/');
  if (parts.at(-1) === 'index') parts.pop();
  if (parts.some(part => !/^[\p{L}\p{N}][\p{L}\p{N}\p{M}_-]*$/u.test(part))) {
    throw new Error(file + ': use letters, numbers, dashes or underscores in document paths.');
  }
  return parts.map(part => part.normalize('NFC').toLowerCase());
}

async function readPages(directory: string): Promise<SourcePage[]> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  const files = entries.filter(entry => entry.isFile() && /\.mdx?$/u.test(entry.name))
    .map(entry => relative(directory, resolve(entry.parentPath, entry.name)).split(sep).join('/'))
    .filter(file => !file.split('/').some(part => part.startsWith('.')))
    .sort();
  const pages = await Promise.all(files.map(async sourcePath => {
    const file = resolve(directory, sourcePath);
    try {
      const source = await readFile(file, 'utf8');
      const language = /^\uFEFF?---(?!-)([^\r\n]*)/u.exec(source)?.[1]?.trim();
      if (language && language !== 'yaml' && language !== 'yml') {
        throw new Error('Document frontmatter must use YAML.');
      }
      const parsed = matter(source);
      const meta = frontmatter.parse(parsed.data);
      const slug = pageSlug(sourcePath);
      return { file, body: parsed.content, page: {
        id: slug.join('/') || 'index',
        slug, ...meta, sourcePath, headings: [],
      }};
    } catch (error) {
      throw new Error(sourcePath + ': ' + (error as Error).message);
    }
  }));
  const seen = new Map<string, string>();
  for (const { page } of pages) {
    const existing = seen.get(page.id);
    if (existing) throw new Error(page.sourcePath + ' and ' + existing + ' map to ' + pagePath(page));
    seen.set(page.id, page.sourcePath);
  }
  if (!seen.has('index') || !pages.some(({ page }) => page.slug.length === 0)) {
    throw new Error('Add index.md or index.mdx to the content directory.');
  }
  return pages;
}

function resolveNavigation(pages: DocPage[], config: SiteConfig, locale: string) {
  const ids = new Set(pages.map(page => page.id));
  const used = new Set<string>();
  for (const group of config.navigation) {
    for (const id of group.pages) {
      if (!ids.has(id)) throw new Error('Navigation references missing document "' + id + '".');
      if (used.has(id)) throw new Error('Navigation lists "' + id + '" more than once.');
      used.add(id);
    }
  }
  const rest = pages.filter(page => !used.has(page.id)).map(page => page.id);
  return rest.length ? [...config.navigation, { label: /^zh(?:-|$)/iu.test(locale) ? '页面' : 'Pages', pages: rest }] : config.navigation;
}

const executableMdx = new Set(['mdxjsEsm', 'mdxFlowExpression', 'mdxTextExpression',
  'mdxJsxExpressionAttribute', 'mdxJsxAttributeValueExpression']);

function checkComponentSyntax() {
  const check = (node: Node) => {
    if (executableMdx.has(node.type)) {
      const line = node.position?.start.line;
      throw new Error((line ? 'Line ' + line + ': ' : '') +
        'Use registered MDX components and literal attributes. Imports and JavaScript expressions are unsupported.');
    }
    const jsx = node as Node & { attributes?: Node[]; value?: Node | string };
    jsx.attributes?.forEach(check);
    if (jsx.value && typeof jsx.value === 'object') check(jsx.value);
    (node as Parent).children?.forEach(check);
  };
  return check;
}

async function atomicWrite(path: string, content: string) {
  try {
    if (await readFile(path, 'utf8') === content) return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const temporary = path + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(temporary, content, { flag: 'wx' });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function compileLanguage(directory: string, publicDir: string, config: SiteConfig, locale: Language) {
  const docs = await readPages(directory);
  const pages = docs.map(doc => doc.page);
  const index: DocumentIndex = {
    bySource: new Map(pages.map(page => [page.sourcePath, page])),
    bySlug: new Map(pages.map(page => [page.slug.join('/'), page])),
    anchors: new Map(pages.map(page => [page, new Set<string>()])),
    search: [],
    links: [],
  };
  const navigation = resolveNavigation(pages, config, locale.id);
  const programs = await Promise.all(docs.map(async ({ page, body, file }) => {
    function analyze() {
      return (tree: Root) => analyzePage(tree, page, publicDir, index);
    }
    try {
      const program = String(await compile({ path: file, value: body }, {
        format: file.endsWith('.mdx') ? 'mdx' : 'md',
        outputFormat: 'program',
        remarkPlugins: [remarkGfm, checkComponentSyntax],
        rehypePlugins: [analyze],
      }));
      const hash = createHash('sha256').update(program).digest('hex').slice(0, 24);
      return { id: page.id, filename: 'page-' + hash + '.mjs', program };
    } catch (error) {
      throw new Error(page.sourcePath + ': ' + (error as Error).message);
    }
  }));
  for (const { from, to, fragment } of index.links) {
    if (!index.anchors.get(to)!.has(fragment)) {
      throw new Error(from + ' links to missing anchor #' + fragment + ' in ' + to.sourcePath);
    }
  }
  const manifest: DocManifest = {
    schemaVersion: 1, locale: locale.id, dir: locale.dir, name: config.name, style: config.style,
    ...(config.layout ? { layout: config.layout } : {}),
    pages, navigation,
  };
  const { search } = index;
  search.sort((a, b) => (a.id + '#' + (a.anchor ?? '')).localeCompare(b.id + '#' + (b.anchor ?? ''), 'en'));
  return { manifest, programs, search };
}

export async function buildDocs(root = process.cwd(), options: { write?: boolean } = {}): Promise<DocManifest> {
  const config = await readConfig(root);
  const directory = contentPath(root, config);
  const defaultLocale = config.i18n?.defaultLocale ?? 'en';
  const entries = config.i18n?.locales ?? [{ id: 'en', label: 'English', dir: 'ltr' as const }];
  const languages: Language[] = entries.map(({ id, label, dir }) => ({ id, label, dir }));
  const compiled = await Promise.all(entries.map(async entry => {
    const variant = { ...config, name: 'name' in entry ? entry.name ?? config.name : config.name,
      navigation: 'navigation' in entry ? entry.navigation ?? config.navigation : config.navigation };
    try {
      return await compileLanguage(config.i18n ? resolve(directory, entry.id) : directory, resolve(root, 'public'), variant, entry);
    } catch (error) {
      if (!config.i18n) throw error;
      throw new Error('[' + entry.id + '] ' + (error as Error).message);
    }
  }));
  const primary = compiled.find(result => result.manifest.locale === defaultLocale)!;
  if (options.write === false) return primary.manifest;

  const output = resolve(root, '.varydocs');
  await mkdir(output, { recursive: true });
  const uniquePrograms = new Map(compiled.flatMap(({ programs }) => programs.map(data => [data.filename, data.program] as const)));
  await Promise.all([...uniquePrograms].map(([filename, program]) => atomicWrite(resolve(output, filename), program)));

  const states = compiled.map(({ manifest, programs }) => {
    const imports = programs.map(({ id, filename }) => '[' + JSON.stringify(id) + ']: () => import("./' + filename + '")');
    return '[' + JSON.stringify(manifest.locale) + ']: {manifest: ' + JSON.stringify(manifest) +
      ', modules: {\n' + imports.join(',\n') + '\n}}';
  });
  const searchByLocale = Object.fromEntries(compiled.map(({ manifest, search }) => [manifest.locale, search]));
  await atomicWrite(resolve(output, 'search.mjs'), 'export const searchByLocale = ' + JSON.stringify(searchByLocale) +
    ';\nexport const searchDefaultLocale = ' + JSON.stringify(defaultLocale) +
    ';\nexport const search = searchByLocale[searchDefaultLocale];\n');
  await atomicWrite(resolve(output, 'index.mjs'), 'export const defaultLocale = ' + JSON.stringify(defaultLocale) +
    ';\nexport const languages = ' + JSON.stringify(languages) + ';\nexport const locales = {\n' + states.join(',\n') +
    '\n};\nexport const { manifest, modules } = locales[defaultLocale];\n');
  return primary.manifest;
}
