import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { prepareStarterRoutes } from '../packages/cli/dist/routes.js';
import { buildDocs } from '../packages/core/dist/index.js';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const cli = fileURLToPath(new URL('../packages/cli/bin/varydocs.js', import.meta.url));

test('init selects the requested template and style, and protects a populated directory', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'varydocs-cli-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const target = join(directory, 'help-center');
  await run(process.execPath, [cli, '--lang', 'en', 'init', target, '--template', 'blank', '--style', 'editorial', '--yes']);
  const path = join(target, 'varydocs.json');
  const config = JSON.parse(await readFile(path, 'utf8'));
  const manifest = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
  assert.equal(manifest.overrides, undefined);
  assert.equal(manifest.dependencies['@varydocs/ai'], undefined);
  assert.equal(manifest.dependencies.ai, undefined);
  assert.match(await readFile(join(target, 'next.config.mjs'), 'utf8'), /output: 'export'/u);
  await assert.rejects(stat(join(target, 'app/api/ask/route.js')), { code: 'ENOENT' });
  await assert.rejects(stat(join(target, 'app/(default)/docs/layout.jsx')), { code: 'ENOENT' });
  assert.equal(config.name, 'Help Center');
  assert.equal(config.style, 'editorial');
  assert.equal(Object.hasOwn(config, 'layout'), false);
  assert.equal(Object.hasOwn(await buildDocs(target, { write: false }), 'layout'), false);
  assert.deepEqual(config.navigation[0].pages, ['index']);
  assert.match(await readFile(join(target, '.gitignore'), 'utf8'), /\.varydocs/u);

  const checked = await run(process.execPath, [cli, '--lang', 'en', 'check'], { cwd: target });
  assert.match(checked.stdout, /Checked 1 pages/u);
  await assert.rejects(run(process.execPath, [cli, '--lang', 'en', 'init', target, '--yes']), /Choose an empty project directory/u);
  assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), config);
});

test('a bilingual starter carries its navigation layout into both compiled locales', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'varydocs-bilingual-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const target = join(directory, 'help-center');
  const { stdout } = await run(process.execPath, [cli, '--lang', 'zh-CN', 'init', target,
    '--template', 'starter', '--style', 'desktop', '--layout', 'sidebar', '--language', 'bilingual', '--yes']);
  assert.match(stdout, /已创建/u);
  const config = JSON.parse(await readFile(join(target, 'varydocs.json'), 'utf8'));
  assert.equal(config.style, 'desktop');
  assert.equal(config.layout, 'sidebar');
  assert.equal(config.i18n.defaultLocale, 'en');
  assert.deepEqual(config.i18n.locales.map(locale => locale.id), ['en', 'zh-CN']);
  assert.match(await readFile(join(target, 'content/docs/zh-CN/index.mdx'), 'utf8'), /开始使用/u);
  assert.match(await readFile(join(target, 'app/[locale]/varydocs-search.json/route.js'), 'utf8'), /searchByLocale/u);
  await run(process.execPath, [cli, 'check'], { cwd: target });
  await buildDocs(target);
  const { locales } = await import(pathToFileURL(join(target, '.varydocs/index.mjs')));
  for (const locale of ['en', 'zh-CN']) {
    assert.equal(locales[locale].manifest.style, 'desktop');
    assert.equal(locales[locale].manifest.layout, 'sidebar');
  }
  await writeFile(join(target, 'varydocs.json'), JSON.stringify({ ...config, layout: 'stacked' }));
  await assert.rejects(run(process.execPath, [cli, 'check'], { cwd: target }), /layout/u);
  await assert.rejects(run(process.execPath, [cli, 'init', join(directory, 'invalid'), '--layout', 'stacked', '--yes']),
    /Allowed choices are theme, topbar, sidebar/u);
});

