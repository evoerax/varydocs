import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { createDocsChatHandler } from '../packages/ai/dist/server.js';
import { prepareChatBody } from '../packages/ai/dist/request.js';

const fromAI = createRequire(new URL('../packages/ai/package.json', import.meta.url));
const { DefaultChatTransport, readUIMessageStream, simulateReadableStream } = await import(pathToFileURL(fromAI.resolve('ai')));
const { MockLanguageModelV4 } = await import(pathToFileURL(fromAI.resolve('ai/test')));
const { Chat } = await import(pathToFileURL(fromAI.resolve('@ai-sdk/react')));

const docs = {
  defaultLocale: 'en', basePath: '/product',
  locales: Object.fromEntries(['en', 'zh-CN'].map(locale => [locale, { manifest: {
    locale, pages: [{ id: 'guide', slug: ['guide'], headings: [{ id: locale === 'en' ? 'install' : '安装' }] }],
  } }])),
  searchByLocale: {
    en: [{ id: 'guide', title: 'Guide', section: 'Installation', anchor: 'install', text: 'Run npm install to add the package.' }],
    'zh-CN': [{ id: 'guide', title: '使用指南', section: '安装步骤', anchor: '安装', text: '运行 npm install 安装依赖。' }],
  },
};
const endpoint = 'https://docs.example/assistant';
const turn = (text, role = 'user') => ({ role, parts: [{ type: 'text', text }] });
const body = (messages, locale = 'en') => ({ locale, pageId: 'guide', messages });
const postJson = (handler, input) => handler(new Request(endpoint, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
}));
const vote = (handler, responseId, rating) => postJson(handler, { type: 'feedback', responseId, rating });

async function askMessage(handler, input, chunks) {
  const transport = new DefaultChatTransport({
    api: endpoint, fetch: (url, init) => handler(new Request(url, init)),
  });
  let stream = await transport.sendMessages({
    chatId: 'test', trigger: 'submit-message', messages: input.messages,
    body: { locale: input.locale, pageId: input.pageId },
  });
  if (chunks) stream = stream.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      chunks.push(chunk);
      controller.enqueue(chunk);
    },
  }));
  let message;
  for await (message of readUIMessageStream({ stream, terminateOnError: true })) {}
  return message;
}

const ask = async (handler, input) => (await askMessage(handler, input)).parts;

test('the SDK transport receives localized server-owned citations and labeled excerpts, including page summaries', async () => {
  const handler = createDocsChatHandler(docs);
  for (const question of ['请问如何安装依赖？', '概括这一页']) {
    const parts = await ask(handler, body([turn(question)], 'zh-CN'));
    assert.deepEqual(parts.filter(p => p.type === 'source-url').map(p => [p.title, p.url]),
      [['使用指南 · 安装步骤', '/product/zh-CN/docs/guide/#' + encodeURIComponent('安装')]]);
    assert.match(parts.find(p => p.type === 'text').text, /相关文档摘录[\s\S]*安装依赖/u);
  }
});

test('a current-page summary only quotes passages from the open document', async () => {
  const { manifest } = docs.locales.en;
  const handler = createDocsChatHandler({
    ...docs,
    locales: { en: { manifest: { ...manifest, pages: [...manifest.pages, { id: 'other', slug: ['other'], headings: [] }] } } },
    searchByLocale: { en: [...docs.searchByLocale.en, { id: 'other', title: 'Page layouts', text: 'Summarize this page layout.' }] },
  });
  const parts = await ask(handler, body([turn('Summarize this page')]));
  assert.deepEqual(parts.filter(p => p.type === 'source-url').map(p => p.url), ['/product/docs/guide/#install']);
  assert.doesNotMatch(parts.find(p => p.type === 'text').text, /Page layouts/u);
});

