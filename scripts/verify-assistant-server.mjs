import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { setTimeout as wait } from 'node:timers/promises';

function chatBody(locale, question) {
  return JSON.stringify({
    locale, pageId: 'configuration',
    messages: [{ role: 'user', parts: [{ type: 'text', text: question }] }],
  });
}

async function readAnswer(response) {
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /^text\/event-stream\b/u);
  assert.equal(response.headers.get('x-vercel-ai-ui-message-stream'), 'v1');
  const records = (await response.text()).split(/\r?\n/u)
    .filter(line => line.startsWith('data:')).map(line => line.slice(5).trim());
  assert.equal(records.pop(), '[DONE]', 'Expected a complete SSE stream');
  const parts = records.map(record => JSON.parse(record));
  assert.equal(parts[0]?.type, 'start');
  assert.equal(parts.at(-1)?.type, 'finish');
  assert(!parts.some(part => part.type === 'error'), 'Unexpected error in the assistant stream');
  return {
    text: parts.filter(part => part.type === 'text-delta').map(part => part.delta).join(''),
    sources: parts.filter(part => part.type === 'source-url'),
    metadata: parts.at(-1).messageMetadata,
  };
}

async function checkAssistant(origin, basePath, signal, events) {
  const endpoint = origin + basePath + '/api/ask/';
  function post(body, contentType = 'application/json') {
    return fetch(endpoint, { method: 'POST', body, headers: { 'content-type': contentType }, redirect: 'error', signal });
  }

  const answerIds = [];
  for (const fixture of [
    { locale: 'en', prefix: '', question: 'Explain “Edit navigation”', anchor: 'edit-navigation',
      passage: 'relative to the content directory', label: 'Ask AI', noMatch: 'No matching passage' },
    { locale: 'zh-CN', prefix: '/zh-CN', question: '讲讲「编辑导航」', anchor: '编辑导航',
      passage: '相对于文档目录', label: '问 AI', noMatch: '没有找到匹配内容' },
  ]) {
    const answer = await readAnswer(await post(chatBody(fixture.locale, fixture.question)));
    assert(answer.text.includes(fixture.passage), 'Missing the cited passage in ' + fixture.locale);
    assert.equal(answer.sources.length, 1, 'Expected exactly the selected section');
    const [source] = answer.sources;
    const path = basePath + fixture.prefix + '/docs/configuration/';
    assert.equal(source.url, path + '#' + encodeURIComponent(fixture.anchor));
    assert.equal(source.sourceId, '1');
    const index = await fetch(origin + basePath + fixture.prefix + '/varydocs-search.json', { redirect: 'error', signal });
    assert.equal(index.status, 200);
    const section = (await index.json()).find(entry => entry.id === 'configuration' && entry.anchor === fixture.anchor);
    assert(section?.text.includes(fixture.passage), 'Missing the original indexed section in ' + fixture.locale);
    assert.deepEqual(answer.metadata?.varydocsExcerpts, [{ sourceId: source.sourceId, text: section.text.trim() }]);
    assert.equal(typeof answer.metadata.responseId, 'string');
    answerIds.push(answer.metadata.responseId);
    const vote = JSON.stringify({ type: 'feedback', responseId: answer.metadata.responseId, rating: 'up' });
    for (let retry = 0; retry < 2; retry++) {
      assert.equal((await post(vote)).status, 204);
    }
    const target = new URL(source.url, origin);
    const page = await fetch(target, { redirect: 'error', signal });
    assert.equal(page.status, 200, 'Unable to open citation ' + source.url);
    const html = await page.text();
    assert(html.includes('lang="' + fixture.locale + '"'));
    assert(html.includes('id="' + decodeURIComponent(target.hash.slice(1)) + '"'), 'Missing citation target ' + source.url);
    const triggers = html.match(/<button\b[^>]*\baria-haspopup="dialog"[^>]*>[\s\S]*?<\/button>/gu) ?? [];
    assert(triggers.some(trigger => trigger.includes(fixture.label)), 'Missing localized assistant trigger');

    const empty = await readAnswer(await post(chatBody(fixture.locale, 'qzxwvvuusmoke')));
    assert.deepEqual(empty.sources, []);
    assert.equal(empty.metadata?.varydocsExcerpts, undefined);
    assert.equal(typeof empty.metadata?.responseId, 'string');
    assert(empty.text.includes(fixture.noMatch), 'Missing localized no-result feedback');
  }

  for (const path of ['/docs/missing-page/', '/zh-CN/docs/missing-page/', '/missing-locale/docs/']) {
    const response = await fetch(origin + basePath + path, { redirect: 'error', signal });
    assert.equal(response.status, 404, 'Expected an HTTP 404 at ' + path);
    await response.arrayBuffer();
  }

  for (const [body, contentType, status] of [
    ['{', 'application/json', 400],
    [chatBody('unknown-locale', 'Navigation'), 'application/json', 400],
    [chatBody('en', 'Navigation'), 'text/plain', 415],
  ]) {
    const response = await post(body, contentType);
    assert.equal(response.status, status);
    await response.arrayBuffer();
  }

  const limited = await post(chatBody('en', 'Navigation'));
  assert.equal(limited.status, 429);
  assert(Number(limited.headers.get('retry-after')) > 0);
  await limited.arrayBuffer();

  // The server writes events to a subprocess pipe while it sends the HTTP response.
  for (let retry = 0; events.length < 6 && retry < 50; retry++) await wait(20, undefined, { signal });
  const usage = events.filter(event => event.type === 'usage');
  assert.equal(usage.length, 4);
  for (const id of answerIds) {
    const answered = usage.find(event => event.responseId === id);
    assert.equal(answered?.mode, 'excerpts');
    assert.equal(answered?.totalTokens, 0);
    const votes = events.filter(event => event.type === 'feedback' && event.responseId === id);
    assert.equal(votes.length, 1, 'Retried feedback should be logged once');
    assert.equal(votes[0].rating, 'up');
  }
}

