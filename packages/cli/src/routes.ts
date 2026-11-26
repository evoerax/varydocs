import { constants } from 'node:fs';
import { access, copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cliMessages } from './messages.js';
import type { CliMessages } from './messages.js';

const templates = fileURLToPath(new URL('../templates/', import.meta.url));
const routeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.mdx'];

async function exists(file: string) {
  try { await access(file); return true; } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return false;
  }
}

// Respect a host that changed page.jsx to page.tsx or owns an existing metadata route.
async function hasRouteVariant(file: string) {
  const stem = file.slice(0, -extname(file).length);
  return (await Promise.all(routeExtensions.map(ext => exists(stem + ext)))).some(Boolean);
}

async function addFile(source: string, destination: string) {
  if (await hasRouteVariant(destination)) return;
  await mkdir(dirname(destination), { recursive: true });
  try { await copyFile(source, destination, constants.COPYFILE_EXCL); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
}

// Route groups do not contribute a URL segment. A sitemap inside one also owns /sitemap.xml.
async function hasCustomSitemap(app: string, starter: string): Promise<boolean> {
  const entries = await readdir(app, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(app, entry.name);
    if (path === starter) continue;
    if (entry.name === 'sitemap.xml' || /^sitemap\.(js|ts)$/u.test(entry.name)) return true;
    if (entry.isDirectory() && /^\(.+\)$/u.test(entry.name) && await hasCustomSitemap(path, starter)) return true;
  }
  return false;
}

async function prepareSitemap(root: string) {
  const app = join(root, 'app');
  const destination = join(app, 'sitemap.js');
  const source = join(templates, 'base/app/sitemap.js');
  if (!await exists(join(root, 'public/sitemap.xml')) && !await hasCustomSitemap(app, destination)) {
    await addFile(source, destination);
    return;
  }
  // A user may add a custom sitemap after scaffolding. Retire only the unchanged starter copy.
  if (await exists(destination) && (await readFile(destination)).equals(await readFile(source))) {
    await rm(destination, { force: true });
  }
}

// Fingerprints of the stock routes shipped before SEO and single-language aliases.
// Only byte-equivalent starter files are eligible for replacement.
const previous = {
  reader: 'e02dd148904f5287338bde04eb08ed7d4a20a437d60268ba966fcbc0f80ab24b',
  defaultHome: 'a90440950251402f82ae62e30f59efcb0cf73b8e2ce986272c4eb7af425cb12e',
  translatedHome: 'cbe9d9776b5b50be19564771caf5d8d20ceb71d27b4483d271c592d8b70cba7c',
  translatedLayout: '0dd2e7e5a469edae97b72abe8dc7b2e1b1e3d50391ba0e198e4ee8111eabbb4b',
  translatedSearch: '4327c943f542c6cafd3e0cea7fe560a6ed79529bfc307ca2cc6a5895423442a8',
};

async function updateOriginal(root: string, kind: 'base' | 'localized', relative: string, fingerprint: string) {
  const target = join(root, relative);
  if (!await exists(target)) return;
  const content = (await readFile(target, 'utf8')).replaceAll('\r\n', '\n');
  if (createHash('sha256').update(content).digest('hex') !== fingerprint) return;
  const temporary = target + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(temporary, await readFile(join(templates, kind, relative)), { flag: 'wx' });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function prepareAssistantLayouts(root: string, multilingual: boolean) {
  const actions = 'lib/header-actions.jsx';
  const assistant = join(templates, 'assistant');
  const header = join(root, actions);
  if (!await exists(header)) return;
  const current = (await readFile(header, 'utf8')).replaceAll('\r\n', '\n');
  const stock = (await readFile(join(assistant, actions), 'utf8')).replaceAll('\r\n', '\n');
  if (current !== stock) return;

  const adapter = 'lib/varydocs-assistant-layout.jsx';
  await addFile(join(assistant, adapter), join(root, adapter));
  const defaultLayout = 'app/(default)/docs/layout.jsx';
  await addFile(join(assistant, defaultLayout), join(root, defaultLayout));
  if (multilingual) {
    const localizedLayout = 'app/[locale]/docs/layout.jsx';
    await addFile(join(templates, 'assistant-localized', localizedLayout), join(root, localizedLayout));
  }
}

const scaffoldedLocaleRoutes = new Map([
  ['[locale]', 'page.jsx'],
  ['[locale]/docs/[[...slug]]', 'page.jsx'],
  ['[locale]/varydocs-search.json', 'route.js'],
]);

async function checkLocaleRoutes(root: string, messages: CliMessages) {
  const app = join(root, 'app');
  for (const entry of await readdir(app, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const extension = extname(entry.name);
    if (!routeExtensions.includes(extension)) continue;
    const name = entry.name.slice(0, -extension.length);
    if (!/^(?:page|route|sitemap)$/u.test(name)) continue;

    const folders = relative(app, entry.parentPath).split(sep).filter(Boolean);
    if (folders.some(folder => folder.startsWith('_') || folder.startsWith('.'))) continue;
    const segments = folders.filter(folder => !/^\(.+\)$/u.test(folder) && !folder.startsWith('@'));
    const [segment] = segments;
    if (!segment || !/^\[(?!\.\.\.)[^\[\]]+\]$/u.test(segment)) continue;

    if (segment !== '[locale]') {
      const conflict = join('app', ...folders.slice(0, folders.indexOf(segment) + 1));
      throw new Error(messages.conflictingLocaleParameter(conflict));
    }

    const route = segments.join('/');
    const templateFile = scaffoldedLocaleRoutes.get(route);
    if (!templateFile || name === 'sitemap' || folders.some(folder => folder.startsWith('@'))) continue;
    const templateStem = templateFile.slice(0, -extname(templateFile).length);
    const conflict = join('app', ...folders, entry.name);
    if (templateStem !== name) {
      const destination = 'app/' + route + '/' + templateFile;
      throw new Error(messages.conflictingLocaleEntry(conflict, destination));
    }
    // Route groups share URL paths. Parallel slots can legitimately reuse a route path.
    if (folders.length !== segments.length) {
      const destination = 'app/' + route + '/' + entry.name;
      throw new Error(messages.conflictingLocaleGroup(conflict, destination));
    }
  }
}

/** Complete a CLI starter on upgrade. Existing routes and custom layouts belong to the author. */
export async function prepareStarterRoutes(root: string, multilingual: boolean, {
  messages = cliMessages('en'), write = true,
}: { messages?: CliMessages; write?: boolean } = {}) {
  if (!await exists(join(root, 'lib/docs.jsx')) || !await hasRouteVariant(join(root, 'app/(default)/layout.jsx'))) return;
  if (multilingual) await checkLocaleRoutes(root, messages);
  if (!write) return;
  await addFile(join(templates, 'base/lib/varydocs-seo.js'), join(root, 'lib/varydocs-seo.js'));
  await addFile(join(templates, 'base/lib/site-languages.jsx'), join(root, 'lib/site-languages.jsx'));
  await updateOriginal(root, 'base', 'lib/docs.jsx', previous.reader);
  const docLayout = 'app/(default)/docs/[[...slug]]/layout.jsx';
  await addFile(join(templates, 'base', docLayout), join(root, docLayout));
  await prepareSitemap(root);
  await updateOriginal(root, 'base', 'app/(default)/page.jsx', previous.defaultHome);
  if (multilingual) {
    const localized = join(templates, 'localized');
    for (const file of await readdir(localized, { recursive: true, withFileTypes: true })) {
      if (file.isFile()) {
        const source = join(file.parentPath, file.name);
        await addFile(source, join(root, source.slice(localized.length + 1)));
      }
    }
  }
  await updateOriginal(root, 'localized', 'app/[locale]/page.jsx', previous.translatedHome);
  await updateOriginal(root, 'localized', 'app/[locale]/layout.jsx', previous.translatedLayout);
  await updateOriginal(root, 'localized', 'app/[locale]/varydocs-search.json/route.js', previous.translatedSearch);
  await prepareAssistantLayouts(root, multilingual);
}
