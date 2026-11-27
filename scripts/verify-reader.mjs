import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { buildDocs } from '../packages/core/dist/index.js';
import { builtinStyles } from '../packages/model/dist/index.js';

const repo = fileURLToPath(new URL('../', import.meta.url));
const example = join(repo, 'examples/vite-embed');
const require = createRequire(import.meta.url);
const fromExample = createRequire(join(example, 'package.json'));
const { build, preview } = await import(pathToFileURL(fromExample.resolve('vite')));
const artifacts = join(repo, '.varydocs/reader-qa');
const generated = join(example, '.varydocs');
await mkdir(generated, { recursive: true });
await mkdir(artifacts, { recursive: true });
const root = await mkdtemp(join(generated, 'reader-'));
let server;
let browser;

async function checkAccessibility(page, state) {
  const violations = await page.evaluate(async () => {
    const { violations } = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });
    return violations.map(issue => ({ id: issue.id, targets: issue.nodes.map(node => node.target) }));
  });
  assert.deepEqual(violations, [], state + ': ' + JSON.stringify(violations));
}

async function checkAppearance(page, theme) {
  const mode = page.getByRole('button', { name: '外观', exact: true });
  const menu = page.getByRole('menu', { name: '外观', exact: true });
  const shell = page.locator('.dt-shell');
  const background = () => shell.evaluate(el => getComputedStyle(el).backgroundColor);
  const choose = async name => {
    await mode.click();
    await menu.getByRole('menuitemradio', { name, exact: true }).click();
    await menu.waitFor({ state: 'hidden' });
  };
  assert.equal(await mode.textContent(), '');
  assert.equal(await mode.getAttribute('data-appearance'), 'system');
  assert.equal(await menu.count(), 0);
  await mode.press('Enter');
  await menu.waitFor();
  assert.equal(await menu.getByRole('menuitemradio').count(), 3);
  assert.equal(await menu.getByRole('menuitemradio', { name: '跟随系统' }).getAttribute('aria-checked'), 'true');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.locator(':focus').getAttribute('data-appearance-option'), 'light');
  await page.keyboard.press('End');
  assert.equal(await page.locator(':focus').getAttribute('data-appearance-option'), 'dark');
  await page.keyboard.press('Escape');
  await menu.waitFor({ state: 'hidden' });
  assert.equal(await page.locator(':focus').getAttribute('data-appearance'), 'system');

  const light = await background();
  await page.emulateMedia({ colorScheme: 'dark' });
  const dark = await background();
  assert.notEqual(dark, light, theme + ' should change with the system');
  await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  await checkAccessibility(page, theme + ' system dark');
  if (theme === 'minimal' || theme === 'brutalism') {
    await mode.click();
    await menu.waitFor();
    await checkAccessibility(page, theme + ' appearance menu');
    await page.locator('.dt-page-title').click();
    await menu.waitFor({ state: 'hidden' });
  }

  await choose('浅色');
  assert.equal(await background(), light);
  await page.reload();
  await page.waitForSelector('[data-vd-appearance="light"]');
  assert.equal(await mode.getAttribute('data-appearance'), 'light');
  assert.equal(await background(), light);

  await choose('深色');
  await page.emulateMedia({ colorScheme: 'light' });
  assert.equal(await background(), dark);
  if (theme === 'gta6' || theme === 'desktop') {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: join(artifacts, theme + '-dark.png') });
  }

  await choose('跟随系统');
  assert.equal(await background(), light);
  await page.emulateMedia({ colorScheme: 'dark' });
  assert.equal(await background(), dark);
  assert.equal(await shell.getAttribute('data-vd-appearance'), null);
  if (theme === 'gta6') {
    await page.evaluate(() => {
      localStorage.removeItem('varydocs:appearance');
      localStorage.setItem('varydocs:gta6:color-mode', 'light');
    });
    await page.reload();
    await page.waitForSelector('[data-vd-appearance="light"]');
    assert.equal(await background(), light);
    await choose('跟随系统');
    await page.reload();
    await mode.waitFor();
    assert.equal(await mode.getAttribute('data-appearance'), 'system');
    assert.equal(await background(), dark);
  }
}