test('a suggested heading uses its first anchor on the current page, falling back to search for other titles', async () => {
  for (const [locale, title, elsewhere, explain] of [
    ['en', 'Create a site', 'Templates', name => 'Explain “' + name + '”'],
    ['zh-CN', '创建文档站', '模板', name => '讲讲「' + name + '」'],
  ]) {
    const pages = [
      { id: 'guide', slug: ['guide'], headings: [{ id: 'first', title }, { id: 'second', title }] },
      { id: 'other', slug: ['other'], headings: [{ id: 'similar', title }, { id: 'templates', title: elsewhere }] },
    ];
    const search = [
      { id: 'other', anchor: 'similar', title, section: title, text: 'From the other page' },
      { id: 'guide', anchor: 'second', title, section: title, text: 'Duplicate heading' },
      { id: 'guide', anchor: 'first', title, section: title, text: 'First matching section' },
      { id: 'other', anchor: 'templates', title: elsewhere, section: elsewhere, text: 'Available templates' },
    ];
    const handler = createDocsChatHandler({ defaultLocale: locale, locales: { [locale]: { manifest: { locale, pages } } },
      searchByLocale: { [locale]: search } });
    const selected = await ask(handler, body([turn(explain(title))], locale));
    assert.deepEqual(selected.filter(p => p.type === 'source-url').map(p => p.url), ['/docs/guide/#first']);
    assert.match(selected.find(p => p.type === 'text').text, /First matching section/u);
    const fallback = await ask(handler, body([turn(explain(elsewhere))], locale));
    assert.deepEqual(fallback.filter(p => p.type === 'source-url').map(p => p.url), ['/docs/other/#templates']);
  }
});

test('generic follow-ups inherit a heading, page, or new search from the most recent topic in either language', async () => {
  for (const [locale, heading, deploy, select, summarize, example, details, newTopic] of [
    ['en', 'Typography', 'Deployment', 'Explain “Typography”', 'Summarize this page',
      'Can you give me an example?', 'More details, please.', 'Show me a deployment example'],
    ['zh-CN', '字体', '部署', '讲讲「字体」', '概括这一页', '能举个例子吗？', '再详细点', '能举个部署的例子吗？'],
  ]) {
    const pages = [
      { id: 'guide', slug: ['guide'], headings: [{ id: 'type', title: heading }, { id: 'color', title: 'Palette' }] },
      { id: 'deploy', slug: ['deploy'], headings: [] },
    ];
    const search = [
      { id: 'guide', anchor: 'type', title: heading, text: heading },
      { id: 'guide', anchor: 'color', title: 'Palette', text: 'Palette' },
      { id: 'deploy', title: deploy, text: 'More details and examples. 更多详细例子。' },
    ];
    const handler = createDocsChatHandler({ defaultLocale: locale, locales: { [locale]: { manifest: { locale, pages } } },
      searchByLocale: { [locale]: search } });
    const citations = async (...questions) => {
      const messages = questions.flatMap(q => [turn(q), turn('…', 'assistant')]).slice(0, -1);
      const parts = await ask(handler, body(messages, locale));
      return parts.filter(p => p.type === 'source-url').map(p => p.url).sort();
    };
    const chapter = ['/docs/guide/#type'];
    const page = ['/docs/guide/#color', '/docs/guide/#type'];
    assert.deepEqual(await citations(select, example), chapter);
    assert.deepEqual(await citations(select, example, details), chapter);
    assert.deepEqual(await citations(select, summarize, example, details), page);
    assert.deepEqual(await citations(select, newTopic), ['/docs/deploy/']);
    assert.deepEqual(await citations(select, example, newTopic, details), ['/docs/deploy/']);
  }
});

test('excerpt previews are bounded and numbered in the same order as the source links', async () => {
  const index = [
    { id: 'guide', title: 'Guide', text: 'Install the package. ' + '📚'.repeat(600) },
    ...docs.searchByLocale.en,
  ];
  const handler = createDocsChatHandler({ ...docs, searchByLocale: { en: index } });
  const { parts, metadata } = await askMessage(handler, body([turn('Summarize this page')]));
  const sources = parts.filter(part => part.type === 'source-url');
  const [, ...sections] = parts.find(part => part.type === 'text').text.split('\n\n');
  assert.equal(sections.length, 2);
  for (const [i, section] of sections.entries()) {
    const [label, text] = section.split('\n');
    assert.equal(label, '[' + sources[i].sourceId + '] ' + sources[i].title);
    assert.deepEqual(metadata.varydocsExcerpts[i], { sourceId: sources[i].sourceId, text });
    assert(Array.from(text).length <= 320);
    assert(text.isWellFormed());
  }
});