test('init --assistant adds its server route, header action, and shared bilingual layouts', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'varydocs-assistant-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const target = join(directory, 'guide');
  await run(process.execPath, [cli, 'init', target, '--assistant', '--style', 'swiss', '--language', 'bilingual', '--yes']);
  const manifest = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
  assert.equal(manifest.dependencies['@varydocs/ai'], manifest.dependencies['@varydocs/react']);
  assert(manifest.dependencies.ai);
  assert.equal(manifest.scripts.start, 'next start');
  assert.doesNotMatch(await readFile(join(target, 'next.config.mjs'), 'utf8'), /output: 'export'/u);
  assert.match(await readFile(join(target, 'app/api/ask/route.js'), 'utf8'), /createDocsChatHandler/u);
  assert.match(await readFile(join(target, 'lib/header-actions.jsx'), 'utf8'), /<AskAI/u);
  assert.match(await readFile(join(target, 'lib/varydocs-assistant-layout.jsx'), 'utf8'), /<AssistantLayout navigate=/u);
  for (const group of ['(default)', '[locale]']) {
    assert.match(await readFile(join(target, 'app', group, 'docs/layout.jsx'), 'utf8'), /<DocsAssistantLayout basePath=/u);
  }
  for (const readme of ['README.md', 'README.zh-CN.md']) {
    assert.match(await readFile(join(target, readme), 'utf8'), /AI_GATEWAY_API_KEY/u);
  }
});

test('local init copies reproducible package references and reports missing bundles before creating the site', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'varydocs-local-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const target = join(directory, 'help center');
  const bundles = join(directory, 'package bundles');
  await mkdir(bundles);
  const { version } = JSON.parse(await readFile(new URL('../packages/cli/package.json', import.meta.url), 'utf8'));
  const args = [cli, '--lang', 'en', 'init', target, '--template', 'blank', '--local-packages', bundles, '--yes'];

  await assert.rejects(run(process.execPath, args), /Missing local package/u);
  await assert.rejects(stat(target), { code: 'ENOENT' });

  const kinds = ['core', 'react', 'next', 'cli', 'model'];
  for (const kind of kinds) {
    await writeFile(join(bundles, 'varydocs-' + kind + '-' + version + '.tgz'), kind);
  }
  await run(process.execPath, args);
  const manifest = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
  const coreBundle = 'vendor/varydocs/varydocs-core-' + version + '.tgz';
  assert.equal(manifest.dependencies['@varydocs/core'], 'file:./' + coreBundle);
  assert.equal(manifest.dependencies['@varydocs/model'], 'file:./vendor/varydocs/varydocs-model-' + version + '.tgz');
  assert.deepEqual(manifest.overrides, Object.fromEntries(kinds.map(kind => ['@varydocs/' + kind, '$@varydocs/' + kind])));
  assert.equal(await readFile(join(target, coreBundle), 'utf8'), 'core');
  assert((await readFile(join(target, 'pnpm-workspace.yaml'), 'utf8')).includes('file:./' + coreBundle));

  const withAI = join(directory, 'ask');
  const assistantArgs = [cli, '--lang', 'en', 'init', withAI, '--assistant', '--local-packages', bundles, '--yes'];
  await assert.rejects(run(process.execPath, assistantArgs), /Missing local package.*varydocs-ai-/u);
  await assert.rejects(stat(withAI), { code: 'ENOENT' });
  const aiBundle = 'varydocs-ai-' + version + '.tgz';
  await writeFile(join(bundles, aiBundle), 'assistant package');
  await run(process.execPath, assistantArgs);
  const project = JSON.parse(await readFile(join(withAI, 'package.json'), 'utf8'));
  assert.equal(project.dependencies['@varydocs/ai'], 'file:./vendor/varydocs/' + aiBundle);
  assert.equal(project.overrides['@varydocs/ai'], '$@varydocs/ai');
  assert((await readFile(join(withAI, 'pnpm-workspace.yaml'), 'utf8')).includes(aiBundle));
  await assert.rejects(stat(join(withAI, 'app/[locale]/docs/layout.jsx')), { code: 'ENOENT' });
});

