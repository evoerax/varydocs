import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifySiteUpgrade } from './verify-site-upgrade.mjs';
import { verifyAssistantServer } from './verify-assistant-server.mjs';

const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--registry')) {
  throw new Error('Usage: node scripts/smoke-release.mjs [--registry]');
}
const repository = fileURLToPath(new URL('../', import.meta.url));
const kinds = ['model', 'core', 'react', 'next', 'cli'];
const packages = kinds.map(kind => JSON.parse(readFileSync(join(repository, 'packages', kind, 'package.json'), 'utf8')));
const [model, core, reactPackage, , cli] = packages;
assert(packages.every(pkg => pkg.version === cli.version), 'Expected one shared release version');

const temp = mkdtempSync(join(tmpdir(), 'varydocs-release-'));
const workspace = join(temp, 'workspace');
const generated = join(workspace, 'my-varydocs');
const driver = join(repository, 'scripts', 'drive-init.py');
const packs = join(repository, '.varydocs', 'packs');
const fromRegistry = args.includes('--registry');
const basePath = '/release-check';
const env = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: '1',
  AI_GATEWAY_API_KEY: '',
  VARYDOCS_AI_MODEL: '',
  npm_config_progress: 'false',
  VARYDOCS_BASE_PATH: basePath,
  ...(fromRegistry ? { npm_config_registry: 'https://registry.npmjs.org/' } : {}),
};