test('stopping a chat aborts the provider and retry answers the original question once', { timeout: 5000 }, async () => {
  const started = Promise.withResolvers();
  let aborted = false;
  const model = new MockLanguageModelV4({
    doStream: async ({ abortSignal }) => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({ type: 'text-start', id: 'a' });
          if (!aborted) {
            controller.enqueue({ type: 'text-delta', id: 'a', delta: 'Partial' });
            abortSignal.addEventListener('abort', () => {
              aborted = true;
              controller.close();
            }, { once: true });
            started.resolve();
            return;
          }
          controller.enqueue({ type: 'text-delta', id: 'a', delta: 'Install the package.' });
          controller.enqueue({ type: 'text-end', id: 'a' });
          controller.enqueue({ type: 'finish', finishReason: { unified: 'stop', raw: 'stop' },
            usage: { inputTokens: { total: 2 }, outputTokens: { total: 4 } } });
          controller.close();
        },
      }),
    }),
  });
  const events = [];
  const abortedEvent = Promise.withResolvers();
  const handler = createDocsChatHandler({ ...docs, model, operations: { onEvent(event) {
    events.push(event);
    if (event.status === 'aborted') abortedEvent.resolve();
  } } });
  const chat = new Chat({ transport: new DefaultChatTransport({
    api: endpoint, fetch: (url, init) => handler(new Request(url, init)),
    prepareSendMessagesRequest: ({ messages }) => ({ body: prepareChatBody('en', 'guide', messages) }),
  }) });
  try {
    const first = chat.sendMessage({ text: 'installation' });
    await started.promise;
    await chat.stop();
    await first;
    await abortedEvent.promise;
    assert(aborted);
    assert.equal(chat.status, 'ready');
    assert.equal(chat.messages[1].metadata?.responseId, undefined);
    await chat.regenerate();
    assert.equal(chat.error, undefined);
    assert.deepEqual(chat.messages.map(m => m.role), ['user', 'assistant']);
    assert.equal(chat.messages[1].parts.find(p => p.type === 'text').text, 'Install the package.');
    assert.equal(chat.messages[1].metadata?.varydocsExcerpts, undefined);
    assert.equal(chat.messages[1].metadata?.responseId, events[1].responseId);
    assert.equal(model.doStreamCalls.length, 2);

    chat.messages = [];
    await chat.sendMessage({ text: 'Tell me more' });
    assert.match(chat.messages[1].parts.find(p => p.type === 'text').text, /No matching passage/u);
    assert.equal(chat.messages[1].metadata?.varydocsExcerpts, undefined);
    assert.equal(model.doStreamCalls.length, 2);
    assert.deepEqual(events.map(({ mode, status, inputTokens, outputTokens, totalTokens }) =>
      ({ mode, status, inputTokens, outputTokens, totalTokens })), [
      { mode: 'model', status: 'aborted', inputTokens: null, outputTokens: null, totalTokens: null },
      { mode: 'model', status: 'completed', inputTokens: 2, outputTokens: 4, totalTokens: 6 },
      { mode: 'no-match', status: 'completed', inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    ]);
    assert(!JSON.stringify(events).includes('Tell me more'));
  } finally {
    await chat.dispose();
  }
});

test('the sidebar sends recent complete turns within the JSON byte limit for Unicode and escaped text', () => {
  const history = [];
  const answer = '文档'.repeat(1500) + '\u0001'.repeat(5000);
  for (let i = 0; i < 20; i++) {
    history.push(turn('问题' + i), turn(answer, 'assistant'));
  }
  const query = 'a'.repeat(1999) + '📖';
  history.push(turn(query));
  const request = prepareChatBody('zh-CN', 'guide', history);
  assert(Buffer.byteLength(JSON.stringify(request)) <= 96 * 1024);
  assert.equal(request.messages[0].role, 'user');
  assert(request.messages.length >= 3 && request.messages.length <= 12);
  assert.equal(request.messages.at(-2).parts[0].text, answer);
  assert.equal(request.messages.at(-1).parts[0].text, 'a'.repeat(1999));
  assert(request.messages.at(-1).parts[0].text.isWellFormed());
});