async function checkKeys(page, theme, width) {
  const desktop = theme === 'desktop';
  const checkError = width === 1360 && theme === 'minimal';
  const tabs = page.getByRole('tab');
  await tabs.first().focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await tabs.nth(1).getAttribute('aria-selected'), 'true');
  await page.keyboard.press('Home');
  assert.equal(await tabs.first().getAttribute('aria-selected'), 'true');

  const searchName = desktop ? '查找文档' : '搜索';
  const dialogName = desktop ? searchName : '搜索文档';
  const search = page.getByRole('button', { name: searchName, exact: true });
  const dialog = page.getByRole('dialog', { name: dialogName });
  const input = dialog.getByRole('searchbox', { name: dialogName });
  await search.focus();
  await page.keyboard.press(desktop ? 'Control+k' : 'Enter');
  await dialog.waitFor();
  await input.fill('安装步骤');
  if (checkError) await checkAccessibility(page, 'search results');
  if (desktop && width === 1360) {
    await checkAccessibility(page, 'Retro Desktop search results');
    await page.screenshot({ path: join(artifacts, 'desktop-search.png') });
  }
  await input.press('ArrowDown');
  assert.equal(await page.locator(':focus').getAttribute('href'), '/#' + encodeURIComponent('安装步骤'));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.activeElement?.matches('.dt-search-button'));
  await page.keyboard.press('Enter');
  await input.fill('qzxwvvuunomatch');
  await page.getByRole('status').filter({ hasText: 'qzxwvvuunomatch' }).waitFor();
  await page.keyboard.press('Escape');

  const ask = page.getByRole('button', { name: '问 AI' });
  await ask.focus();
  await page.keyboard.press('Enter');
  const question = page.getByRole('textbox');
  await question.waitFor();
  if (checkError) {
    let attempts = 0;
    await page.route('**/api/ask/', async route => {
      attempts++;
      await route.fulfill({ status: 503, body: 'Unavailable' });
    });
    await question.fill('如何安装？');
    await question.press('Enter');
    const error = page.getByRole('alert').filter({ hasText: '回答中断了。' });
    await error.waitFor();
    await page.getByRole('button', { name: '重试' }).click();
    await error.waitFor();
    assert.equal(attempts, 2);
    await checkAccessibility(page, 'assistant error and retry');
  }
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.activeElement?.matches('.vd-ai-trigger'));
}

const layoutMarks = {
  desktop: '.dt-desktop-files .dt-desktop-titlebar',
  gta6: '.dt-gta6-edition',
  editorial: '.dt-editorial-content > .dt-outline',
};

