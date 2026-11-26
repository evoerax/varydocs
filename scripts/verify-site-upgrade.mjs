import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Serve the exported files with the same directory-index and 404 behavior required of a static host.
async function verifyOverHttp(site, prefix, origin) {
  const out = join(site, 'out');
  const fallback = await readFile(join(out, '404.html'));
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (!url.pathname.startsWith(prefix + '/')) throw new Error('Outside the fixture');
      const path = decodeURIComponent(url.pathname.slice(prefix.length + 1));
      const file = path === '' || path.endsWith('/') ? path + 'index.html' : path;
      res.end(await readFile(join(out, file)));
    } catch {
      res.statusCode = 404;
      res.end(fallback);
    }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const host = 'http://127.0.0.1:' + server.address().port + prefix;
  async function get(path, status = 200) {
    const response = await fetch(host + path);
    assert.equal(response.status, status, path);
    return response.text();
  }
  try {
    const map = await get('/sitemap.xml');
    const root = origin + prefix;
    for (const part of ['', '/zh-CN']) {
      const other = part ? '' : '/zh-CN';
      for (const path of ['/', '/docs/']) {
        const html = await get(part + path);
        assert(html.includes('rel="canonical" href="' + root + part + path + '"'), part + path + ' canonical');
        assert(html.includes('hrefLang="' + (part ? 'en' : 'zh-CN') + '" href="' + root + other + path + '"'), 'Missing translated alternate');
        assert(map.includes('<loc>' + root + part + path + '</loc>'), 'Missing sitemap page');
      }
      const html = await get(part + '/docs/');
      assert(html.includes('href="' + prefix + other + '/docs/"'), 'Language switch points outside the deployment');
      const index = JSON.parse(await get(part + '/varydocs-search.json'));
      assert(index.some(hit => hit.id === 'index' && hit.text.includes(part ? '中文回归' : 'Retained author text')));
      if (part) {
        assert(html.includes('id="安装步骤"'), 'Nested Markdown section was not exported');
        assert(index.some(hit => hit.anchor === '安装步骤'), 'Nested Markdown section missing from the search index');
      }
    }
    const english = await get('/docs/legacy/');
    assert(english.includes('href="' + prefix + '/zh-CN/docs/"'), 'Missing-translation fallback');
    assert(!english.includes('hrefLang="zh-CN" href="' + root + '/zh-CN/docs/legacy/"'), 'Nonexistent translation was advertised');
    assert(!map.includes(root + '/zh-CN/docs/legacy/'));
    await get('/zh-CN/docs/legacy/', 404);
    await get('/docs/missing-page/', 404);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

export async function verifySiteUpgrade({ site, cli, workspace, initArgs, run }) {
  run(process.execPath, [cli, 'init', site, '--language', 'en', '--template', 'blank', '--style', 'minimal',
    '--yes', '--package-manager', 'pnpm', '--install', ...initArgs], workspace);
  const configPath = join(site, 'varydocs.json');
  const original = JSON.parse(await readFile(configPath, 'utf8'));
  assert(!original.i18n, 'The migration must start with a single-language site');
  // Recreate the previous starter's default route and lack of SEO files.
  await writeFile(join(site, 'app/(default)/page.jsx'),
    "import { defaultLocale, Home } from '@/lib/docs.jsx';\nexport default function Page() { return <Home locale={defaultLocale} />; }\n");
  for (const path of ['lib/varydocs-seo.js', 'app/sitemap.js', 'app/(default)/docs/[[...slug]]/layout.jsx']) {
    await rm(join(site, path));
  }
  const docs = join(site, 'content/docs');
  await mkdir(join(docs, 'en'));
  await mkdir(join(docs, 'zh-CN'));
  await rename(join(docs, 'index.md'), join(docs, 'en/index.md'));
  await writeFile(join(docs, 'en/index.md'), '\nRetained author text.\n', { flag: 'a' });
  await writeFile(join(docs, 'en/legacy.md'), '---\ntitle: Legacy guide\n---\n\nEnglish-only legacy page.\n');
  await writeFile(join(docs, 'zh-CN/index.mdx'), '---\ntitle: 开始\n---\n\n中文回归。\n\n<Callout>\n\n### 安装步骤\n\n参见[安装步骤](#安装步骤)。\n\n</Callout>\n');
  await writeFile(configPath, JSON.stringify({ ...original, i18n: { defaultLocale: 'en',
    locales: [{ id: 'en', label: 'English' }, { id: 'zh-CN', label: '简体中文' }] } }));
  // The author already supplied some localized UI; keep that and its different extension.
  const localized = join(site, 'app/[locale]');
  await mkdir(localized);
  const customHome = "import { Home } from '@/lib/docs.jsx';\nimport { seo } from '@/lib/varydocs-seo.js';\n" +
    "export async function generateMetadata({params}) { return seo.metadata((await params).locale); }\n" +
    "export default async function LocalHome({params}) { return <><p>Custom home</p><Home locale={(await params).locale}/></>; }\n";
  await writeFile(join(localized, 'page.js'), customHome);
  const layout = join(site, 'app/(default)/layout.jsx');
  const customLayout = (await readFile(layout, 'utf8')) + '\n// Authored layout\n';
  await writeFile(layout, customLayout);
  const origin = 'https://guides.example.test';
  run('pnpm', ['run', 'check'], site);
  for (const prefix of ['', '/release-check']) {
    run('pnpm', ['run', 'build'], site, { VARYDOCS_BASE_PATH: prefix, VARYDOCS_SITE_URL: origin });
    assert.equal(await readFile(layout, 'utf8'), customLayout);
    assert.equal(await readFile(join(localized, 'page.js'), 'utf8'), customHome);
    await verifyOverHttp(site, prefix, origin);
  }
  const bilingual = JSON.parse(await readFile(configPath, 'utf8'));
  bilingual.i18n.locales = [bilingual.i18n.locales[0]];
  await writeFile(configPath, JSON.stringify(bilingual));
  run('pnpm', ['run', 'build'], site, { VARYDOCS_BASE_PATH: '', VARYDOCS_SITE_URL: origin });
  const alias = await readFile(join(site, 'out/en/docs/index.html'), 'utf8');
  assert(alias.includes('rel="canonical" href="' + origin + '/docs/"'), 'Single-language alias must resolve to the primary canonical');
  assert(!(await readFile(join(site, 'out/sitemap.xml'), 'utf8')).includes('/zh-CN/'));
  assert.equal(await readFile(join(localized, 'page.js'), 'utf8'), customHome);
  console.log('Verified pnpm installation, single-language upgrade, translations, SEO and static HTTP routing at root and prefix.');
}