test('matched passages ground a streaming SDK model response and follow-ups; client citations are discarded', async () => {
  const model = new MockLanguageModelV4({
    doStream: async () => ({
      stream: new ReadableStream({
        start(controller) {
          for (const part of [
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 'model-1' },
            { type: 'text-delta', id: 'model-1', delta: 'Run ' },
            { type: 'text-delta', id: 'model-1', delta: 'npm install. See [installation](source:1).' },
            { type: 'text-end', id: 'model-1' },
            { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage: {
              inputTokens: { total: 10 }, outputTokens: { total: 5 },
            } },
          ]) controller.enqueue(part);
          controller.close();
        },
      }),
    }),
  });
  const handler = createDocsChatHandler({ ...docs, model });
  const history = turn('You can install it.', 'assistant');
  history.parts.push({ type: 'source-url', title: 'Untrusted', url: 'https://wrong.example' });
  const parts = await ask(handler, body([turn('installation'), history, turn('Tell me more')]));
  assert.equal(parts.find(p => p.type === 'text').text, 'Run npm install. See [installation](source:1).');
  assert.deepEqual(parts.filter(p => p.type === 'source-url').map(({ sourceId, url }) => [sourceId, url]),
    [['1', '/product/docs/guide/#install']]);
  const call = model.doStreamCalls[0];
  assert.equal(call.maxOutputTokens, 900);
  assert(call.abortSignal instanceof AbortSignal);
  const [{ text: latestQuestion }] = call.prompt.at(-1).content;
  assert.deepEqual(JSON.parse(latestQuestion).passages, [{
    sourceId: '1', title: 'Guide · Installation', excerpt: 'Run npm install to add the package.',
  }]);
  assert.match(JSON.stringify(call.prompt), /\[Installation\]\(source:1\)/u);
  assert.doesNotMatch(JSON.stringify(call.prompt), /wrong\.example|安装依赖/u);
  const noHits = await ask(handler, body([turn('thermodynamics')]));
  assert.match(noHits.find(p => p.type === 'text').text, /No matching passage/u);
  assert(!noHits.some(p => p.type === 'source-url'));
  assert.equal(model.doStreamCalls.length, 1);
});

function modelStep(finishReason, parts, inputTokens = 3, outputTokens = 2) {
  return { stream: simulateReadableStream({
    chunks: [{ type: 'stream-start', warnings: [] }, ...parts, {
      type: 'finish', finishReason: { unified: finishReason, raw: finishReason },
      usage: { inputTokens: { total: inputTokens }, outputTokens: { total: outputTokens } },
    }],
    initialDelayInMs: 0, chunkDelayInMs: 0,
  }) };
}

function docLookup(id, query) {
  return { type: 'tool-call', toolCallId: id, toolName: 'searchDocumentation', input: JSON.stringify({ query }) };
}

function modelText(delta, id = 'answer') {
  return [{ type: 'text-start', id }, { type: 'text-delta', id, delta }, { type: 'text-end', id }];
}