test('add style switches a local project, preserving configuration and rejecting unknown styles', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'varydocs-switch-style-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const target = join(directory, 'guide');
  await run(process.execPath, [cli, 'init', target, '--style', 'swiss', '--layout', 'topbar', '--yes']);
  const path = join(target, 'varydocs.json');
  const original = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(original.style, 'swiss');
  assert.equal(original.layout, 'topbar');
  for (const style of ['brutalism', 'gta6', 'desktop', 'blueprint', 'blueprint']) {
    await run(process.execPath, [cli, 'add', 'style', style], { cwd: target });
    assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), { ...original, style });
  }
  const before = await readFile(path, 'utf8');
  await assert.rejects(run(process.execPath, [cli, 'add', 'style', 'unknown'], { cwd: target }));
  assert.equal(await readFile(path, 'utf8'), before);

  const custom = '{\r\n\t"name" : "Guide",\r\n\t"futureSetting" : {"style":"preserve"},\r\n\t"i18n" : {"defaultLocale":"en", "locales":[{"id":"en","label":"English"}]}\r\n}';
  await writeFile(path, custom);
  await run(process.execPath, [cli, 'add', 'style', 'swiss'], { cwd: target });
  const withStyle = custom.replace('\r\n}', ',\r\n\t"style" : "swiss"\r\n}');
  assert.equal(await readFile(path, 'utf8'), withStyle);
  await run(process.execPath, [cli, 'add', 'style', 'blueprint'], { cwd: target });
  assert.equal(await readFile(path, 'utf8'), withStyle.replace('"swiss"', '"blueprint"'));

  await writeFile(path, '{"style":');
  await assert.rejects(run(process.execPath, [cli, 'add', 'style', 'swiss'], { cwd: target }));
  assert.equal(await readFile(path, 'utf8'), '{"style":');
});


test('starter upgrades keep authored routes and avoid a second sitemap URL', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'varydocs-route-upgrade-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const empty = await mkdtemp(join(tmpdir(), 'varydocs-empty-'));
  t.after(() => rm(empty, { recursive: true, force: true }));
  await run(process.execPath, [cli, 'init', empty, '--yes']);
  assert((await stat(join(empty, 'varydocs.json'))).isFile());
  await mkdir(join(directory, '.git'));
  await writeFile(join(directory, '.git/HEAD'), 'ref: refs/heads/main\n');
  await run(process.execPath, [cli, 'init', directory, '--yes']);
  assert.equal(await readFile(join(directory, '.git/HEAD'), 'utf8'), 'ref: refs/heads/main\n');
  const sitemap = join(directory, 'app/sitemap.js');
  const defaultHome = join(directory, 'app/(default)/page.jsx');
  const customHome = 'export default function Home() { return null; }';
  await writeFile(defaultHome, customHome);
  const group = join(directory, 'app/(site)/(marketing)');
  await mkdir(group, { recursive: true });
  const customMap = join(group, 'sitemap.ts');
  await writeFile(customMap, 'export default function sitemap() { return []; }');
  await prepareStarterRoutes(directory, true);
  await prepareStarterRoutes(directory, true);
  await assert.rejects(stat(join(directory, 'lib/varydocs-assistant-layout.jsx')), { code: 'ENOENT' });
  await assert.rejects(stat(sitemap), { code: 'ENOENT' });
  assert.equal(await readFile(customMap, 'utf8'), 'export default function sitemap() { return []; }');
  assert.equal(await readFile(defaultHome, 'utf8'), customHome);
  await rm(customMap);
  await prepareStarterRoutes(directory, true);
  assert.match(await readFile(sitemap, 'utf8'), /seo.sitemap/u);
  await mkdir(join(directory, 'public'), { recursive: true });
  const publicMap = join(directory, 'public/sitemap.xml');
  await writeFile(publicMap, '<urlset/>');
  await prepareStarterRoutes(directory, true);
  await assert.rejects(stat(sitemap), { code: 'ENOENT' });
  assert.equal(await readFile(publicMap, 'utf8'), '<urlset/>');
});

