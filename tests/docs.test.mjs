import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { buildDocs, siteConfig } from '../packages/core/dist/index.js';

async function fixture(t, files, overrides = {}) {
  const root = await mkdtemp(join(tmpdir(), 'varydocs-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'content/docs/guide'), { recursive: true });
  await writeFile(join(root, 'varydocs.json'), JSON.stringify({ name: 'Test Docs', ...overrides }));
  for (const [name, content] of Object.entries(files)) await writeFile(join(root, 'content/docs', name), content);
  return root;
}

const doc = (title, body) => '---\ntitle: ' + title + '\n---\n' + body + '\n';

test('both published React guides show a valid bilingual site configuration', async () => {
  for (const locale of ['en', 'zh-CN']) {
    const guide = await readFile(new URL('../packages/core/docs/' + locale + '/react.md', import.meta.url), 'utf8');
    const config = /\x60\x60\x60json\r?\n([\s\S]+?)\r?\n\x60\x60\x60/u.exec(guide)?.[1];
    assert(config, 'Missing bilingual configuration example in ' + locale);
    const { i18n } = siteConfig.parse(JSON.parse(config));
    assert.deepEqual(i18n.locales.map(language => language.id), ['en', 'zh-CN']);
  }
});

test('compilation keeps navigation, doc links, Unicode anchors and search sections in sync', async t => {
  const root = await fixture(t, {
    'index.mdx': doc('Home', '[Guide](./guide/index.md#创建文档)\n\n<Callout title="Note">Example</Callout>'),
    'guide/index.md': doc('Guide', '## 创建文档\n\n填写标题。\n\n## 创建文档\n\n另一段。'),
  }, { navigation: [{ label: 'Start', pages: ['index', 'guide'] }] });
  const manifest = await buildDocs(root);
  const guide = manifest.pages.find(page => page.id === 'guide');
  assert.deepEqual(guide.slug, ['guide']);
  assert.deepEqual(guide.headings.map(heading => heading.id), ['创建文档', '创建文档-1']);
  assert.deepEqual(manifest.navigation, [{ label: 'Start', pages: ['index', 'guide'] }]);

  const output = join(root, '.varydocs');
  const { search } = await import(pathToFileURL(join(output, 'search.mjs')));
  assert(search.some(entry => entry.anchor === '创建文档' && entry.text.includes('填写标题')));
  const { modules } = await import(pathToFileURL(join(output, 'index.mjs')));
  assert.deepEqual(Object.keys(modules).sort(), ['guide', 'index']);
  const content = await Promise.all((await readdir(output)).filter(name => name.startsWith('page-'))
    .map(name => readFile(join(output, name), 'utf8')));
  assert(content.some(program => program.includes('"data-varydocs-route": true') && program.includes('/guide/#')));
});

test('a bad edit leaves the previous published manifest available', async t => {
  const root = await fixture(t, { 'index.md': doc('Home', '## Valid') });
  await buildDocs(root);
  const output = join(root, '.varydocs/index.mjs');
  const before = await readFile(output, 'utf8');
  await writeFile(join(root, 'content/docs/index.md'), doc('Home', '[Broken](./missing.md)'));
  await assert.rejects(buildDocs(root), /Missing document linked from index\.md/u);
  assert.equal(await readFile(output, 'utf8'), before);
});

test('check mode spots duplicate routes and generates no output', async t => {
  const root = await fixture(t, {
    'index.md': doc('Home', 'Welcome'),
    'guide.md': doc('Guide', 'One guide'),
    'guide/index.md': doc('Another guide', 'Another guide'),
  });
  await assert.rejects(buildDocs(root, { write: false }), /map to \/guide\//u);
  assert(!(await readdir(root)).includes('.varydocs'));
});

test('check mode rejects executable MDX expressions', async t => {
  const root = await fixture(t, { 'index.mdx': doc('Home', '<Callout title={1 + 1}>Example</Callout>') });
  await assert.rejects(buildDocs(root, { write: false }), /literal attributes/u);
});

test('frontmatter accepts YAML and rejects alternate format engines', async t => {
  const root = await fixture(t, { 'index.md': '\uFEFF---yaml\ntitle: Home\n---\nWelcome.' });
  assert.equal((await buildDocs(root, { write: false })).pages[0].title, 'Home');
  await writeFile(join(root, 'content/docs/index.md'), '\uFEFF---javascript\n---\nWelcome.');
  await assert.rejects(buildDocs(root, { write: false }), /frontmatter must use YAML/u);
});

test('locales compile their own navigation, anchors, links and search index', async t => {
  const root = await fixture(t, {}, {
    i18n: { defaultLocale: 'en', locales: [
      { id: 'en', label: 'English', navigation: [{ label: 'Start', pages: ['index', 'guide'] }] },
      { id: 'zh-CN', label: '简体中文', navigation: [{ label: '入门', pages: ['index', 'guide'] }] },
    ] },
  });
  for (const [locale, name, heading] of [['en', 'Welcome', 'Install'], ['zh-CN', '欢迎', '安装']]) {
    const folder = join(root, 'content/docs', locale);
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, 'index.md'), doc(name, '## ' + heading));
    await writeFile(join(folder, 'guide.md'), doc('Guide', '[Home](./index.md#' + heading.toLowerCase() + ')'));
  }
  assert.equal((await buildDocs(root)).locale, 'en');
  const path = file => pathToFileURL(join(root, '.varydocs', file));
  const { defaultLocale, locales } = await import(path('index.mjs'));
  assert.equal(defaultLocale, 'en');
  assert.equal(locales['zh-CN'].manifest.pages.find(entry => entry.id === 'index').title, '欢迎');
  assert.equal(locales['zh-CN'].manifest.navigation[0].label, '入门');
  const { searchByLocale } = await import(path('search.mjs'));
  assert(searchByLocale['zh-CN'].some(entry => entry.anchor === '安装'));
  assert(!searchByLocale.en.some(entry => entry.anchor === '安装'));
});

test('nested MDX sections share rendered IDs, localized search entries and assistant citations', async t => {
  const root = await fixture(t, {}, { i18n: { defaultLocale: 'en', locales: [
    { id: 'en', label: 'English' }, { id: 'zh-CN', label: '简体中文' },
  ] } });
  const source = join(root, 'content/docs');
  await mkdir(join(source, 'en'));
  await mkdir(join(source, 'zh-CN'));
  await writeFile(join(source, 'en/index.md'), doc('Home', '## Install'));
  await writeFile(join(source, 'zh-CN/index.mdx'), doc('安装', [
    '## 准备', '准备说明。', '<Callout>', '### 安装**步骤**', '安装第一个包。',
    '### 安装步骤', '安装第二个包。', '</Callout>', '[重复标题](#安装步骤-1)',
    '<a href="./?from=links#安装步骤">返回安装步骤</a>',
    '<img src="/art/%E5%9B%BE.svg?v=2#logo" alt="示意图" />',
  ].join('\n\n')));
  await mkdir(join(root, 'public/art'), { recursive: true });
  await writeFile(join(root, 'public/art/图.svg'), '<svg/>');
  await buildDocs(root);
  const output = file => pathToFileURL(join(root, '.varydocs', file));
  const { defaultLocale, locales } = await import(output('index.mjs'));
  const { searchByLocale } = await import(output('search.mjs'));
  const { manifest, modules } = locales['zh-CN'];
  const [page] = manifest.pages;
  assert.deepEqual(page.headings.map(heading => heading.id), ['准备', '安装步骤', '安装步骤-1']);
  assert.deepEqual(manifest.navigation, [{ label: '页面', pages: ['index'] }]);
  const entries = searchByLocale['zh-CN'];
  assert.equal(entries.find(entry => entry.anchor === '安装步骤').text, '安装第一个包。');
  assert.match(entries.find(entry => entry.anchor === '安装步骤-1').text, /安装第二个包/u);
  assert.doesNotMatch(entries.find(entry => entry.anchor === '准备').text, /安装第一个包/u);

  // Generated MDX imports the host's React runtime, just like the CLI site.
  const fromHost = createRequire(new URL('../examples/vite-embed/package.json', import.meta.url));
  await mkdir(join(root, 'node_modules'));
  await symlink(dirname(fromHost.resolve('react/package.json')), join(root, 'node_modules/react'), 'dir');
  const { createElement } = fromHost('react');
  const { renderToStaticMarkup } = fromHost('react-dom/server');
  const { DocsView } = await import('../packages/react/dist/view.js');
  const { minimalTheme } = await import('../packages/react/dist/themes/minimal.js');
  const { default: Body } = await modules.index();
  const mount = '/team/zh-CN/docs';
  const html = renderToStaticMarkup(createElement(DocsView, { manifest, page, Body, mount, assetBase: '/team', theme: minimalTheme }));
  for (const heading of page.headings) {
    assert(html.includes('id="' + heading.id + '"'));
    assert(html.includes('href="#' + encodeURIComponent(heading.id) + '"'));
  }
  assert(html.includes('href="' + mount + '/?from=links#安装步骤"'));
  assert(html.includes('src="/team/art/%E5%9B%BE.svg?v=2#logo"'));

  const { createDocsChatHandler } = await import('../packages/ai/dist/server.js');
  const handler = createDocsChatHandler({ locales, defaultLocale, searchByLocale, basePath: '/team' });
  const result = await handler(new Request('http://docs.local/api/ask/', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locale: 'zh-CN', pageId: 'index', messages: [
      { role: 'user', parts: [{ type: 'text', text: '讲讲「安装步骤」' }] },
    ] }),
  }));
  assert.equal(result.status, 200);
  const parts = (await result.text()).split('\n').filter(line => line.startsWith('data: {')).map(line => JSON.parse(line.slice(6)));
  const citation = parts.find(part => part.type === 'source-url');
  assert.equal(citation.url, mount + '/#' + encodeURIComponent('安装步骤'));
});

