'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { useChat } from '@ai-sdk/react';
import { APICallError, DefaultChatTransport } from 'ai';
import { Message } from './message.js';
import type { AskAIProps } from './index.js';
import { Icon } from './icons.js';
import { maxQuestionLength, prepareChatBody } from './request.js';

const en = {
  welcome: 'What would you like to know?', summary: 'Summarize this page',
  newChat: 'New chat',
  placeholder: 'Ask about the docs…', send: 'Send question', stop: 'Stop response',
  loading: 'Reading the docs…', conversation: 'Conversation', you: 'You', assistant: 'Docs assistant',
  sources: 'Sources', excerpts: 'Documentation excerpts', error: 'The reply was interrupted.', stopped: 'Response stopped.', retry: 'Try again',
  search: { found: 'Checked additional documentation', empty: 'No additional sections found' },
  limited: 'Too many questions right now. Try again in a moment.',
  feedback: {
    prompt: 'Was this answer helpful?', up: 'Helpful', down: 'Not helpful', sending: 'Sending feedback…',
    recorded: 'Thanks for your feedback.', failed: 'Couldn’t send feedback. Select a rating to try again.',
    expired: 'Feedback is closed for this answer.', limited: 'Too many ratings right now. Try again in a moment.',
  },
};
const zh: typeof en = {
  welcome: '你想了解什么？', summary: '概括这一页',
  newChat: '新对话',
  placeholder: '向文档提问…', send: '发送问题', stop: '停止回答',
  loading: '正在查阅文档…', conversation: '对话记录', you: '你', assistant: '文档助手',
  sources: '参考文档', excerpts: '相关文档摘录', error: '回答中断了。', stopped: '已停止回答。', retry: '重试',
  search: { found: '已补查文档', empty: '补查未找到相关章节' },
  limited: '提问太频繁，请稍后重试。',
  feedback: {
    prompt: '这条回答有用吗？', up: '有用', down: '没有用', sending: '正在发送反馈…',
    recorded: '感谢反馈。', failed: '反馈发送失败，请重新选择评分。', expired: '这条回答已无法提交反馈。',
    limited: '反馈发送太频繁，请稍后重试。',
  },
};

interface ChatPanelProps extends AskAIProps {
  active: boolean;
  renderHeading: (newChat?: ReactNode) => ReactNode;
  onNavigate: ComponentProps<typeof Message>['onNavigate'];
}

export function ChatPanel(props: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const [session, setSession] = useState(0);
  return <ChatSession key={session} {...props} draft={draft} setDraft={setDraft}
    onNewChat={() => setSession(value => value + 1)} />;
}

function ChatSession({
  endpoint, pageId, locale, headings = [], active, onNavigate, renderHeading, draft, setDraft, onNewChat,
}: ChatPanelProps & {
  draft: string;
  setDraft: (draft: string) => void;
  onNewChat: () => void;
}) {
  const chinese = /^zh(?:-|$)/i.test(locale);
  const labels = chinese ? zh : en;
  const topics = [...new Set(headings.map(title => title.trim()).filter(Boolean))].slice(0, 2);
  const suggestions = [labels.summary, ...topics.map(title => chinese ? '讲讲「' + title + '」' : 'Explain “' + title + '”')];
  const transport = useMemo(() => new DefaultChatTransport({
    api: endpoint,
    prepareSendMessagesRequest: ({ messages }) => ({ body: prepareChatBody(locale, pageId, messages) }),
  }), [endpoint, locale, pageId]);
  const [stopped, setStopped] = useState(false);
  const { messages, status, error, sendMessage, stop, regenerate, clearError } = useChat({
    transport, onFinish: result => { if (result.isAbort) setStopped(true); },
  });
  const busy = status === 'streaming' || status === 'submitted';
  const rateLimited = APICallError.isInstance(error) && error.statusCode === 429;
  const errorMessage = rateLimited ? labels.limited : labels.error;
  const textarea = useRef<HTMLTextAreaElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const following = useRef(true);

  useEffect(() => {
    if (active) textarea.current?.focus({ preventScroll: true });
    return () => { void stop(); };
  }, [active, stop]);

  useEffect(() => {
    if (active && messages.length && following.current && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [active, messages, status]);

  function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    following.current = true;
    setDraft('');
    setStopped(false);
    clearError();
    void sendMessage({ text: question });
    textarea.current?.focus();
  }

  return <>
    {renderHeading(messages.length > 0 ? <button type="button" className="vd-ai-icon-button vd-ai-new-chat"
      aria-label={labels.newChat} title={labels.newChat} onClick={onNewChat}>
      <Icon name="newChat" />
    </button> : undefined)}
    <div ref={scroll} className="vd-ai-scroll" onScroll={event => {
      const pane = event.currentTarget;
      following.current = pane.scrollHeight - pane.clientHeight - pane.scrollTop < 64;
    }}>
      {messages.length === 0 && <div className="vd-ai-welcome">
        <h3>{labels.welcome}</h3>
        <ul className="vd-ai-suggestions">{suggestions.map(question => <li key={question}>
          <button type="button" className="vd-ai-suggestion" onClick={() => send(question)}>
            <Icon name="book" /><span>{question}</span><Icon name="arrow" />
          </button>
        </li>)}</ul>
      </div>}
      <div className="vd-ai-conversation" role="log" aria-label={labels.conversation} aria-busy={busy}>
        {messages.map(message => <Message key={message.id} message={message} labels={labels} onNavigate={onNavigate}
          feedback={busy && message === messages.at(-1) ? undefined : { endpoint, labels: labels.feedback }} />)}
      </div>
      {status === 'submitted' && <p className="vd-ai-status" role="status">{labels.loading}</p>}
      {!busy && (error || stopped) && <div className="vd-ai-error">
        <p role={error ? 'alert' : 'status'}>{error ? errorMessage : labels.stopped}</p>
        <button type="button" className="vd-ai-retry" onClick={() => {
          following.current = true;
          setStopped(false);
          clearError();
          void regenerate();
        }}>{labels.retry}</button>
      </div>}
    </div>
    <form className="vd-ai-compose" onSubmit={event => { event.preventDefault(); send(draft); }}>
      <div className="vd-ai-input">
        <textarea ref={textarea} rows={2} maxLength={maxQuestionLength} value={draft} aria-label={labels.placeholder}
          placeholder={labels.placeholder} onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
              event.preventDefault();
              send(draft);
            }
          }} />
        {busy ? <button key="stop" type="button" className="vd-ai-send" aria-label={labels.stop} title={labels.stop} onClick={() => {
          setStopped(true);
          void stop();
        }}>
          <Icon name="stop" />
        </button> : <button key="send" type="submit" className="vd-ai-send" aria-label={labels.send} title={labels.send} disabled={!draft.trim()}>
          <Icon name="send" />
        </button>}
      </div>
    </form>
  </>;
}
