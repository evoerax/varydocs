import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const fromExample = createRequire(new URL('../examples/vite-embed/package.json', import.meta.url));
const { preview } = await import(pathToFileURL(fromExample.resolve('vite')));
const indexPath = /\/assets\/search-(en|zh-CN)-[^/]+\.json$/u;

async function verifyLocale(browser, base, locale) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const requests = [];
    page.on('request', request => {
      const match = indexPath.exec(new URL(request.url()).pathname);
      if (match) requests.push(match[1]);
    });
    await page.goto(new URL(locale === 'en' ? '/' : '/zh-CN/', base).href);
    const trigger = page.locator('.dt-search-button');
    await trigger.waitFor();
    await page.waitForLoadState('networkidle');
    assert.deepEqual(requests, [], 'Opening a document should load zero search indexes');

    const [response] = await Promise.all([
      page.waitForResponse(res => indexPath.test(new URL(res.url()).pathname)),
      trigger.click(),
    ]);
    assert.equal(response.status(), 200);
    const entries = await response.json();
    const target = entries.find(doc => doc.section && doc.anchor);
    assert.ok(target, 'The published index should include an addressable section');
    const input = page.getByRole('searchbox');
    const result = page.getByRole('dialog').getByRole('link').filter({ hasText: target.section }).first();
    await input.fill(target.section);
    await result.waitFor();
    assert.ok((await result.getAttribute('href')).endsWith('#' + encodeURIComponent(target.anchor)));
    await input.press('Escape');
    await input.waitFor({ state: 'hidden' });
    await trigger.click();
    await input.fill(target.section);
    await result.waitFor();
    await page.waitForLoadState('networkidle');
    assert.deepEqual(requests, [locale], 'Repeated search should reuse the active language index');
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch();
try {
  for (const name of ['vite-embed', 'gta6']) {
    const root = fileURLToPath(new URL('../examples/' + name + '/', import.meta.url));
    const server = await preview({ root, logLevel: 'silent', preview: { host: '127.0.0.1', port: 0, open: false } });
    try {
      const base = 'http://127.0.0.1:' + server.httpServer.address().port;
      for (const locale of ['en', 'zh-CN']) {
        await verifyLocale(browser, base, locale);
        console.log(name + '/' + locale + ': document load 0, first search 1, repeat search 0');
      }
    } finally {
      await server.close();
    }
  }
} finally {
  await browser.close();
}
