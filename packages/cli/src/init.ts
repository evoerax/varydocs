import { spawn } from 'node:child_process';
import { copyFile, cp, lstat, mkdir, mkdtemp, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cancel, confirm, intro, isCancel, outro, select, text } from '@clack/prompts';
import { builtinStyles, docLayouts } from '@varydocs/core';
import type { DocLayout } from '@varydocs/core';
import type { CliLanguage, CliMessages } from './messages.js';

export const templates = [
  { id: 'starter', hint: 'starterHint' },
  { id: 'blank', hint: 'blankHint' },
] as const;

interface InitOptions {
  template?: (typeof templates)[number]['id'];
  style?: (typeof builtinStyles)[number]['id'];
  layout?: DocLayout;
  packageManager?: 'npm' | 'pnpm';
  assistant?: boolean;
  localPackages?: string;
  install?: boolean;
  language?: CliLanguage | 'bilingual';
  yes?: boolean;
}

const assets = fileURLToPath(new URL('../templates/', import.meta.url));
const defaultProjectName = 'my-varydocs';

class Cancelled extends Error {}
function selected<T>(value: T | symbol): T {
  if (isCancel(value)) throw new Cancelled();
  return value as T;
}

async function installDependencies(manager: string, cwd: string) {
  const child = process.platform === 'win32'
    ? spawn('cmd.exe', ['/d', '/s', '/c', manager, 'install'], { cwd, stdio: 'inherit' })
    : spawn(manager, ['install'], { cwd, stdio: 'inherit' });
  await new Promise<void>((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (exitCode, signal) => {
      if (exitCode === 0) resolve();
      else reject(new Error(manager + ' install failed (' + (signal ?? exitCode) + ').'));
    });
  });
}

async function copyLocalPackages(staging: string, directory: string, version: string, messages: CliMessages, assistant: boolean) {
  const destination = resolve(staging, 'vendor/varydocs');
  await mkdir(destination, { recursive: true });
  const references: Record<string, string> = {};
  const kinds = ['core', 'react', 'next', 'cli', 'model'];
  if (assistant) kinds.push('ai');
  for (const kind of kinds) {
    const filename = 'varydocs-' + kind + '-' + version + '.tgz';
    const source = resolve(directory, filename);
    const metadata = await stat(source).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
    });
    if (!metadata?.isFile()) {
      throw new Error(messages.localPackageMissing + ': ' + source);
    }
    await copyFile(source, resolve(destination, filename));
    references['@varydocs/' + kind] = 'file:./vendor/varydocs/' + filename;
  }
  const overrides = Object.entries(references).map(([name, reference]) => '  ' + JSON.stringify(name) + ': ' + JSON.stringify(reference));
  await writeFile(resolve(staging, 'pnpm-workspace.yaml'), 'overrides:\n' + overrides.join('\n') + '\n');
  return references;
}