async function checkLayout(page, origin, theme, layout) {
  const label = theme + ' ' + layout;
  const url = origin + '/?theme=' + theme + '&layout=' + layout;
  const topbar = layout === 'topbar';
  const shell = page.locator('.dt-shell');
  const toolbar = shell.locator('.dt-reader-topbar');
  const chrome = topbar ? toolbar : shell.locator('.dt-reader-sidebar-header');
  const menu = page.locator('.dt-desktop-menu');
  const outline = !topbar && theme === 'minimal' ? shell.locator('.dt-outline') : null;
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.goto(url);
  await chrome.waitFor();
  await toolbar.waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await shell.getAttribute('data-doc-layout'), layout);
  assert.equal(await shell.getAttribute('data-doc-theme'), theme);
  if (layoutMarks[theme]) assert(await page.locator(layoutMarks[theme]).isVisible(), label + ' preserves its theme');
  if (topbar) {
    await page.waitForFunction(() => {
      const shell = document.querySelector('.dt-shell');
      const size = Number.parseFloat(shell.style.getPropertyValue('--dt-reader-header-size'));
      return Math.abs(size - shell.querySelector('.dt-reader-topbar').getBoundingClientRect().height) <= 1;
    });
  } else {
    const actions = toolbar.locator('.dt-reader-sidebar-actions');
    assert(await chrome.locator('.dt-brand').isVisible(), label + ' puts the brand on the rail');
    assert(await chrome.locator('.dt-search-button').isVisible(), label + ' puts search on the rail');
    assert.equal(await shell.locator('.dt-search-button').count(), 1, label + ' renders search once');
    for (const control of ['.dt-appearance-trigger', '.vd-ai-trigger']) {
      assert(await actions.locator(control).isVisible(), label + ' puts ' + control + ' on the main toolbar');
      assert.equal(await shell.locator(control).count(), 1, label + ' renders ' + control + ' once');
    }
    const rail = await chrome.boundingBox();
    const appearance = await actions.locator('.dt-appearance-trigger').boundingBox();
    assert(appearance.x >= rail.x + rail.width - 1, label + ' keeps main controls to the right of the rail');
  }

  // Both rail layouts let the documentation list scroll without shifting the page or controls.
  const initial = await chrome.boundingBox();
  const nav = await menu.boundingBox();
  assert(await menu.evaluate(element => element.scrollHeight > element.clientHeight + 150), label + ' has a scrollable list');
  await page.mouse.move(nav.x + nav.width / 2, nav.y + nav.height / 2);
  await page.mouse.wheel(0, 400);
  await page.waitForFunction(() => document.querySelector('.dt-desktop-menu').scrollTop > 50);
  assert.equal(await page.evaluate(() => window.scrollY), 0, label + ' nav wheel leaves the document still');
  assert(Math.abs((await chrome.boundingBox()).y - initial.y) <= 1, label + ' controls stay above the list');

  await page.evaluate(() => window.scrollTo(0, 540));
  await page.waitForFunction(() => window.scrollY >= 500);
  const pinned = await chrome.boundingBox();
  assert(pinned.y >= -1 && pinned.y < 160, label + ' chrome stays visible as the article scrolls');
  const pinnedToolbar = await toolbar.boundingBox();
  assert(pinnedToolbar.y >= -1 && pinnedToolbar.y < 160, label + ' toolbar stays visible as the article scrolls');
  const pinnedOutline = await outline?.boundingBox();
  if (outline) assert(pinnedOutline && pinnedOutline.y >= -1 && pinnedOutline.y < 200, label + ' outline stays visible');
  await page.evaluate(() => window.scrollTo(0, 850));
  await page.waitForFunction(() => window.scrollY >= 800);
  assert(Math.abs((await chrome.boundingBox()).y - pinned.y) <= 1, label + ' chrome stays pinned');
  assert(Math.abs((await toolbar.boundingBox()).y - pinnedToolbar.y) <= 1, label + ' toolbar stays pinned');
  if (outline) assert(Math.abs((await outline.boundingBox()).y - pinnedOutline.y) <= 1, label + ' outline stays pinned');
  await page.screenshot({ path: join(artifacts, 'layout-' + layout + '-' + theme + '.png') });

  const anchor = '安装步骤';
  async function checkHashTarget() {
    await page.waitForFunction(id => {
      const heading = document.getElementById(id)?.getBoundingClientRect();
      const edge = document.querySelector('.dt-reader-topbar')?.getBoundingClientRect().bottom ?? 0;
      return heading?.height > 0 && heading.top >= edge - 1 && heading.bottom < innerHeight;
    }, anchor);
    assert.equal(await page.getByRole('tab', { name: 'pnpm' }).getAttribute('aria-selected'), 'true', label + ' reveals hidden anchors');
  }

  async function followHash() {
    await page.evaluate(id => { location.hash = encodeURIComponent(id); }, anchor);
    await checkHashTarget();
  }

  if (outline) {
    const active = outline.locator('a[aria-current="location"]');
    async function checkActiveHeading(title) {
      await active.filter({ hasText: title }).waitFor();
      assert.equal(await active.count(), 1, label + ' marks one active heading');
      assert.equal(await active.textContent(), title);
    }

    await outline.getByRole('link', { name: anchor, exact: true }).click();
    await page.waitForURL(current => current.hash === '#' + encodeURIComponent(anchor));
    await checkHashTarget();
    await checkActiveHeading(anchor);

    await page.reload();
    await checkHashTarget();
    await checkActiveHeading(anchor);

    await page.evaluate(() => {
      const heading = document.getElementById('部署参数');
      const toolbar = document.querySelector('.dt-reader-topbar');
      const offset = heading.getBoundingClientRect().top - toolbar.getBoundingClientRect().bottom;
      window.scrollBy(0, offset + 1);
    });
    await checkActiveHeading('部署参数');
  } else {
    await followHash();
  }

  if (theme === 'desktop') {
    await page.getByRole('button', { name: '问 AI' }).click();
    await page.getByRole('button', { name: '切换为右侧并排', exact: true }).click();
    await page.waitForSelector('.vd-ai-drawer[open][data-placement="docked"]');
    await page.evaluate(() => { history.replaceState(null, '', location.pathname + location.search); });
    await followHash();
    assert(await page.locator('.vd-ai-drawer[open][data-placement="docked"]').isVisible(), label + ' preserves the docked assistant');
    await page.getByRole('button', { name: '切换为悬浮窗口', exact: true }).click();
  }
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label + ' fits the browser');
}