function run(command, args, cwd = temp, overrides = {}) {
  const result = spawnSync(command, args, { cwd, env: { ...env, ...overrides }, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(command + ' failed with status ' + (result.signal ?? result.status));
}

function packed(pkg) {
  return join(packs, pkg.name.replace(/^@/u, '').replace('/', '-') + '-' + pkg.version + '.tgz');
}

function text(path) {
  return readFileSync(join(generated, 'out', path), 'utf8');
}

function layoutIds(source) {
  return [...new Set(Array.from(source.matchAll(/\bdt-layout-([a-z0-9-]+)/gu), match => match[1]))].sort();
}

function assetDigest(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function verifyGta6Fonts(assets, style, where) {
  for (const name of ['barlow-condensed-latin-900-normal.woff2',
    'barlow-condensed-latin-900-italic.woff2', 'explora-latin-400-normal.woff2']) {
    const digest = assetDigest(join(generated, 'node_modules/@varydocs/react/styles/assets', name));
    assert.equal(assets.has(digest), style === 'gta6', style + ': ' + name + ' in ' + where);
  }
}

function verifyExampleArtExcluded(directory) {
  const files = readdirSync(directory, { recursive: true }).filter(path => path.endsWith('.webp'));
  const images = new Set(files.map(path => assetDigest(join(directory, path))));
  for (const name of ['gta6-sunset.webp', 'gta6-bay.webp']) {
    assert(!images.has(assetDigest(join(repository, 'examples/gta6/public/art', name))),
      name + ' from the example was bundled in ' + directory);
  }
}

function verifyLinkedStyles(html, style) {
  const links = (html.match(/<link\b[^>]*>/gu) ?? []).filter(tag => tag.includes('rel="stylesheet"'));
  assert(links.length > 0, 'No stylesheet linked by the exported page');
  const assets = new Set();
  const css = links.map(tag => {
    const href = /\bhref="([^"]+)"/u.exec(tag)?.[1];
    assert(href?.startsWith(basePath + '/'), 'Unexpected stylesheet URL: ' + href);
    const sheetUrl = new URL(href, 'http://localhost');
    const sheet = text(sheetUrl.pathname.slice(basePath.length));
    for (const [, , ref] of sheet.matchAll(/url\(\s*(["']?)([^)"']+?\.woff2)\1\s*\)/gu)) {
      const asset = new URL(ref, sheetUrl);
      assert.equal(asset.origin, sheetUrl.origin);
      assert(asset.pathname.startsWith(basePath + '/'), 'Asset URL escaped the deployment prefix: ' + asset.href);
      assets.add(assetDigest(join(generated, 'out', asset.pathname.slice(basePath.length))));
    }
    return sheet;
  }).join('\n');
  assert.deepEqual(layoutIds(css), [style], 'Theme layouts in the CSS referenced by the page');
  assert.doesNotMatch(css, /gta6-(?:sunset|bay)\.webp/u, 'The theme stylesheet referenced example content');
  verifyGta6Fonts(assets, style, 'linked stylesheets');
}

function verifyThemeAssets(style) {
  const scriptLayouts = new Set();
  const cssLayouts = new Set();
  const assets = new Set();
  const publicAssets = join(generated, 'out/_next/static');
  for (const directory of [join(generated, '.next/server'), publicAssets]) {
    for (const path of readdirSync(directory, { recursive: true })) {
      if (directory === publicAssets && path.endsWith('.woff2')) assets.add(assetDigest(join(directory, path)));
      const isStylesheet = directory === publicAssets && path.endsWith('.css');
      if (!isStylesheet && !path.endsWith('.js')) continue;
      const layouts = isStylesheet ? cssLayouts : scriptLayouts;
      for (const id of layoutIds(readFileSync(join(directory, path), 'utf8'))) layouts.add(id);
    }
  }
  assert.deepEqual([...scriptLayouts].sort(), [style], 'Theme layouts in server and browser JavaScript');
  assert.deepEqual([...cssLayouts].sort(), [style], 'Theme layouts across all exported stylesheets');
  verifyGta6Fonts(assets, style, 'exported assets');
  verifyExampleArtExcluded(join(generated, 'out'));
}

function verifyExport(style) {
  for (const [locale, prefix, anchor] of [['en', '', 'edit-navigation'], ['zh-CN', '/zh-CN', '编辑导航']]) {
    const html = text(prefix + '/docs/index.html');
    assert.doesNotMatch(html, /gta6-(?:sunset|bay)\.webp/u, 'A generated site referenced example artwork');
    assert(html.includes('lang="' + locale + '"'));
    assert(html.includes('href="' + basePath + (prefix ? '' : '/zh-CN') + '/docs/"'));
    assert(html.includes('data-doc-theme="' + style + '"'));
    assert(html.includes('dt-layout-' + style));
    const headers = html.match(/<header\b[^>]*>[\s\S]*?<\/header>/gu) ?? [];
    assert(headers.some(header => header.includes('class="dt-header-languages"')),
      'Language switch placement in ' + style);
    const calloutTag = style === 'editorial' ? 'blockquote' : 'aside';
    assert(html.includes('<' + calloutTag + ' class="dt-callout"'), 'Expected theme-specific Callout for ' + style);
    const target = basePath + prefix + '/docs/configuration/#';
    assert([anchor, encodeURIComponent(anchor)].some(id => html.includes('href="' + target + id + '"')));
    assert(text(prefix + '/docs/configuration/index.html').includes('id="' + anchor + '"'));
    assert(JSON.parse(text(prefix + '/varydocs-search.json')).some(entry => entry.anchor === anchor));
    verifyLinkedStyles(html, style);
  }
  verifyThemeAssets(style);
  assert.match(text('component-example/index.html'), /role="tablist".*Standalone component/su);
}

function verifyStandaloneTabs(install) {
  const app = join(temp, 'react-app');
  mkdirSync(app);
  const host = JSON.parse(readFileSync(join(generated, 'package.json'), 'utf8')).dependencies;
  writeFileSync(join(app, 'package.json'), JSON.stringify({
    name: 'standalone-tabs', private: true, type: 'module',
    dependencies: {
      react: host.react, 'react-dom': host['react-dom'],
      [reactPackage.name]: fromRegistry ? reactPackage.version : 'file:' + packed(reactPackage),
    },
    ...(fromRegistry ? {} : { overrides: { [model.name]: 'file:' + packed(model) } }),
  }));
  run('npm', install, app);
  const lock = JSON.parse(readFileSync(join(app, 'package-lock.json'), 'utf8'));
  const installed = Object.keys(lock.packages).map(path => path.split('node_modules/').at(-1));
  assert(installed.includes(model.name), 'Expected the shared model in the standalone React install');
  for (const name of [core.name, '@mdx-js/mdx', 'remark-gfm', '@varydocs/ai', '@ai-sdk/react', 'ai']) {
    assert(!installed.includes(name), 'Unexpected dependency in the standalone React install: ' + name);
  }
  run(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { createElement } from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { Tab, Tabs } from '@varydocs/react/components/tabs';
    const html = renderToStaticMarkup(createElement(Tabs, null, createElement(Tab, { title: 'npm' }, 'npm install')));
    assert(html.includes('role="tablist"') && html.includes('role="tabpanel"') && html.includes('npm install'));
  `], app);
  console.log('Verified standalone Tabs rendering and installation without the MDX compiler.');
}

try {
  mkdirSync(workspace);
  const init = ['--lang', 'zh-CN', 'init'];
  const install = ['install', '--no-audit', '--no-fund', '--ignore-scripts'];
  if (fromRegistry) {
    run('python3', [driver, 'npm', 'exec', '--yes', '--package=' + cli.name + '@' + cli.version,
      '--', 'varydocs', ...init], workspace);
  } else {
    const bootstrap = join(temp, 'bootstrap');
    mkdirSync(bootstrap);
    run('npm', [...install, packed(model), packed(core), packed(cli)], bootstrap);
    run('python3', [driver, process.execPath, join(bootstrap, 'node_modules', cli.name, cli.bin.varydocs),
      ...init, '--local-packages', packs], workspace);
  }

  const config = JSON.parse(readFileSync(join(generated, 'varydocs.json'), 'utf8'));
  verifyExampleArtExcluded(join(generated, 'node_modules', reactPackage.name));
  const staticLock = JSON.parse(readFileSync(join(generated, 'package-lock.json'), 'utf8'));
  assert(!Object.keys(staticLock.packages).some(path =>
    /(?:^|\/)node_modules\/(?:@varydocs\/ai|@ai-sdk\/react|ai)$/u.test(path)), 'The static starter installed the AI SDK');
  assert.equal(config.style, 'swiss');
  assert.deepEqual(config.i18n.locales.map(locale => locale.id), ['en', 'zh-CN']);
  assert.match(readFileSync(join(generated, 'README.zh-CN.md'), 'utf8'), /^# VaryDocs 文档站\n\n/u);
  for (const pkg of packages) {
    const installed = JSON.parse(readFileSync(join(generated, 'node_modules', pkg.name, 'package.json'), 'utf8'));
    assert.equal(installed.version, cli.version, pkg.name);
  }
  const componentRoute = join(generated, 'app', '(default)', 'component-example');
  mkdirSync(componentRoute);
  writeFileSync(join(componentRoute, 'page.jsx'), `
import { Tab, Tabs } from '@varydocs/react/components/tabs';
import '@varydocs/react/components/tabs.css';

export default function ComponentExample() {
  return <Tabs><Tab title="pnpm">Standalone component</Tab></Tabs>;
}
`);
  run('npm', ['run', 'check'], generated);
  run('npm', ['run', 'build'], generated);
  verifyExport('swiss');

  for (const style of ['gta6', 'desktop', 'editorial']) {
    run('npm', ['exec', '--', 'varydocs', 'add', 'style', style], generated);
    assert.deepEqual(JSON.parse(readFileSync(join(generated, 'varydocs.json'), 'utf8')), { ...config, style });
    run('npm', ['run', 'build'], generated);
    verifyExport(style);
  }
  console.log('Verified VaryDocs ' + cli.version + ' from ' + (fromRegistry ? 'npm' : 'local release tarballs') +
    ' in the same bilingual project with exclusive Swiss, GTA6, Retro Desktop and Editorial builds.');
  verifyStandaloneTabs(install);
  await verifySiteUpgrade({ site: join(workspace, 'upgrade-docs'), workspace, run,
    cli: join(generated, 'node_modules', cli.name, cli.bin.varydocs),
    initArgs: fromRegistry ? [] : ['--local-packages', packs] });

  const assistantSite = join(workspace, 'assistant-docs');
  run(process.execPath, [join(generated, 'node_modules', cli.name, cli.bin.varydocs),
    'init', assistantSite, '--assistant', '--template', 'starter', '--language', 'bilingual',
    '--yes', '--package-manager', 'npm', '--no-install', ...(fromRegistry ? [] : ['--local-packages', packs])], workspace);
  run('npm', install, assistantSite);
  const aiPackage = JSON.parse(readFileSync(join(assistantSite, 'node_modules/@varydocs/ai/package.json'), 'utf8'));
  assert.equal(aiPackage.version, cli.version, 'Generated assistant package version');
  run('npm', ['run', 'build'], assistantSite);
  verifyExampleArtExcluded(join(assistantSite, '.next/static'));
  await verifyAssistantServer(assistantSite, env);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