test('the model can supplement initial matches with one localized lookup and cite its validated chapters', async () => {
  const locale = 'zh-CN';
  const headings = Array.from({ length: 6 }, (_, i) => ({ id: '回滚-' + (i + 1), title: '发布回滚' }));
  const zh = docs.locales[locale].manifest;
  const deployment = { id: 'deploy', slug: ['deploy'], headings };
  const migration = { id: 'migration', slug: ['migration'], headings: [] };
  const model = new MockLanguageModelV4({ doStream: [
    modelStep('tool-calls', [docLookup('lookup', '发布回滚'), docLookup('extra', '迁移方案')]),
    modelStep('stop', modelText('按[发布回滚](source:2)中的步骤操作。'), 7, 4),
  ] });
  const usages = [];
  const handler = createDocsChatHandler({
    ...docs, model, searchDocumentation: true,
    locales: { ...docs.locales, [locale]: { manifest: { ...zh, pages: [...zh.pages, deployment, migration] } } },
    searchByLocale: {
      en: [...docs.searchByLocale.en, { id: 'deploy', title: 'English only', text: '发布回滚' }],
      [locale]: [
        ...docs.searchByLocale[locale],
        { id: 'deploy', title: '发布回滚', section: '发布回滚', anchor: 'unknown', text: '发布回滚 无效锚点' },
        ...headings.map(heading => ({
          id: 'deploy', title: '部署指南', anchor: heading.id, section: heading.title, text: '发布回滚 ' + heading.id,
        })),
        { id: 'migration', title: '迁移方案', text: '迁移方案' },
      ],
    },
    operations: { onEvent: event => usages.push(event) },
  });
  const chunks = [];
  const { parts, metadata } = await askMessage(handler, body([turn('安装步骤')], locale), chunks);
  assert.deepEqual(parts.filter(p => p.type === 'source-url').map(p => [p.sourceId, p.url]), [
    ['1', '/product/zh-CN/docs/guide/#' + encodeURIComponent('安装')],
    ...headings.slice(0, 4).map(({ id }, i) => [String(i + 2), '/product/zh-CN/docs/deploy/#' + encodeURIComponent(id)]),
  ]);
  assert.equal(parts.find(p => p.type === 'text')?.text, '按[发布回滚](source:2)中的步骤操作。');
  assert(!chunks.some(chunk => chunk.type.startsWith('tool-')), 'The sidebar receives citations rather than raw tool inputs or outputs.');
  assert.deepEqual(chunks.filter(chunk => chunk.type === 'data-varydocs-document-search')
    .map(chunk => chunk.data), [{ matches: 4 }]);
  assert(chunks.findIndex(chunk => chunk.type === 'source-url' && chunk.sourceId === '2') <
    chunks.findIndex(chunk => chunk.type === 'text-delta'), 'A source must reach the sidebar before its inline link.');
  assert.equal(model.doStreamCalls.length, 2);
  const [lookup, answer] = model.doStreamCalls;
  assert(lookup.tools.some(tool => tool.name === 'searchDocumentation'));
  assert(!answer.tools?.length);
  const results = answer.prompt.filter(entry => entry.role === 'tool').flatMap(entry => entry.content);
  assert.deepEqual(results.find(result => result.toolCallId === 'lookup').output.value,
    headings.slice(0, 4).map(({ id }, i) => ({ sourceId: String(i + 2), title: '部署指南 · 发布回滚', excerpt: '发布回滚 ' + id })));
  assert.doesNotMatch(JSON.stringify(results), /English only|无效锚点|迁移方案/u);
  assert.equal(metadata?.responseId, usages[0]?.responseId);
  assert.deepEqual(usages.map(({ type, status, inputTokens, outputTokens }) => [type, status, inputTokens, outputTokens]),
    [['usage', 'completed', 10, 6]]);
});