try {
  const content = join(root, 'content/docs/zh-CN');
  await mkdir(content, { recursive: true });
  await copyFile(join(repo, 'tests/fixtures/reader.mdx'), join(content, 'index.mdx'));
  await writeFile(join(root, 'varydocs.json'), JSON.stringify({ name: 'VaryDocs', i18n: {
    defaultLocale: 'zh-CN', locales: [{ id: 'zh-CN', label: '简体中文' }],
  } }));
  await buildDocs(root);
  await writeFile(join(root, 'index.html'), '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VaryDocs reader test</title></head><body style="margin:0"><main id="root"></main><script type="module" src="/main.jsx"></script></body></html>');
  await writeFile(join(root, 'main.jsx'), `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { DocsView } from '@varydocs/react';
    import '@varydocs/react/styles.css';
    import { AskAI, AssistantLayout } from '@varydocs/ai';
    import '@varydocs/ai/styles.css';
    import { manifest, modules } from './.varydocs/index.mjs';
    import { search } from './.varydocs/search.mjs';
    const { default: Body } = await modules.index();
    const page = manifest.pages[0];
    const params = new URLSearchParams(location.search);
    const style = params.get('theme') ?? manifest.style;
    const layout = params.get('layout');
    const chapters = Array.from({ length: 46 }, (_, index) => {
      const id = 'reader-chapter-' + (index + 1);
      return { ...page, id, slug: [id], title: '文档章节 ' + (index + 1) };
    });
    const longNavigation = { ...manifest, pages: [...manifest.pages, ...chapters],
      navigation: [...manifest.navigation, { label: '阅读手册', pages: chapters.map(chapter => chapter.id) }] };
    function LongArticle(props) {
      return <><Body {...props} />{chapters.slice(0, 34).map(chapter =>
        <p key={chapter.id}>阅读文档时，可以在左侧目录中查找章节，也可以通过页面目录跳转到需要的段落。</p>)}</>;
    }
    const view = <DocsView manifest={layout ? longNavigation : manifest} page={page} Body={layout ? LongArticle : Body}
      layout={layout ?? undefined}
      style={style} mount="" searchDocuments={search} headerActions={<AskAI endpoint="/api/ask/" locale={manifest.locale}
        pageId={page.id} pageTitle={page.title} />} />;
    createRoot(document.getElementById('root')).render(layout ? <AssistantLayout>{view}</AssistantLayout> : view);
  `);
  const config = { configFile: false, root, logLevel: 'error', resolve: { alias: [
    { find: '@varydocs/ai/styles.css', replacement: join(repo, 'packages/ai/styles.css') },
    { find: '@varydocs/ai', replacement: join(repo, 'packages/ai/dist/index.js') },
  ] } };
  await build(config);
  server = await preview({ ...config, preview: { host: '127.0.0.1', port: 0, open: false } });
  const origin = 'http://127.0.0.1:' + server.httpServer.address().port;
  browser = await chromium.launch();
  for (const { id } of builtinStyles) {
    const page = await browser.newPage({ colorScheme: 'light', reducedMotion: 'reduce' });
    try {
      for (const width of [1360, 375]) {
        await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
        await page.goto(origin + '/?theme=' + id);
        await page.getByRole('heading', { level: 1 }).waitFor();
        await page.evaluate(() => document.fonts.ready);
        const sizes = await page.evaluate(() => {
          const pre = document.querySelector('pre');
          return { viewport: innerWidth, width: document.documentElement.scrollWidth,
            codeWidth: pre.clientWidth, contentWidth: pre.scrollWidth, overflow: getComputedStyle(pre).overflowX };
        });
        assert(sizes.width <= sizes.viewport + 1, JSON.stringify({ id, ...sizes }));
        assert(['auto', 'scroll'].includes(sizes.overflow));
        if (width === 375) assert(sizes.contentWidth > sizes.codeWidth);
        if (id === 'desktop') {
          const fileTitle = page.locator('.dt-desktop-titlebar').filter({ hasText: '文档文件' });
          assert.equal(await fileTitle.isVisible(), width === 1360);
          assert(await page.locator('.dt-desktop-command-title').filter({ hasText: 'sh' }).isVisible());
        }
        await page.screenshot({ path: join(artifacts, id + '-' + width + '.png') });
        await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
        await checkAccessibility(page, id + ' ' + width);
        if (width === 375) {
          const menu = page.locator('.dt-mobile-menu summary');
          await menu.focus();
          await page.keyboard.press('Enter');
          await page.keyboard.press('Tab');
          assert.equal(await page.locator(':focus').getAttribute('aria-current'), 'page');
          await menu.press('Enter');
        }
        await checkKeys(page, id, width);
        const anchor = encodeURIComponent('安装步骤');
        if (id === 'minimal' && width === 1360) {
          await page.getByRole('button', { name: '搜索', exact: true }).press('Enter');
          const query = page.getByRole('searchbox');
          await query.fill('安装步骤');
          await query.press('Enter');
          await page.waitForURL(url => url.hash === '#' + anchor);
          await page.getByRole('heading', { name: '安装步骤' }).waitFor();
          assert.equal(await page.getByRole('tab', { name: 'pnpm' }).getAttribute('aria-selected'), 'true');
        }
        await page.goto(origin + '/?theme=' + id + '#' + anchor);
        const target = page.getByRole('heading', { name: '安装步骤' });
        await target.waitFor();
        if (width === 1360) {
          await page.getByRole('tab', { name: 'npm', exact: true }).click();
          assert.equal(await target.isVisible(), false);
          await page.getByRole('link', { name: '安装步骤', exact: true }).click();
          await target.waitFor();
        }
        assert.equal(await page.getByRole('tab', { name: 'pnpm' }).getAttribute('aria-selected'), 'true');
      }
      const tree = await page.locator('main').ariaSnapshot();
      assert(tree.includes('heading') && tree.includes('tablist') && tree.includes('问 AI'));
      await writeFile(join(artifacts, id + '.aria.txt'), tree);
      await checkAppearance(page, id);
      console.log(id + ' passed desktop, narrow layout, accessibility and keyboard checks');
    } finally { await page.close(); }
  }
  const layouts = await browser.newPage({ colorScheme: 'light', reducedMotion: 'reduce' });
  layouts.setDefaultTimeout(8000);
  try {
    for (const layout of ['topbar', 'sidebar']) {
      for (const { id: theme } of builtinStyles) {
        await checkLayout(layouts, origin, theme, layout);
      }
      await layouts.setViewportSize({ width: 375, height: 812 });
      await layouts.goto(origin + '/?theme=desktop&layout=' + layout);
      await layouts.getByRole('button', { name: '问 AI' }).waitFor();
      await layouts.locator('.dt-mobile-menu summary').waitFor();
      if (layout === 'sidebar') {
        assert(await layouts.locator('.dt-reader-sidebar-header .dt-search-button').isVisible());
        assert(await layouts.locator('.dt-reader-sidebar-actions .dt-appearance-trigger').isVisible());
      }
      assert(await layouts.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), layout + ' fits a narrow screen');
      console.log(layout + ' passed independent wheel scrolling, pinned controls, chapter links and docked AI checks');
    }
  } finally { await layouts.close(); }
} finally {
  await browser?.close();
  await server?.close();
  await rm(root, { recursive: true, force: true });
}
