import { useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import type { UIMessage } from 'ai';
import { Icon } from './icons.js';

type Source = Extract<UIMessage['parts'][number], { type: 'source-url' }>;
type Navigate = (event: MouseEvent<HTMLAnchorElement>, url: string) => void;
type MessageLabels = {
  you: string;
  assistant: string;
  sources: string;
  excerpts: string;
  search: { found: string; empty: string };
};
type Rating = 'up' | 'down';
type FeedbackLabels = Record<'prompt' | Rating | 'sending' | 'recorded' | 'failed' | 'expired' | 'limited', string>;
interface FeedbackOptions {
  endpoint: string;
  labels: FeedbackLabels;
}
type FeedbackState = { status: 'sending' | 'recorded'; rating: Rating } |
  { status: 'failed' | 'expired' | 'limited' };

function internalLink(url: string) {
  return url.startsWith('/') && !url.startsWith('//') && !/[\\\u0000-\u0020\u007f]/u.test(url);
}

function readExcerpts(metadata: unknown, sources: Source[]) {
  if (!metadata || typeof metadata !== 'object' || !('varydocsExcerpts' in metadata)) return;
  const items = metadata.varydocsExcerpts;
  if (!Array.isArray(items) || !sources.length || items.length !== sources.length) return;
  const remaining = new Map(sources.map(source => [source.sourceId, source]));
  const excerpts = [];
  for (const item of items) {
    if (!item || typeof item.text !== 'string') return;
    const source = remaining.get(item.sourceId);
    if (!source) return;
    remaining.delete(source.sourceId);
    excerpts.push({ source, text: item.text });
  }
  return excerpts;
}

function documentSearchLabel(message: UIMessage, labels: MessageLabels['search']) {
  if (message.role !== 'assistant') return;
  const part = message.parts.find(part => part.type === 'data-varydocs-document-search');
  if (!part || !('data' in part) || !part.data || typeof part.data !== 'object' || !('matches' in part.data)) return;
  const { matches } = part.data;
  if (typeof matches !== 'number' || !Number.isSafeInteger(matches) || matches < 0) return;
  return matches === 0 ? labels.empty : labels.found;
}

function navigate(event: MouseEvent<HTMLAnchorElement>, url: string, onNavigate?: Navigate) {
  if (event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  onNavigate?.(event, url);
}

function SourceLink({ source, onNavigate }: { source: Source; onNavigate?: Navigate }) {
  return <a href={source.url} onClick={event => navigate(event, source.url, onNavigate)}>
    <Icon name="book" /><span>{source.title || source.url}</span>
  </a>;
}

function renderInline(text: string, sources: Map<string, Source>, onNavigate?: Navigate) {
  const parts = [];
  let offset = 0;
  // Consume code spans first so citation syntax inside an example remains literal.
  for (const match of text.matchAll(/(?<!`)(`+)(?!`)([^\n]*?)(?<!`)\1(?!`)|\[([^\[\]\n]+)\]\(source:([1-9]\d*)\)/gu)) {
    const [syntax, ticks, code, label, sourceId] = match;
    parts.push(text.slice(offset, match.index));
    if (ticks) {
      parts.push(<code key={match.index}>{code}</code>);
    } else {
      const source = sources.get(sourceId);
      parts.push(source && label.trim() ? <a key={match.index} className="vd-ai-inline-source" href={source.url}
        onClick={event => navigate(event, source.url, onNavigate)}>{label}</a> : label);
    }
    offset = match.index + syntax.length;
  }
  parts.push(text.slice(offset));
  return parts;
}

function AnswerText({ text, sources, onNavigate }: { text: string; sources: Source[]; onNavigate?: Navigate }) {
  const byId = new Map(sources.map(source => [source.sourceId, source]));
  return <div className="vd-ai-answer-text">{text.split(/^```[^\n]*\n?/gmu).map((block, index) =>
    index % 2 === 1 ? <pre key={index}><code>{block.replace(/\n$/u, '')}</code></pre> :
      block.split(/\n\s*\n/u).filter(paragraph => paragraph.trim()).map((paragraph, position) =>
        <p key={index + '-' + position}>{renderInline(paragraph.trim(), byId, onNavigate)}</p>),
  )}</div>;
}

function Feedback({ endpoint, labels, responseId }: FeedbackOptions & { responseId: string }) {
  const [vote, setVote] = useState<FeedbackState>();
  const pending = useRef(false);
  const locked = vote?.status === 'sending' || vote?.status === 'recorded' || vote?.status === 'expired';

  async function submit(rating: Rating) {
    if (locked || pending.current) return;
    pending.current = true;
    setVote({ status: 'sending', rating });
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'feedback', responseId, rating }),
      });
      if (response.status === 204) setVote({ status: 'recorded', rating });
      else if (response.status === 404 || response.status === 409) setVote({ status: 'expired' });
      else setVote({ status: response.status === 429 ? 'limited' : 'failed' });
    } catch {
      setVote({ status: 'failed' });
    } finally {
      pending.current = false;
    }
  }

  return <div className="vd-ai-feedback" role="group" aria-label={labels.prompt}>
    <span>{labels.prompt}</span>
    {(['up', 'down'] as const).map(rating => <button key={rating} className="vd-ai-icon-button" type="button"
      aria-label={labels[rating]} title={labels[rating]} aria-disabled={locked}
      aria-pressed={vote?.status === 'recorded' && vote.rating === rating} onClick={() => { void submit(rating); }}>
      <Icon name={rating} />
    </button>)}
    <span className="vd-ai-feedback-status" role="status">{vote && labels[vote.status]}</span>
  </div>;
}

export function Message({ message, labels, onNavigate, feedback }: {
  message: UIMessage;
  labels: MessageLabels;
  onNavigate?: Navigate;
  feedback?: FeedbackOptions;
}) {
  const fromUser = message.role === 'user';
  const text = message.parts.filter(part => part.type === 'text').map(part => part.text).join('\n');
  const sources = fromUser ? [] : message.parts.filter(part => part.type === 'source-url').filter(part => internalLink(part.url));
  const documentSearch = documentSearchLabel(message, labels.search);
  if (!text && !sources.length && !documentSearch) return null;
  const excerpts = readExcerpts(message.metadata, sources);
  const references = new Map(sources.map(source => [source.url, source]));
  const metadata = message.metadata;
  const responseId = !fromUser && metadata && typeof metadata === 'object' && 'responseId' in metadata &&
    typeof metadata.responseId === 'string' ? metadata.responseId : undefined;
  return <div className={fromUser ? 'vd-ai-question' : 'vd-ai-answer'}>
    <span className="vd-ai-sr">{fromUser ? labels.you : labels.assistant}</span>
    {documentSearch && <p className="vd-ai-document-search"><Icon name="book" />{documentSearch}</p>}
    {fromUser ? <p>{text}</p> : excerpts ? <div className="vd-ai-excerpts">
      <p>{labels.excerpts}</p>
      <ol>{excerpts.map(({ source, text }) => <li key={source.sourceId}>
        <SourceLink source={source} onNavigate={onNavigate} />
        <p>{text}</p>
      </li>)}</ol>
    </div> : <>
      <AnswerText text={text} sources={sources} onNavigate={onNavigate} />
      {references.size > 0 && <div className="vd-ai-sources">
        <p>{labels.sources}</p>
        <ul>{Array.from(references.values(), source => <li key={source.url}>
          <SourceLink source={source} onNavigate={onNavigate} />
        </li>)}</ul>
      </div>}
    </>}
    {feedback && responseId && <Feedback key={responseId} {...feedback} responseId={responseId} />}
  </div>;
}