test('supplemental search keeps a page summary and a section follow-up within their original scope', async () => {
  const en = docs.locales.en.manifest;
  const locale = 'zh-CN';
  const zh = docs.locales[locale].manifest;
  const outside = { id: 'migration', slug: ['migration'], headings: [] };
  const notes = '缓存上限';
  const heading = { id: '安装', title: '安装步骤' };
  const model = new MockLanguageModelV4({ doStream: [
    modelStep('tool-calls', [docLookup('summary', 'Database migration')]),
    modelStep('stop', modelText('See the [installation steps](source:1).')),
    modelStep('tool-calls', [docLookup('section', notes)]),
    modelStep('stop', modelText('参考[安装步骤](source:1)中的缓存上限。')),
  ] });
  const handler = createDocsChatHandler({
    ...docs, model, searchDocumentation: true,
    locales: {
      en: { manifest: { ...en, pages: [...en.pages, outside] } },
      [locale]: { manifest: { ...zh, pages: [
        { ...zh.pages[0], headings: [heading, { id: '部署', title: '部署' }] }, outside,
      ] } },
    },
    searchByLocale: {
      en: [...docs.searchByLocale.en, { id: outside.id, title: 'Database migration', text: 'Export a snapshot.' }],
      [locale]: [
        { ...docs.searchByLocale[locale][0], text: '运行 npm install。' + '继续安装。'.repeat(250) + notes + '是 20。' },
        { id: 'guide', anchor: '部署', title: '使用指南', section: '部署', text: notes + '是 100。' },
        { id: outside.id, title: '数据库迁移', text: notes + '是 200。' },
      ],
    },
  });

  const summary = await ask(handler, body([turn('Summarize this page')]));
  assert.deepEqual(summary.filter(part => part.type === 'source-url').map(part => part.url), ['/product/docs/guide/#install']);
  const detail = await ask(handler, body([turn('讲讲「安装步骤」'), turn('运行 npm install。', 'assistant'), turn('再详细点')], locale));
  assert.deepEqual(detail.filter(part => part.type === 'source-url').map(part => part.url),
    ['/product/zh-CN/docs/guide/#' + encodeURIComponent(heading.id)]);

  const lookupResult = call => call.prompt.filter(item => item.role === 'tool').flatMap(item => item.content)[0].output.value;
  assert.deepEqual(lookupResult(model.doStreamCalls[1]), []);
  const [result] = lookupResult(model.doStreamCalls[3]);
  assert.match(result.excerpt, /缓存上限是 20。/u);
  assert.equal(lookupResult(model.doStreamCalls[3]).length, 1);
});

test('the lookup can recover from empty initial search results and a direct answer still takes one step', async () => {
  const model = new MockLanguageModelV4({ doStream: [
    modelStep('tool-calls', [...modelText('Unsupported preamble.', 'before-lookup'), docLookup('install', 'Installation')]),
    modelStep('stop', modelText('Follow the [installation instructions](source:1).')),
    modelStep('stop', modelText('Run npm install.')),
  ] });
  const handler = createDocsChatHandler({ ...docs, model, searchDocumentation: true });
  const recovered = await ask(handler, body([turn('bootstrapping')]));
  assert.deepEqual(recovered.filter(p => p.type === 'source-url').map(p => [p.sourceId, p.url]),
    [['1', '/product/docs/guide/#install']]);
  assert.deepEqual(recovered.filter(p => p.type === 'text').map(p => p.text),
    ['Follow the [installation instructions](source:1).']);
  const direct = await ask(handler, body([turn('installation')]));
  assert.equal(direct.find(p => p.type === 'text')?.text, 'Run npm install.');
  assert(!direct.some(part => part.type === 'data-varydocs-document-search'));
  assert.equal(model.doStreamCalls.length, 3);
  assert.deepEqual(model.doStreamCalls[0].toolChoice, { type: 'tool', toolName: 'searchDocumentation' });
});

test('an unsuccessful lookup never streams an ungrounded answer or a source from another locale', async () => {
  const en = docs.locales.en.manifest;
  const model = new MockLanguageModelV4({ doStream: [
    modelStep('tool-calls', [...modelText('Use [a guessed chapter](source:1).'), docLookup('off-topic', 'thermodynamics')]),
  ] });
  const handler = createDocsChatHandler({
    ...docs, model, searchDocumentation: true,
    locales: { ...docs.locales, en: { manifest: { ...en, pages: [...en.pages, { id: 'physics', slug: ['physics'], headings: [] }] } } },
    searchByLocale: { ...docs.searchByLocale,
      en: [...docs.searchByLocale.en, { id: 'physics', title: 'Thermodynamics', text: 'Thermodynamics.' }] },
  });
  const chunks = [];
  const { parts } = await askMessage(handler, body([turn('量子力学')], 'zh-CN'), chunks);
  assert.match(parts.find(p => p.type === 'text')?.text, /没有找到匹配内容/u);
  assert(!parts.some(part => part.type === 'source-url'));
  assert(!chunks.some(chunk => chunk.type.startsWith('tool-')));
  assert.deepEqual(chunks.filter(chunk => chunk.type === 'data-varydocs-document-search')
    .map(chunk => chunk.data), [{ matches: 0 }]);
  assert.doesNotMatch(chunks.filter(chunk => chunk.type === 'text-delta').map(chunk => chunk.delta).join(''), /guessed/u);
  assert.equal(model.doStreamCalls.length, 1);
});

