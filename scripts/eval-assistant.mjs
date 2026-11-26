import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { buildDocs } from '../packages/core/dist/index.js';
import { createDocsChatHandler } from '../packages/ai/dist/server.js';
import { prepareChatBody } from '../packages/ai/dist/request.js';
import { assistantEvalCases } from '../tests/fixtures/assistant-eval.mjs';

const baseURL = process.env.VARYDOCS_EVAL_URL ?? 'http://127.0.0.1:3341/v1';
const modelId = process.env.VARYDOCS_EVAL_MODEL ?? 'qwen3-4b-instruct-2507';
const output = new URL('../.varydocs/assistant-eval/', import.meta.url);
await mkdir(output, { recursive: true });
const root = await mkdtemp(fileURLToPath(new URL('corpus-', output)));
const langs = ['en', 'zh-CN'];
const basePath = '/product';

async function* events(body) {
  let pending = '';
  for await (const chunk of body.pipeThrough(new TextDecoderStream())) {
    pending += chunk;
    const lines = pending.split('\n');
    pending = lines.pop();
    for (const line of lines) {
      const data = line.startsWith('data:') ? line.slice(5).trim() : '';
      if (data && data !== '[DONE]') yield JSON.parse(data);
    }
  }
}

let requests = [];
const provider = createOpenAICompatible({
  name: 'assistant-eval',
  baseURL,
  apiKey: process.env.VARYDOCS_EVAL_API_KEY,
  includeUsage: true,
  ...(new URL(baseURL).hostname === 'api.deepseek.com' && {
    transformRequestBody: body => ({ ...body, thinking: { type: 'disabled' } }),
  }),
  fetch: async (...args) => {
    const response = await fetch(...args);
    const capture = (async () => {
      if (!response.ok) return null;
      let usage = null;
      for await (const chunk of events(response.clone().body)) if (chunk.usage) usage = chunk.usage;
      return usage;
    })();
    requests.push(capture.catch(() => null));
    return response;
  },
});

function inspectSources(sources, manifest) {
  const mount = basePath + (manifest.locale === 'en' ? '' : '/' + manifest.locale) + '/docs/';
  return sources.map(source => {
    const url = new URL(source.url, 'https://docs.example.test');
    assert.equal(url.origin, 'https://docs.example.test');
    assert(url.pathname.startsWith(mount), 'Source must stay inside the matching locale');
    const slug = decodeURIComponent(url.pathname.slice(mount.length)).replace(/\/$/u, '');
    const page = manifest.pages.find(doc => doc.slug.join('/') === slug);
    assert(page, 'Invalid cited page: ' + source.url);
    const anchor = decodeURIComponent(url.hash.slice(1));
    assert(!anchor || page.headings.some(heading => heading.id === anchor), 'Invalid cited heading: ' + source.url);
    return { ...source, section: page.id + (anchor ? '#' + anchor : '') };
  });
}

const searchDocumentation = process.env.VARYDOCS_AI_DOCUMENT_SEARCH === '1';
const report = { model: modelId, searchDocumentation, time: new Date().toISOString(), turns: [] };
try {
  await cp(new URL('../packages/core/docs/', import.meta.url), join(root, 'content/docs'), { recursive: true });
  await writeFile(join(root, 'varydocs.json'), JSON.stringify({ name: 'VaryDocs', i18n: {
    defaultLocale: 'en', locales: langs.map(id => ({ id, label: id })),
  } }));
  await buildDocs(root);
  const { defaultLocale, locales } = await import(pathToFileURL(join(root, '.varydocs/index.mjs')));
  const { searchByLocale } = await import(pathToFileURL(join(root, '.varydocs/search.mjs')));
  const post = createDocsChatHandler({ defaultLocale, locales, searchByLocale, basePath, model: provider(modelId), searchDocumentation });

  for (const locale of langs) {
    for (const { id, pageId, turns } of assistantEvalCases) {
      const history = [];
      for (const [i, paired] of turns.entries()) {
        const spec = paired[locale];
        requests = [];
        history.push({ role: 'user', parts: [{ type: 'text', text: spec.question }] });
        const start = performance.now();
        const response = await post(new Request('https://docs.example.test' + basePath + '/api/ask/', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(prepareChatBody(locale, pageId, history)), signal: AbortSignal.timeout(60_000),
        }));
        assert.equal(response.status, 200);
        const parts = [];
        const refs = [];
        let firstTextMs = null;
        let supplementalMatches = null;
        let error;
        for await (const event of events(response.body)) {
          if (event.type === 'error') error = event.errorText;
          if (event.type === 'source-url') refs.push({ sourceId: event.sourceId, url: event.url, title: event.title });
          if (event.type === 'data-varydocs-document-search') supplementalMatches = event.data.matches;
          if (event.type === 'text-delta' && event.delta) {
            firstTextMs ??= Math.round(performance.now() - start);
            parts.push(event.delta);
          }
        }
        const elapsedMs = Math.round(performance.now() - start);
        const answer = parts.join('');
        const sources = inspectSources(refs, locales[locale].manifest);
        const missingSources = spec.expectedSources.filter(section => !sources.some(source => source.section === section));
        const usage = await Promise.all(requests);
        report.turns.push({ id, turn: i + 1, locale, ...spec, answer, sources, missingSources,
          firstTextMs, elapsedMs, supplementalMatches, modelCalls: usage.length, usage, error });
        history.push({ role: 'assistant', parts: [{ type: 'text', text: answer }] });
        console.log(locale, id, i + 1, usage.length ? usage.length + ' model step(s)' : 'local reply', elapsedMs + 'ms',
          supplementalMatches === null ? '' : 'extra search returned ' + supplementalMatches,
          missingSources.length ? 'missing ' + missingSources.join(', ') : '');
      }
    }
  }
  assert(report.turns.some(turn => turn.modelCalls && turn.answer && !turn.error), 'No successful model-generated answers');
  assert(!report.turns.some(turn => turn.error), 'At least one SDK stream failed');
} finally {
  try {
    const filename = process.env.VARYDOCS_EVAL_REPORT ?? fileURLToPath(new URL('latest.json', output));
    await writeFile(filename, JSON.stringify(report, null, 2) + '\n');
    console.log('Saved evaluation:', filename);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
