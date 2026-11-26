import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDocsSeo } from '../packages/next/dist/seo.js';

const page = (id, ...slug) => ({ id, slug });
const options = {
  defaultLocale: 'en', siteUrl: 'https://guides.example/', basePath: '/reader',
  locales: {
    en: { manifest: { pages: [page('index'), page('字体', '字体'), page('only', 'only')] } },
    'zh-CN': { manifest: { pages: [page('index'), page('字体', '字体')] } },
  },
};

test('the publishing origin, deployment prefix and existing translations determine canonical URLs', () => {
  const seo = createDocsSeo(options);
  const prefix = 'https://guides.example/reader';
  assert.deepEqual(seo.metadata('en').alternates.languages, { en: prefix + '/', 'zh-CN': prefix + '/zh-CN/' });
  const chinese = prefix + '/zh-CN/docs/' + encodeURIComponent('字体') + '/';
  assert.equal(seo.metadata('zh-CN', ['字体']).alternates.canonical, chinese);
  assert.equal(seo.metadata('en', ['字体']).alternates.languages['zh-CN'], chinese);
  assert.equal(seo.metadata('en', ['only']).alternates.languages['zh-CN'], undefined);
  assert.deepEqual(seo.metadata('zh-CN', ['only']), {});
  const sitemap = seo.sitemap();
  assert.equal(sitemap.length, 7);
  assert(sitemap.some(entry => entry.url === chinese));
  assert.deepEqual(sitemap.find(entry => entry.url === prefix + '/docs/only/').alternates.languages,
    { en: prefix + '/docs/only/' });
});

test('an unconfigured origin creates no canonical URLs, and an invalid publishing origin fails clearly', () => {
  const seo = createDocsSeo({ ...options, siteUrl: undefined });
  assert.deepEqual(seo.metadata('en', []), {});
  assert.deepEqual(seo.sitemap(), []);
  for (const siteUrl of ['https://example.test/path', 'ftp://example.test', 'https://user:secret@example.test']) {
    assert.throws(() => createDocsSeo({ ...options, siteUrl }), /HTTP\(S\) origin/u);
  }
});
