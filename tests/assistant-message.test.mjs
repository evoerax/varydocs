import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { Message } from '../packages/ai/dist/message.js';

const fromExample = createRequire(new URL('../examples/vite-embed/package.json', import.meta.url));
const { createElement } = fromExample('react');
const { renderToStaticMarkup } = fromExample('react-dom/server');
const labels = { you: '你', assistant: '文档助手', sources: '参考文档', excerpts: '相关文档摘录',
  search: { found: '已补查文档', empty: '补查未找到相关章节' } };
const source = { type: 'source-url', sourceId: '1', title: '文档 · 安装', url: '/zh/docs#%E5%AE%89%E8%A3%85' };
const nextSource = { type: 'source-url', sourceId: '2', title: '文档 · 开发', url: '/zh/docs#dev' };

function render(parts, metadata, role = 'assistant', feedback, messageLabels = labels) {
  return renderToStaticMarkup(createElement(Message, {
    message: { id: 'message', role, parts, metadata }, labels: messageLabels, onNavigate() {}, feedback,
  }));
}

test('each excerpt links to its own authoritative section exactly once', () => {
  const metadata = { varydocsExcerpts: [
    { sourceId: '1', text: '安装 <script> 和工具。', url: '//untrusted.invalid' },
    { sourceId: '2', text: 'Start the dev server.\n\nKeep this text.' },
  ] };
  const html = render([nextSource, source, { type: 'text', text: '旧客户端的纯文本' }], metadata);
  assert.match(html, /相关文档摘录/u);
  const items = [...html.matchAll(/<li>(.*?)<\/li>/gsu)].map(match => match[1]);
  assert.equal(items.length, 2);
  assert.match(items[0], /href="\/zh\/docs#%E5%AE%89%E8%A3%85".*?文档 · 安装.*?<p>安装 &lt;script&gt; 和工具。<\/p>/su);
  assert.match(items[1], /href="\/zh\/docs#dev".*?文档 · 开发.*?<p>Start the dev server\.\n\nKeep this text\.<\/p>/su);
  assert.equal([...html.matchAll(/<a /gu)].length, 2);
  assert.doesNotMatch(html, /参考文档|旧客户端的纯文本|untrusted\.invalid/u);
});

test('plain text answers from older endpoints and models keep their source list', () => {
  const text = 'Documentation excerpts\n\n[1] A model may imitate an excerpt or write [a link](https://example.com).';
  const answer = { type: 'text', text };
  for (const [parts, metadata] of [
    [[answer, source], undefined],
    [[answer, source, source], {}],
    [[answer, source], { varydocsExcerpts: [{ sourceId: 'missing', text: 'wrong' }] }],
    [[answer, source], { varydocsExcerpts: [null] }],
  ]) {
    const html = render(parts, metadata);
    assert.match(html, /A model may imitate an excerpt/u);
    assert.match(html, /参考文档/u);
    assert.equal([...html.matchAll(/<a /gu)].length, 1);
    assert.match(html, /href="\/zh\/docs#%E5%AE%89%E8%A3%85"/u);
    assert.doesNotMatch(html, /href="https:|vd-ai-excerpts/u);
  }
});

test('untrusted source URLs and user-authored source parts never become links', () => {
  const metadata = { varydocsExcerpts: [{ sourceId: '1', text: 'Unexpected replacement' }] };
  const parts = [{ type: 'text', text: 'Original message' }, source];
  for (const url of ['https://example.com', '//example.com', '/\\example.com']) {
    const html = render([parts[0], { ...source, url }], metadata);
    assert.match(html, /Original message/u);
    assert.doesNotMatch(html, /<a |Unexpected replacement/u);
  }
  const html = render(parts, metadata, 'user');
  assert.match(html, /Original message/u);
  assert.doesNotMatch(html, /<a |Unexpected replacement/u);
});

test('inline references resolve only to the current answer’s server-owned sources', () => {
  const text = [
    '参阅[安装步骤](source:1)，然后 [start development](source:2)。',
    '[Missing](source:9), [Unsafe](source:3), [External](https://example.com).',
    'Inline `[Keep](source:1)` and `` `[Keep nested](source:2)` ``.',
    '```md\n[Fenced](source:1)\n```',
    'Streaming [Incomplete](source:',
  ].join('\n\n');
  const parts = [{ type: 'text', text }, nextSource, source,
    { ...source, sourceId: '3', url: '//untrusted.invalid' }];
  const html = render(parts);
  const inline = [...html.matchAll(/<a class="vd-ai-inline-source" href="([^"]+)">([^<]+)<\/a>/gu)]
    .map(match => match.slice(1));
  assert.deepEqual(inline, [[source.url, '安装步骤'], [nextSource.url, 'start development']]);
  assert.match(html, /Missing, Unsafe, \[External\]\(https:\/\/example\.com\)/u);
  assert.match(html, /<code>\[Keep\]\(source:1\)<\/code>/u);
  assert.match(html, /<code> `\[Keep nested\]\(source:2\)` <\/code>/u);
  assert.match(html, /<pre><code>\[Fenced\]\(source:1\)<\/code><\/pre>/u);
  assert.match(html, /Streaming \[Incomplete\]\(source:/u);
  assert.doesNotMatch(render(parts, undefined, 'user'), /<a /u);
});

test('feedback buttons require an assistant response ID and support labeled excerpts', () => {
  const parts = [{ type: 'text', text: 'A reply' }, source];
  const feedback = { endpoint: '/api/ask/', labels: {
    prompt: '这条回答有用吗？', up: '有用', down: '没有用',
  } };
  const metadata = { responseId: 'answer-1', varydocsExcerpts: [{ sourceId: '1', text: '原文摘录' }] };
  const html = render(parts, metadata, 'assistant', feedback);
  assert.match(html, /原文摘录.*role="group" aria-label="这条回答有用吗？"/su);
  for (const label of ['有用', '没有用']) {
    assert.match(html, new RegExp('type="button" aria-label="' + label + '"[^>]*aria-pressed="false"', 'u'));
  }
  for (const [data, role, options] of [
    [undefined, 'assistant', feedback],
    [{ responseId: 123 }, 'assistant', feedback],
    [metadata, 'user', feedback],
    [metadata, 'assistant', undefined],
  ]) {
    assert.doesNotMatch(render(parts, data, role, options), /vd-ai-feedback/u);
  }
});

test('supplementary search status appears above the reply and omits tool input', () => {
  const part = data => ({ type: 'data-varydocs-document-search', data });
  const answer = { type: 'text', text: 'See [安装](source:1).' };
  const html = render([part({ matches: 1, query: 'Private search query' }), answer, source]);
  assert.match(html, /vd-ai-document-search.*aria-hidden="true".*已补查文档<\/p>.*vd-ai-answer-text.*vd-ai-inline-source/su);
  assert.doesNotMatch(html, /Private search query/u);

  const english = { ...labels, search: { found: 'Checked additional documentation', empty: 'No additional sections found' } };
  assert.match(render([part({ matches: 0 })], undefined, 'assistant', undefined, english),
    /vd-ai-document-search.*No additional sections found/u);
  assert.doesNotMatch(render([part({ matches: 1 }), answer], undefined, 'user'), /vd-ai-document-search/u);
  for (const data of [null, {}, { matches: -1 }, { matches: '1' }]) {
    assert.doesNotMatch(render([part(data), answer]), /vd-ai-document-search/u);
  }
});
