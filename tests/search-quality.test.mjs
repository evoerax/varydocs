import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { buildDocs } from '../packages/core/dist/index.js';
import { createDocsChatHandler } from '../packages/ai/dist/server.js';
import { createDocumentSearch } from '../packages/model/dist/search.js';
import { assistantEvalCases } from './fixtures/assistant-eval.mjs';

// These pairs describe the same reader task in each language. Either guide
// explaining the actual style command is an appropriate answer to the first.
const cases = [
  [
    ['How do I change the theme in an existing site?', ['cli#switch-styles', 'styling#change-a-style']],
    ['已有站点如何切换风格？', ['cli#切换风格', 'styling#切换风格']],
  ],
  [
    ['How do I install just Tabs?', ['react#import-a-component']],
    ['如何单独引入 Tabs？', ['react#按需引入组件']],
  ],
  [
    ['Which environment variables enable generated answers?', ['assistant#enable-generated-answers']],
    ['怎样配置模型密钥？', ['assistant#启用模型回答']],
  ],
  [
    ['How do I configure multiple languages?', ['react#configure-languages']],
    ['怎么配置多语言？', ['react#配置多语言']],
  ],
  [
    ['How do I export a static site?', ['index#export-the-site']],
    ['怎样导出静态站点？', ['index#导出文档站']],
  ],
  [
    ['How do I create my own layout?', ['styling#create-your-own-layout']],
    ['怎么创建自定义布局？', ['styling#创建自定义布局']],
  ],
];

test('short technical terms match identifiers and French words retain their meaning', () => {
  const documents = [
    { id: 'unrelated', title: 'Capital gains', text: 'Detailed documentation explained.' },
    { id: 'assistant', title: 'Enable AI', text: 'Configure VARYDOCS_AI_MODEL.' },
    { id: 'api', title: 'HTTP interfaces', text: 'Examples for our APIs.' },
    { id: 'gold', title: 'Acheter de l’or', text: '' },
  ];
  const search = createDocumentSearch(documents, 'en');
  assert.deepEqual(search('ai').map(hit => hit.doc.id), ['assistant']);
  assert.deepEqual(search('api').map(hit => hit.doc.id), ['api']);
  assert.deepEqual(createDocumentSearch(documents, 'fr_FR')('or').map(hit => hit.doc.id), ['gold']);
  assert.equal(createDocumentSearch(documents, 'custom label')('ai')[0].doc.id, 'assistant');
});

test('legacy browsers can search Latin and Chinese text without Intl.Segmenter', () => {
  const descriptor = Object.getOwnPropertyDescriptor(Intl, 'Segmenter');
  try {
    Object.defineProperty(Intl, 'Segmenter', { ...descriptor, value: undefined });
    const doc = { id: 'react', title: 'React 配置多语言', text: '在已有项目里配置多语言。' };
    const search = createDocumentSearch([doc], 'zh-CN');
    assert.equal(search('React')[0].doc.id, doc.id);
    assert.equal(search('配置多语言')[0].doc.id, doc.id);
  } finally {
    Object.defineProperty(Intl, 'Segmenter', descriptor);
  }
});