test('directory links and public images are checked while host URLs remain available', async t => {
  const root = await fixture(t, { 'index.md': doc('Home', 'OK'), 'guide/index.md': doc('Guide', '## Setup') });
  const filename = join(root, 'content/docs/index.md');
  const check = () => buildDocs(root, { write: false });
  const body = ['[Guide](./guide/?view=full#setup)', '[Self](./)', '[Account](/account/preferences/)',
    '[External](https://other.example/missing/)', '![CDN](//cdn.example/missing.png)', '![Generated](/api/avatar?id=4)'];
  await writeFile(filename, doc('Home', body.join('\n\n')));
  await check();
  for (const [content, expected] of [
    ['[Typo](./does-not-exist/)', /index\.md: \.\/does-not-exist\//u],
    ['[Typo](guide/?q=1#missing)', /index\.md links to missing anchor #missing in guide\/index\.md/u],
    ['![Typo](/art/missing%20image.webp?q=1)', /index\.md: \/art\/missing%20image\.webp\?q=1/u],
  ]) {
    await writeFile(filename, doc('Home', content));
    await assert.rejects(check, expected);
  }
  await mkdir(join(root, 'public/art'), { recursive: true });
  const image = join(root, 'public/art/missing image.webp');
  const guide = join(root, 'content/docs/guide/index.md');
  await writeFile(image, 'image');
  await writeFile(filename, doc('Home', [...body, '![Setup](/art/missing%20image.webp?q=1)'].join('\n\n')));
  const cli = fileURLToPath(new URL('../packages/cli/bin/varydocs.js', import.meta.url));
  const cliCheck = () => spawnSync(process.execPath, [cli, 'check'], { cwd: root, encoding: 'utf8' });
  await rm(image);
  let result = cliCheck();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /index\.md: \/art\/missing%20image\.webp\?q=1/u);
  await writeFile(image, 'image');
  await rm(guide);
  result = cliCheck();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /index\.md: \.\/guide\/\?view=full#setup/u);
  await writeFile(guide, doc('Guide', '## Setup'));
  result = cliCheck();
  assert.equal(result.status, 0, result.stderr);
});