export async function verifyAssistantBrowser(origin, basePath = '') {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10_000);
    const docs = basePath + '/zh-CN/docs/';
    const config = docs + 'configuration/';
    const sources = [
      ['编辑导航', config], ['切换风格', config], ['写第一篇文档', docs],
    ].map(([title, path], index) => ({ type: 'source-url', sourceId: String(index + 1),
      title, url: path + '#' + encodeURIComponent(title) }));
    const question = '怎么编辑导航和切换风格？';
    const answer = '请先[查看导航配置](source:1)，再[查看切换风格](source:2)或[回到入门章节](source:3)。';
    const draft = '这个页面的配置也适用吗？';
    const followUp = '这是切换文档之后的回答。';
    const requests = [];
    await page.route('**/api/ask/', route => {
      requests.push(route.request().postDataJSON());
      const first = requests.length === 1;
      const parts = [{ type: 'start' }, ...(first ? sources : []), { type: 'text-start', id: 'a' },
        { type: 'text-delta', id: 'a', delta: first ? answer : followUp }, { type: 'text-end', id: 'a' },
        { type: 'finish', finishReason: 'stop' }];
      return route.fulfill({ headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
        body: parts.map(part => 'data: ' + JSON.stringify(part) + '\n\n').join('') + 'data: [DONE]\n\n' });
    });
    await page.goto(origin + docs);
    await page.getByRole('button', { name: '问 AI', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: '文档助手' });
    const heading = drawer.locator('.vd-ai-heading');
    const newChat = heading.locator('.vd-ai-heading-actions').getByRole('button', { name: '新对话', exact: true });
    const input = drawer.getByRole('textbox');
    const conversation = drawer.getByRole('log');
    await input.waitFor();
    assert.equal((await heading.innerText()).trim(), '文档助手');
    assert.equal(await drawer.getByRole('button', { name: '新对话', exact: true }).count(), 0);
    await input.fill(question);
    await input.press('Enter');
    const crossPage = conversation.getByRole('link', { name: '查看导航配置', exact: true });
    await crossPage.waitFor();
    await input.fill(draft);
    const rendered = await drawer.elementHandle();
    const reader = page.locator('.vd-ai-document');

    async function verifyLayout(placement) {
      const panel = await drawer.boundingBox();
      const content = await reader.boundingBox();
      assert.equal(await drawer.getAttribute('data-placement'), placement);
      assert.equal(await drawer.evaluate(node => node.matches(':modal')), false);
      if (placement === 'docked') {
        assert(Math.abs(content.x + content.width - panel.x) <= 1, 'Docked panel should adjoin the document');
      } else {
        assert(content.x + content.width > panel.x, 'Floating panel should overlap the document');
      }
    }

    async function verifyJump(link, path, id, preservedDraft) {
      await link.click();
      await page.waitForURL(url => url.pathname === path && decodeURIComponent(url.hash.slice(1)) === id);
      await page.waitForFunction(headingId => {
        const target = document.getElementById(headingId)?.getBoundingClientRect();
        return target && target.height > 0 && target.top >= 0 && target.top < innerHeight;
      }, id);
      assert.equal(await drawer.evaluate((node, original) => node === original, rendered), true);
      assert.equal(await input.inputValue(), preservedDraft);
      assert(await conversation.getByText(question, { exact: true }).isVisible());
      assert(await crossPage.isVisible());
    }

    await verifyLayout('floating');
    await verifyJump(crossPage, config, '编辑导航', draft);
    await drawer.getByRole('button', { name: '切换为右侧并排' }).click();
    await verifyLayout('docked');
    await verifyJump(conversation.getByRole('link', { name: '查看切换风格', exact: true }), config, '切换风格', draft);
    await input.press('Enter');
    await conversation.getByText(followUp, { exact: true }).waitFor();
    assert.equal(requests.length, 2);
    assert.equal(requests[1].locale, 'zh-CN');
    assert.equal(requests[1].pageId, 'configuration');
    assert.deepEqual(requests[1].messages.map(({ role, parts }) => [role, parts[0]?.text]),
      [['user', question], ['assistant', answer], ['user', draft]]);
    await verifyJump(conversation.getByRole('link', { name: '回到入门章节', exact: true }), docs, '写第一篇文档', '');
    await verifyLayout('docked');
    await drawer.getByRole('button', { name: '切换为悬浮窗口' }).click();
    await verifyLayout('floating');
    assert(await conversation.getByText(followUp, { exact: true }).isVisible());

    await page.setViewportSize({ width: 880, height: 900 });
    const compactToggle = drawer.getByRole('button', { name: '切换为右侧并排' });
    const close = drawer.getByRole('button', { name: '关闭助手' });
    assert((await compactToggle.boundingBox()).x < (await close.boundingBox()).x);
    await compactToggle.click();
    await verifyLayout('docked');
    assert(await conversation.getByText(followUp, { exact: true }).isVisible());

    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await drawer.locator('.vd-ai-placement').isVisible(), false);
    assert.equal(await drawer.evaluate(node => getComputedStyle(node).position), 'fixed');
    assert(await conversation.getByText(followUp, { exact: true }).isVisible());

    await page.setViewportSize({ width: 880, height: 900 });
    await verifyLayout('docked');

    async function verifyReset(preservedDraft) {
      await newChat.click();
      await newChat.waitFor({ state: 'detached' });
      await page.waitForFunction(() => document.activeElement?.matches('.vd-ai-drawer[open] textarea'));
      assert.equal((await conversation.innerText()).trim(), '');
      assert.equal(await conversation.getAttribute('aria-busy'), 'false');
      assert.equal(await input.inputValue(), preservedDraft);
      assert.equal(await drawer.evaluate((node, original) => node === original, rendered), true);
      await verifyLayout('docked');
    }

    const floating = heading.getByRole('button', { name: '切换为悬浮窗口' });
    assert((await newChat.boundingBox()).x < (await floating.boundingBox()).x);
    assert((await floating.boundingBox()).x < (await close.boundingBox()).x);
    assert.equal((await newChat.innerText()).trim(), '');
    assert.equal((await heading.innerText()).trim(), '文档助手');
    assert((await heading.boundingBox()).height <= 64, 'Assistant heading should fit a compact single row');
    assert.equal(await drawer.locator('.vd-ai-compose .vd-ai-new-chat').count(), 0);
    const nextQuestion = '新会话的第一个问题';
    await input.fill(nextQuestion);
    await verifyReset(nextQuestion);
    await input.press('Enter');
    await conversation.getByText(followUp, { exact: true }).waitFor();
    await drawer.locator('[role="log"][aria-busy="false"]').waitFor();
    assert.deepEqual(requests[2].messages.map(({ role, parts }) => [role, parts[0]?.text]), [['user', nextQuestion]]);

    const partial = '这段回答仍在生成。';
    await page.evaluate(({ endpoint, partialText }) => {
      const originalFetch = window.fetch;
      window.fetch = (resource, init) => {
        if (typeof resource !== 'string' || !resource.endsWith(endpoint)) return originalFetch(resource, init);
        window.fetch = originalFetch;
        const stream = new ReadableStream({
          start(controller) {
            const parts = [{ type: 'start' }, { type: 'text-start', id: 'partial' },
              { type: 'text-delta', id: 'partial', delta: partialText }];
            controller.enqueue(new TextEncoder().encode(parts.map(part => 'data: ' + JSON.stringify(part) + '\n\n').join('')));
            init.signal.addEventListener('abort', () => {
              document.documentElement.dataset.testChatStreamAborted = 'true';
              controller.error(init.signal.reason);
            }, { once: true });
          },
        });
        return Promise.resolve(new Response(stream, {
          headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
        }));
      };
    }, { endpoint: basePath + '/api/ask/', partialText: partial });
    await input.fill('测试正在生成的回答');
    await input.press('Enter');
    await conversation.getByText(partial, { exact: true }).waitFor();
    assert.equal(await conversation.getAttribute('aria-busy'), 'true');
    assert.equal(await newChat.isEnabled(), true);
    const streamingDraft = '生成期间输入的草稿';
    await input.fill(streamingDraft);
    await verifyReset(streamingDraft);
    await page.waitForFunction(() => document.documentElement.dataset.testChatStreamAborted === 'true');
    assert.equal((await conversation.innerText()).trim(), '');

    await page.reload();
    await page.getByRole('button', { name: '问 AI', exact: true }).click();
    await verifyLayout('docked');
    console.log('Verified assistant placement, navigation, follow-up context and new conversations under ' + (basePath || '/'));
  } finally {
    await browser.close();
  }
}