async function generate(target: string, { template, style, layout, version, language, localPackages, assistant = false }: {
  template: NonNullable<InitOptions['template']>;
  style: NonNullable<InitOptions['style']>;
  layout?: DocLayout;
  version: string;
  language: NonNullable<InitOptions['language']>;
  localPackages?: string;
  assistant?: boolean;
}, messages: CliMessages) {
  let exists = false;
  try {
    const entries = await readdir(target);
    exists = true;
    if (entries.some(entry => entry !== '.git')) throw new Error(messages.emptyDirectory + ': ' + target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  await mkdir(dirname(target), { recursive: true });
  // Keeping staging on the destination filesystem makes each published entry an atomic rename.
  const staging = exists ? resolve(target, '.varydocs-init') : await mkdtemp(resolve(dirname(target), '.varydocs-init-'));
  if (exists) await mkdir(staging);
  try {
    if (exists && (await readdir(target)).some(entry => entry !== '.git' && entry !== '.varydocs-init')) {
      throw new Error(messages.emptyDirectory + ': ' + target);
    }
    const packageRefs = localPackages ? await copyLocalPackages(staging, localPackages, version, messages, assistant) : {};
    const folder = basename(target);
    const name = folder.toLowerCase().replace(/[^a-z0-9-]+/gu, '-').replace(/^-+|-+$/gu, '') || defaultProjectName;
    await cp(resolve(assets, 'base'), staging, { recursive: true });
    if (assistant) await cp(resolve(assets, 'assistant'), staging, { recursive: true });
    const pages = template === 'starter' ? ['index', 'components', 'configuration'] : ['index'];
    const languages = language === 'bilingual' ? ['en', 'zh-CN'] : [language];
    const localized = language !== 'en';
    const locales = await Promise.all(languages.map(async id => {
      const source = id === 'en' ? template : 'zh-' + template;
      const path = resolve(staging, 'content/docs', localized ? id : '');
      await cp(resolve(assets, source), path, { recursive: true });
      return { id, label: id === 'en' ? 'English' : '简体中文',
        navigation: [{ label: id === 'en' ? 'Documentation' : '文档', pages }] };
    }));
    if (language === 'bilingual') {
      await cp(resolve(assets, 'localized'), staging, { recursive: true });
      if (assistant) await cp(resolve(assets, 'assistant-localized'), staging, { recursive: true });
    }
    await rename(resolve(staging, 'gitignore.template'), resolve(staging, '.gitignore'));
    const manifest = {
      name, private: true, type: 'module',
      scripts: { dev: 'varydocs dev', check: 'varydocs check', build: 'varydocs build',
        ...(assistant ? { start: 'next start' } : {}) },
      dependencies: { '@varydocs/core': packageRefs['@varydocs/core'] ?? version,
        '@varydocs/next': packageRefs['@varydocs/next'] ?? version,
        '@varydocs/react': packageRefs['@varydocs/react'] ?? version,
        ...(assistant ? { '@varydocs/ai': packageRefs['@varydocs/ai'] ?? version, ai: '7.0.181' } : {}),
        ...(localPackages ? { '@varydocs/model': packageRefs['@varydocs/model'] } : {}),
        next: '16.4.6', react: '19.2.8', 'react-dom': '19.2.8' },
      devDependencies: { '@varydocs/cli': packageRefs['@varydocs/cli'] ?? version },
      ...(localPackages ? {
        overrides: Object.fromEntries(Object.keys(packageRefs).map(name => [name, '$' + name])),
      } : {}),
    };
    const config = {
      name: name.split('-').filter(Boolean).map(word => word[0].toUpperCase() + word.slice(1)).join(' '),
      style,
      layout,
      ...(localized ? { i18n: { defaultLocale: languages[0], locales } } : { navigation: locales[0].navigation }),
    };
    await writeFile(resolve(staging, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
    await writeFile(resolve(staging, 'varydocs.json'), JSON.stringify(config, null, 2) + '\n');
    if (localized && !assistant) {
      await copyFile(resolve(assets, 'site-readmes/README.zh-CN.md'), resolve(staging, 'README.zh-CN.md'));
    }

    if (exists) {
      const installed: string[] = [];
      try {
        for (const entry of await readdir(staging)) {
          const destination = resolve(target, entry);
          const owned = await lstat(destination).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOENT') throw error;
          });
          if (owned) throw new Error(messages.emptyDirectory + ': ' + target);
          await rename(resolve(staging, entry), destination);
          installed.push(entry);
        }
      } catch (error) {
        for (const entry of installed.reverse()) await rename(resolve(target, entry), resolve(staging, entry));
        throw error;
      }
    } else {
      await rename(staging, target);
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

export async function runInit(directory: string | undefined, options: InitOptions, version: string, uiLanguage: CliLanguage, messages: CliMessages) {
  const interactive = !options.yes && Boolean(process.stdin.isTTY && process.stdout.isTTY);
  if (interactive) intro(messages.open);
  try {
    const project = directory ?? (interactive ? selected(await text({
      message: messages.directory, initialValue: defaultProjectName,
      validate: value => !value?.trim() ? messages.missingDirectory : undefined,
    })) : defaultProjectName);
    const template = options.template ?? (interactive ? selected(await select({
      message: messages.template,
      options: templates.map(item => ({ value: item.id, label: messages[item.id], hint: messages[item.hint] })),
    })) : 'starter');
    const style = options.style ?? (interactive ? selected(await select({
      message: messages.style,
      options: builtinStyles.map(({ id, category }) => ({
        value: id,
        label: messages.styles[id] + '  [' + messages.styleCategories[category] + ']',
        hint: messages.styleHints[id],
      })),
    })) : 'minimal');
    const layout = options.layout ?? (interactive ? selected(await select({
      message: messages.layout,
      initialValue: 'theme',
      options: docLayouts.map(id => ({ value: id, label: messages.layouts[id], hint: messages.layoutHints[id] })),
    })) : undefined);
    const language = options.language ?? (interactive ? selected(await select({
      message: messages.language,
      initialValue: uiLanguage,
      options: [
        { value: 'en', label: 'English' },
        { value: 'zh-CN', label: '简体中文' },
        { value: 'bilingual', label: 'English + 简体中文' },
      ] as const satisfies { value: CliLanguage | 'bilingual'; label: string }[],
    })) : uiLanguage);
    const assistant = options.assistant ?? (interactive && selected(await confirm({
      message: messages.assistantPrompt, initialValue: false, active: messages.yes, inactive: messages.no,
    })));
    const manager = options.packageManager ?? (interactive ? selected(await select({
      message: messages.packageManager, options: [{ value: 'npm', label: 'npm' }, { value: 'pnpm', label: 'pnpm' }],
    })) : 'npm');
    const install = options.install ?? (interactive && selected(await confirm({
      message: messages.install, initialValue: true, active: messages.yes, inactive: messages.no,
    })));

    if (!project.trim()) throw new Error(messages.missingDirectory);
    const target = resolve(project.trim());
    await generate(target, { template, style, layout, version, language, localPackages: options.localPackages, assistant }, messages);
    console.log(messages.created + ' ' + target);
    if (install) await installDependencies(manager, target);
    const next = (install ? '' : manager + ' install' + messages.then) + manager + ' run dev';
    if (interactive) outro(messages.next + ' ' + next + '.');
    else console.log(messages.next + ' ' + next + '.');
  } catch (error) {
    if (error instanceof Cancelled) { cancel(messages.cancelled); return; }
    throw error;
  }
}