test('multilingual upgrade reports conflicting dynamic routes before changing the starter', async t => {
  for (const dynamicBranch of ['[lang]', join('(marketing)', '[region]')]) {
    const directory = await mkdtemp(join(tmpdir(), 'varydocs-locale-route-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    await run(process.execPath, [cli, 'init', directory, '--language', 'en', '--yes']);
    const customBranch = join('app', dynamicBranch);
    const customPage = join(directory, customBranch, 'blog', 'page.tsx');
    const customContent = 'export default function Blog() { return null; }\n';
    await mkdir(dirname(customPage), { recursive: true });
    await writeFile(customPage, customContent);
    const seo = join(directory, 'lib/varydocs-seo.js');
    await rm(seo);

    await assert.rejects(prepareStarterRoutes(directory, true), error =>
      error.message.includes(customBranch) && error.message.includes('app/[locale]'));
    await assert.rejects(stat(seo), { code: 'ENOENT' });
    await assert.rejects(stat(join(directory, 'app/[locale]')), { code: 'ENOENT' });
    assert.equal(await readFile(customPage, 'utf8'), customContent);

    await rm(customPage);
    await prepareStarterRoutes(directory, true);
    assert((await stat(join(directory, 'app/[locale]/page.jsx'))).isFile());
  }
});

test('multilingual upgrade detects duplicate localized URLs and accepts unique route groups', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'varydocs-grouped-locale-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await run(process.execPath, [cli, 'init', directory, '--language', 'en', '--yes']);
  const authorBlog = join(directory, 'app/(marketing)/[locale]/blog/page.tsx');
  const customContent = 'export default function Blog() { return null; }\n';
  await mkdir(dirname(authorBlog), { recursive: true });
  await writeFile(authorBlog, customContent);
  const seo = join(directory, 'lib/varydocs-seo.js');
  await rm(seo);

  for (const [route, destination] of [
    ['app/(marketing)/[locale]/page.tsx', 'app/[locale]/page.tsx'],
    ['app/(marketing)/[locale]/docs/(guide)/[[...slug]]/page.jsx', 'app/[locale]/docs/[[...slug]]/page.jsx'],
    ['app/[locale]/(lookup)/varydocs-search.json/route.ts', 'app/[locale]/varydocs-search.json/route.ts'],
    ['app/[locale]/route.ts', 'app/[locale]/page.jsx'],
  ]) {
    const conflict = join(directory, route);
    await mkdir(dirname(conflict), { recursive: true });
    await writeFile(conflict, customContent);
    await assert.rejects(prepareStarterRoutes(directory, true), error =>
      error.message.includes(join(route)) && error.message.includes(destination));
    await assert.rejects(stat(seo), { code: 'ENOENT' });
    assert.equal(await readFile(conflict, 'utf8'), customContent);
    await rm(conflict);
  }

  await prepareStarterRoutes(directory, true);
  assert((await stat(join(directory, 'app/[locale]/page.jsx'))).isFile());
  assert.equal(await readFile(authorBlog, 'utf8'), customContent);
});

test('check reports localized route conflicts in Chinese without generating files', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'varydocs-check-locale-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await run(process.execPath, [cli, 'init', directory, '--template', 'blank', '--language', 'bilingual', '--yes']);
  const localized = join(directory, 'app/[locale]');
  const seo = join(directory, 'lib/varydocs-seo.js');
  await rm(localized, { recursive: true });
  await rm(seo);

  const check = () => run(process.execPath, [cli, '--lang', 'zh-CN', 'check'], { cwd: directory });
  for (const [route, reportedPath, guidance] of [
    ['app/[lang]/blog/page.jsx', 'app/[lang]', /请将该目录改名为 \[locale\]，并更新代码里的 params 引用/u],
    ['app/(marketing)/[locale]/page.jsx', 'app/(marketing)/[locale]/page.jsx', /请先将自定义路由移到 app\/\[locale\]\/page\.jsx/u],
    ['app/[locale]/route.ts', 'app/[locale]/route.ts', /请先为自定义路由换一个 URL/u],
  ]) {
    const conflict = join(directory, route);
    await mkdir(dirname(conflict), { recursive: true });
    await writeFile(conflict, 'export {}');
    await assert.rejects(check(), error =>
      error.code === 1 && error.stderr.includes(join(reportedPath)) && guidance.test(error.stderr));
    await rm(conflict);
  }

  const { stdout } = await check();
  assert.match(stdout, /已检查 1 个页面/u);
  await assert.rejects(stat(join(directory, '.varydocs')), { code: 'ENOENT' });
  await assert.rejects(stat(join(localized, 'page.jsx')), { code: 'ENOENT' });
  await assert.rejects(stat(seo), { code: 'ENOENT' });
});

