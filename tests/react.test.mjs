import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { builtinStyles } from '../packages/model/dist/index.js';

const example = new URL('../examples/vite-embed/', import.meta.url);
const fromExample = createRequire(new URL('package.json', example));
const { build } = await import(pathToFileURL(fromExample.resolve('vite')));

async function bundle(t, source) {
  const root = fileURLToPath(new URL('.varydocs/', example));
  await mkdir(root, { recursive: true });
  const probe = await mkdtemp(join(root, 'bundle-'));
  t.after(() => rm(probe, { recursive: true, force: true }));
  const entry = join(probe, 'entry.mjs');
  await writeFile(entry, source);
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      lib: { entry, formats: ['es'] },
      rollupOptions: { external: /^(react|react-dom)(\/|$)/u },
    },
  });
  const outputs = [result].flat().flatMap(result => result.output);
  const js = outputs.filter(output => output.type === 'chunk').map(output => output.code).join('\n');
  const css = outputs.filter(output => output.fileName.endsWith('.css')).map(output => output.source).join('\n');
  return { js, css };
}

test('a standalone Tabs import excludes search, the compiler and all theme styles', async t => {
  const { js, css } = await bundle(t, `
    export { Tabs, Tab } from '@varydocs/react/components/tabs';
    import '@varydocs/react/components/tabs.css';
  `);
  assert.match(js, /dt-tabs/u);
  assert.doesNotMatch(js, /dt-search|buildDocs|EditorialLayout|TerminalLayout/u);
  assert.match(css, /\.dt-tabs/u);
  assert.doesNotMatch(css, /\.dt-search|\.dt-shell/u);
});

test('each built-in theme bundles independently with its own layout stylesheet', async t => {
  const ids = builtinStyles.map(style => style.id);
  for (const id of ids) {
    const { js, css } = await bundle(t, `
      export { DocsView } from '@varydocs/react/view';
      export { ${id}Theme } from '@varydocs/react/themes/${id}';
      import '@varydocs/react/themes/${id}.css';
    `);
    assert(js.includes('dt-layout-' + id), id + ' renderer');
    assert(css.includes('.dt-layout-' + id), id + ' stylesheet');
    assert.doesNotMatch(js, /dt-search|buildDocs/u);
    assert.equal(css.includes('VaryDocs GTA Display'), id === 'gta6', id + ' bundled the GTA6 fonts');
    for (const other of ids.filter(theme => theme !== id)) {
      assert(!js.includes('dt-layout-' + other), id + ' imported ' + other);
      assert(!css.includes('.dt-layout-' + other), id + ' bundled CSS for ' + other);
    }
  }
});

test('the GTA6 header uses the host brand, localized routes, search and header actions', async () => {
  const { createElement } = fromExample('react');
  const { renderToStaticMarkup } = fromExample('react-dom/server');
  const { DocsView } = await import('../packages/react/dist/view.js');
  const { gta6Theme } = await import('../packages/react/dist/themes/gta6.js');
  const page = { id: 'index', slug: [], title: '欢迎', headings: [] };
  const guide = { id: '配置', slug: ['配置'], title: '配置指南', headings: [] };
  const manifest = { name: '夜港手册', locale: 'zh-CN', pages: [page, guide],
    navigation: [{ label: '入门', pages: ['index'] }, { label: '指南', pages: ['配置'] }] };
  const html = renderToStaticMarkup(createElement(DocsView, {
    manifest, page, theme: gta6Theme, mount: '/manual/zh-CN/docs', Body: () => '文档正文',
    Search: () => createElement('button', null, '搜索本站'), searchDocuments: [],
    headerActions: createElement('a', { href: '/manual/docs/' }, 'English'),
  }));
  const header = html.match(/<header\b[^>]*>([\s\S]*?)<\/header>/u)?.[1];
  assert(header, 'The theme must render a document header on the server');
  assert(header.includes('夜港手册') && header.includes('入门') && header.includes('指南'));
  assert(header.includes('href="/manual/zh-CN/docs/' + encodeURIComponent('配置') + '/"'));
  assert(header.includes('搜索本站') && header.includes('English'));
  assert.equal((html.match(/<h1\b/gu) ?? []).length, 1);
  assert(html.includes('id="doc-content"') && html.includes('文档正文'));
});

test('a custom theme can opt into a split sidebar without changing legacy headers', async () => {
  const { createElement } = fromExample('react');
  const { renderToStaticMarkup } = fromExample('react-dom/server');
  const { DocsView } = await import('../packages/react/dist/view.js');
  const { minimalTheme } = await import('../packages/react/dist/themes/minimal.js');
  const page = { id: 'index', slug: [], title: 'Start', headings: [] };
  const manifest = { name: 'Example', pages: [page], navigation: [{ label: 'Guide', pages: ['index'] }] };
  const Header = ({ brand, actions }) => createElement('header', { 'data-custom-header': '' }, brand, actions);
  const render = theme => renderToStaticMarkup(createElement(DocsView, {
    page, manifest, layout: 'sidebar', theme, Body: () => 'Documentation',
    Search: () => createElement('button', null, 'Find content'), searchDocuments: [],
    headerActions: createElement('a', { href: '/zh-CN/docs/' }, '简体中文'),
  }));
  const customHeader = html => html.match(/<header data-custom-header="">([\s\S]*?)<\/header>/u)?.[1];

  const legacy = render({ ...minimalTheme, Header });
  assert.match(customHeader(legacy), /Find content.*简体中文/u);
  assert.doesNotMatch(legacy, /dt-reader-sidebar-actions/u);

  const split = render({ ...minimalTheme, Header, SidebarHeader: Header });
  assert.match(customHeader(split), /Example.*Find content/u);
  assert.doesNotMatch(customHeader(split), /简体中文/u);
  assert.match(split, /dt-reader-sidebar-actions[^>]*>[\s\S]*?简体中文/u);
  assert.equal((split.match(/data-appearance=/gu) ?? []).length, 1);
});

test('desktop and mobile document navigation use the host link component', async () => {
  const { createElement } = fromExample('react');
  const { renderToStaticMarkup } = fromExample('react-dom/server');
  const { DocsView } = await import('../packages/react/dist/view.js');
  const { minimalTheme } = await import('../packages/react/dist/themes/minimal.js');
  const page = { id: 'index', slug: [], title: '简介', headings: [] };
  const guide = { id: '配置', slug: ['配置'], title: '配置指南', headings: [] };
  const manifest = { name: '示例', locale: 'zh-CN', pages: [page, guide],
    navigation: [{ label: '开始', pages: ['index', '配置'] }] };
  const mount = '/manual/zh-CN/docs';
  const Link = props => createElement('a', { ...props, 'data-host-link': '' });
  const html = renderToStaticMarkup(createElement(DocsView, {
    manifest, page, mount, Link, theme: minimalTheme, Body: () => '文档正文',
  }));
  const navs = Array.from(html.matchAll(/<nav\b[^>]*>[\s\S]*?<\/nav>/gu), match => match[0])
    .filter(nav => nav.includes('class="dt-nav-group"'));
  assert.equal(navs.length, 2);
  for (const nav of navs) {
    assert(nav.includes('href="' + mount + '/" aria-current="page" data-host-link=""'));
    assert(nav.includes('href="' + mount + '/' + encodeURIComponent(guide.id) + '/" data-host-link=""'));
  }
});