test('search and AI citations rank the matching published guide sections for bilingual reader questions', async t => {
  const root = await mkdtemp(join(tmpdir(), 'varydocs-search-quality-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(new URL('../packages/core/docs/', import.meta.url), join(root, 'content/docs'), { recursive: true });
  const languages = ['en', 'zh-CN'];
  await writeFile(join(root, 'varydocs.json'), JSON.stringify({ name: 'Quality fixture', i18n: {
    defaultLocale: 'en', locales: languages.map(id => ({ id, label: id })),
  } }));
  await buildDocs(root);
  const { locales, defaultLocale } = await import(pathToFileURL(join(root, '.varydocs/index.mjs')));
  const { searchByLocale } = await import(pathToFileURL(join(root, '.varydocs/search.mjs')));
  const handler = createDocsChatHandler({ locales, defaultLocale, searchByLocale });
  for (const [languageIndex, locale] of languages.entries()) {
    const search = createDocumentSearch(searchByLocale[locale], locale);
    const sourceId = doc => doc.id + '#' + (doc.anchor ?? '');
    const runSearch = question => search(question).slice(0, 9).map(hit => sourceId(hit.doc));
    async function ask(questions, pageId = 'index') {
      const input = { locale, pageId, messages: questions.map(text => ({ role: 'user', parts: [{ type: 'text', text }] })) };
      const response = await handler(new Request('https://docs.example/api/ask/', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }));
      assert.equal(response.status, 200);
      const chunks = (await response.text()).split('\n').filter(line => line.startsWith('data: {'))
        .map(line => JSON.parse(line.slice(6)));
      const mount = locale === defaultLocale ? '/docs/' : '/' + locale + '/docs/';
      return chunks.filter(chunk => chunk.type === 'source-url').map(({ url }) => {
        const target = new URL(url, 'https://docs.example');
        assert(target.pathname.startsWith(mount));
        const page = target.pathname.slice(mount.length).replace(/\/$/u, '') || 'index';
        return page + '#' + decodeURIComponent(target.hash.slice(1));
      });
    }
    for (const [name, run] of [['reader', runSearch], ['assistant', question => ask([question])]]) {
      let top1 = 0;
      let top3 = 0;
      for (const pair of cases) {
        const [question, relevant] = pair[languageIndex];
        const results = await run(question);
        if (relevant.includes(results[0])) top1++;
        if (results.slice(0, 3).some(result => relevant.includes(result))) top3++;
        assert(relevant.includes(results[0]), name + ' / ' + question + ': ' + results.slice(0, 3).join(', '));
      }
      assert.deepEqual(await run(locale === 'en' ? 'particle accelerator' : '粒子加速器'), []);
      t.diagnostic(locale + ' ' + name + ' top-1 ' + top1 + '/' + cases.length + ', top-3 ' + top3 + '/' + cases.length);
    }
    for (const { id, pageId, turns } of assistantEvalCases) {
      const questions = [];
      for (const [i, pair] of turns.entries()) {
        const { question, expectedSources, unanswerable } = pair[locale];
        // Deployments should be able to name a different subpath from the one in the guide.
        questions.push(question.replace('/product/', '/customer-docs/'));
        const sources = await ask(questions, pageId);
        const label = locale + ' / ' + id + ' / turn ' + (i + 1);
        if (unanswerable) assert.deepEqual(sources, [], label);
        for (const section of expectedSources) assert(sources.includes(section), label + ': missing ' + section);
      }
    }
  }
});

test('both Vite hosts emit separate locale indexes and ship only their URLs in the entry', async () => {
  const example = new URL('../examples/vite-embed/', import.meta.url);
  const fromExample = createRequire(new URL('package.json', example));
  const { build } = await import(pathToFileURL(fromExample.resolve('vite')));
  for (const name of ['vite-embed', 'gta6']) {
    const root = fileURLToPath(new URL('../examples/' + name + '/', import.meta.url));
    await promisify(execFile)(process.execPath, [fileURLToPath(new URL('compile.mjs', example)), root]);
    const { output } = await build({ root, base: '/preview/', logLevel: 'silent', build: { write: false } });
    const entry = output.find(chunk => chunk.type === 'chunk' && chunk.isEntry);
    const { searchByLocale } = await import(pathToFileURL(join(root, '.varydocs/search.mjs')));
    for (const [locale, docs] of Object.entries(searchByLocale)) {
      const json = output.find(asset => asset.fileName.startsWith('assets/search-' + locale + '-') && asset.fileName.endsWith('.json'));
      assert(json, name + ' ' + locale + ' search index');
      assert.deepEqual(JSON.parse(json.source.toString()), docs);
      assert(entry.code.includes('/preview/' + json.fileName));
    }
    assert(!Object.keys(entry.modules).some(id => id.endsWith('/.varydocs/search.mjs')));
  }
});
