import { gzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildDocs } from '../packages/core/dist/index.js';

const example = fileURLToPath(new URL('../examples/gta6/', import.meta.url));
const resolver = createRequire(join(example, 'package.json'));
const { build } = await import(pathToFileURL(resolver.resolve('vite')));
const compressed = data => gzipSync(data, { level: 9 }).length;
const scratch = join(example, '.varydocs');
await mkdir(scratch, { recursive: true });
const probe = await mkdtemp(join(scratch, 'size-'));
const corpus = await mkdtemp(join(tmpdir(), 'varydocs-benchmark-'));
try {
  const entries = {
    tabs: ["export { Tab, Tabs } from '@varydocs/react/components/tabs';", '@varydocs/react/components/tabs.css'],
    swiss: ["export { DocsView } from '@varydocs/react/view'; export { DocSearch } from '@varydocs/react/components/search'; export { swissTheme } from '@varydocs/react/themes/swiss';", '@varydocs/react/themes/swiss.css'],
    gta6: ["export { DocsView } from '@varydocs/react/view'; export { DocSearch } from '@varydocs/react/components/search'; export { gta6Theme } from '@varydocs/react/themes/gta6';", '@varydocs/react/themes/gta6.css'],
    all: ["export { DocsView } from '@varydocs/react';", '@varydocs/react/styles.css'],
  };
  const sizes = {};
  for (const [name, [entry, css]] of Object.entries(entries)) {
    const input = join(probe, name + '.mjs');
    await writeFile(input, entry + '\nimport ' + JSON.stringify(css) + ';');
    const result = await build({ root: probe, configFile: false, logLevel: 'silent', build: {
      write: false, assetsInlineLimit: 0, minify: true,
      rollupOptions: { input, preserveEntrySignatures: 'strict', external: /^(react|react-dom)(\/|$)/u },
    } });
    const output = [result].flat().flatMap(chunk => chunk.output);
    const assets = output.filter(a => a.type === 'asset');
    sizes[name] = {
      jsGzip: output.filter(a => a.type === 'chunk').reduce((n, a) => n + compressed(a.code), 0),
      cssGzip: assets.filter(a => a.fileName.endsWith('.css')).reduce((n, a) => n + compressed(a.source), 0),
      fontBytes: assets.filter(a => a.fileName.endsWith('.woff2')).reduce((n, a) => n + a.source.length, 0),
    };
  }
  const dist = join(example, 'dist');
  const html = await readFile(join(dist, 'index.html'), 'utf8');
  const entry = html.match(/<script\b[^>]*\bsrc="([^"]+)"/u)[1];
  const css = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/gu)];
  const stylesheets = await Promise.all(css.map(([, href]) => readFile(join(dist, href))));
  const preload = [...html.matchAll(/<link\b[^>]*rel="modulepreload"[^>]*href="([^"]+)"/gu)];
  const preloadedModules = await Promise.all(preload.map(([, href]) => readFile(join(dist, href))));
  const indices = {};
  for (const file of await readdir(dist, { recursive: true })) {
    if (file.endsWith('.json') && file.includes('search')) indices[file] = compressed(await readFile(join(dist, file)));
  }
  const dir = join(corpus, 'content/docs');
  await mkdir(dir, { recursive: true });
  await writeFile(join(corpus, 'varydocs.json'), '{"name":"Scale fixture"}');
  for (let page = 0; page < 1000; page++) {
    const sections = ['Install', 'Configure', 'Deploy', 'Verify'].map((verb, n) =>
      '## ' + verb + '\n\n' + ('Use module ' + page + ' in environment ' + n + '. Check its configuration and confirm the generated output. ').repeat(5));
    await writeFile(join(dir, (page ? 'page-' + page : 'index') + '.md'),
      '---\ntitle: Guide ' + page + '\n---\n\n' + sections.join('\n\n'));
  }
  async function measureBuild() {
    const start = performance.now();
    await buildDocs(corpus);
    return Math.round(performance.now() - start);
  }
  const firstBuildMs = await measureBuild();
  const page = join(dir, 'page-1.md');
  await writeFile(page, await readFile(page, 'utf8') + '\nOne edit.\n');
  const oneEditMs = await measureBuild();
  const { search } = await import(pathToFileURL(join(corpus, '.varydocs/search.mjs')));
  console.log(JSON.stringify({ node: process.version, sizes, exampleEntryJsGzip: compressed(await readFile(join(dist, entry))),
    exampleModulePreloadGzip: preloadedModules.reduce((n, file) => n + compressed(file), 0),
    exampleEntryCssGzip: stylesheets.reduce((n, sheet) => n + compressed(sheet), 0), exampleSearchGzip: indices, corpus: { pages: 1000, sections: search.length, firstBuildMs, oneEditMs,
      indexBytes: Buffer.byteLength(JSON.stringify(search)) } }, null, 2));
} finally {
  await Promise.all([rm(probe, { recursive: true, force: true }), rm(corpus, { recursive: true, force: true })]);
}