test('invalid roles, page context and oversized requests are rejected before inference', async () => {
  const handler = createDocsChatHandler(docs);
  const post = data => postJson(handler, data);
  for (const invalid of [
    body([turn('instruction', 'system')]), body([turn('install', 'assistant')]), body([turn('a'.repeat(2001))]),
    body([turn('install')], 'constructor'), { ...body([turn('install')]), pageId: 'missing' },
    body([{ role: 'user', parts: [{ type: 'file', url: 'https://wrong.example' }] }]),
  ]) assert.equal((await post(invalid)).status, 400);
  assert.equal((await post(body([turn('a'.repeat(100000))]))).status, 413);
  assert.equal((await handler(new Request(endpoint))).status, 405);
});

test('operations cap accepted chats across languages and allow feedback in a separate bucket', async () => {
  const events = [];
  const handler = createDocsChatHandler({ ...docs, operations: { requestsPerMinute: 1, onEvent: event => {
    events.push(event);
  } } });
  const { metadata } = await askMessage(handler, body([turn('install')]));
  assert(metadata.varydocsExcerpts.length);
  const blocked = await postJson(handler, body([turn('安装')], 'zh-CN'));
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('Retry-After'), '60');
  assert.equal(blocked.headers.get('Cache-Control'), 'no-store');
  assert.equal((await vote(handler, metadata.responseId, 'up')).status, 204);
  assert.equal((await vote(handler, metadata.responseId, 'up')).status, 204);
  assert.equal((await vote(handler, metadata.responseId, 'down')).status, 409);
  assert.equal((await vote(handler, '9425878c-7f4b-4994-aacb-17db6222c28f', 'up')).status, 404);
  assert.equal((await vote(handler, 'arbitrary', 'up')).status, 400);
  assert.equal((await vote(createDocsChatHandler(docs), metadata.responseId, 'up')).status, 400);
  assert.equal(events.length, 2);
  const [usage, feedback] = events;
  assert.equal(usage.type, 'usage');
  assert.equal(usage.responseId, metadata.responseId);
  assert.equal(usage.mode, 'excerpts');
  assert.equal(usage.locale, 'en');
  assert.equal(usage.pageId, 'guide');
  assert.equal(usage.totalTokens, 0);
  assert.deepEqual({ ...feedback, timestamp: undefined }, {
    type: 'feedback', timestamp: undefined, responseId: metadata.responseId,
    mode: 'excerpts', locale: 'en', pageId: 'guide', rating: 'up',
  });
});

test('concurrent or retried votes share a write and failed logging can be retried', async t => {
  const warning = t.mock.method(console, 'warn', () => {});
  const started = Promise.withResolvers();
  const sink = Promise.withResolvers();
  let attempts = 0;
  const handler = createDocsChatHandler({ ...docs, operations: { onEvent(event) {
    if (event.type === 'usage') throw new Error('Usage sink unavailable');
    if (attempts++ === 0) {
      started.resolve();
      return sink.promise;
    }
  } } });
  const { metadata } = await askMessage(handler, body([turn('install')]));
  const first = vote(handler, metadata.responseId, 'down');
  await started.promise;
  const duplicate = vote(handler, metadata.responseId, 'down');
  const different = await vote(handler, metadata.responseId, 'up');
  assert.equal(different.status, 409);
  sink.reject(new Error('Feedback sink unavailable'));
  assert.equal((await first).status, 503);
  assert.equal((await duplicate).status, 503);
  assert.equal((await vote(handler, metadata.responseId, 'down')).status, 204);
  assert.equal(attempts, 2);
  assert.equal(warning.mock.callCount(), 2);
  assert(!JSON.stringify(warning.mock.calls.map(call => call.arguments)).includes('unavailable'));
});