test('dev recompiles after a missing public image is added', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'varydocs-public-watch-'));
  const doc = join(directory, 'content/docs/index.md');
  const next = join(directory, 'node_modules/next/dist/bin/next.js');
  await mkdir(dirname(doc), { recursive: true });
  await mkdir(dirname(next), { recursive: true });
  await writeFile(join(directory, 'package.json'), '{}');
  await writeFile(join(directory, 'varydocs.json'), '{"name":"Image watch"}');
  await writeFile(doc, '---\ntitle: Before image\n---\n');
  await writeFile(next, "console.log('Fixture ready'); setTimeout(() => {}, 10000);\n");

  const dev = spawn(process.execPath, [cli, '--lang', 'en', 'dev'], { cwd: directory, stdio: ['ignore', 'pipe', 'pipe'] });
  const closed = once(dev, 'close');
  t.after(async () => {
    dev.kill();
    await closed;
    await rm(directory, { recursive: true, force: true });
  });
  let output = '';
  for (const stream of [dev.stdout, dev.stderr]) {
    stream.setEncoding('utf8').on('data', chunk => { output += chunk; });
  }
  async function waitForOutput(pattern) {
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline && dev.exitCode === null && !pattern.test(output)) await delay(25);
    assert.match(output, pattern);
  }

  await waitForOutput(/Fixture ready/u);
  await writeFile(doc, '---\ntitle: With image\n---\n\n![Diagram](/images/diagram.svg)\n');
  await waitForOutput(/Missing public image.*\/images\/diagram\.svg/u);
  const compiled = join(directory, '.varydocs/index.mjs');
  assert.match(await readFile(compiled, 'utf8'), /Before image/u);

  await mkdir(join(directory, 'public/images'), { recursive: true });
  await writeFile(join(directory, 'public/images/diagram.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  await waitForOutput(/Updated 1 pages/u);
  assert.match(await readFile(compiled, 'utf8'), /With image/u);
});

test('assistant starter upgrades add shared layouts and honor an authored parent layout', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'varydocs-assistant-upgrade-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await run(process.execPath, [cli, 'init', directory, '--assistant', '--language', 'en', '--yes']);
  const adapter = join(directory, 'lib/varydocs-assistant-layout.jsx');
  const defaultLayout = join(directory, 'app/(default)/docs/layout.jsx');
  await rm(adapter);
  await rm(defaultLayout);
  await prepareStarterRoutes(directory, false);
  assert.match(await readFile(defaultLayout, 'utf8'), /<DocsAssistantLayout basePath=/u);
  assert.match(await readFile(adapter, 'utf8'), /<AssistantLayout navigate=/u);
  await rm(defaultLayout);
  const customLayout = join(directory, 'app/(default)/docs/layout.tsx');
  const layoutContent = 'export default function Layout() { return null; }\n';
  await writeFile(customLayout, layoutContent);

  await prepareStarterRoutes(directory, true);
  await prepareStarterRoutes(directory, true);
  await assert.rejects(stat(defaultLayout), { code: 'ENOENT' });
  assert.equal(await readFile(customLayout, 'utf8'), layoutContent);
  assert.match(await readFile(join(directory, 'app/[locale]/docs/layout.jsx'), 'utf8'), /<DocsAssistantLayout basePath=/u);
});