export async function verifyAssistantServer(site, env) {
  // Start Next directly so the owned PID is the production server. Let the OS select the port.
  const server = spawn(process.execPath, [join(site, 'node_modules/next/dist/bin/next'), 'start',
    '--hostname', '127.0.0.1', '--port', '0'], {
    cwd: site, env: { ...env, VARYDOCS_AI_REQUESTS_PER_MINUTE: '4' }, stdio: ['ignore', 'pipe', 'inherit'],
  });
  const closed = new Promise(resolve => server.once('close', resolve));
  const cancelled = new AbortController();
  const interrupt = () => cancelled.abort(new Error('Assistant smoke test interrupted'));
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  const signal = AbortSignal.any([cancelled.signal, AbortSignal.timeout(60_000)]);
  const events = [];
  try {
    const origin = await new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      server.once('error', reject);
      server.once('exit', (code, reason) => reject(new Error('Next server exited: ' + (reason ?? code))));
      const lines = createInterface({ input: server.stdout });
      lines.on('line', line => {
        const event = /^\[varydocs:assistant\] (.+)$/u.exec(line);
        if (event) events.push(JSON.parse(event[1]));
        else console.log(line);
        const local = /Local:\s+(http:\/\/127\.0\.0\.1:\d+)\s*$/u.exec(line);
        if (local) resolve(local[1]);
      });
    });
    await checkAssistant(origin, env.VARYDOCS_BASE_PATH, signal, events);
    console.log('Verified bilingual assistant SSE, citations, feedback, usage and rate limits under ' + env.VARYDOCS_BASE_PATH);
    if (env.VARYDOCS_SMOKE_ASSISTANT_BROWSER === '1') await verifyAssistantBrowser(origin, env.VARYDOCS_BASE_PATH);
  } finally {
    server.kill('SIGTERM');
    const forceStop = setTimeout(() => server.kill('SIGKILL'), 5_000).unref();
    await closed;
    clearTimeout(forceStop);
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', interrupt);
  }
}
