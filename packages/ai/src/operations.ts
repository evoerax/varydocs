import { randomUUID } from 'node:crypto';
import type { LanguageModelUsage } from 'ai';

type Rating = 'up' | 'down';
type Status = 'completed' | 'error' | 'aborted';
type Usage = Pick<LanguageModelUsage, 'inputTokens' | 'outputTokens' | 'totalTokens'>;
type ChatContext = {
  locale: string;
  pageId: string;
  mode: 'model' | 'excerpts' | 'no-match';
  model?: string;
};
type EventContext = ChatContext & { responseId: string; timestamp: string };

export type DocsChatEvent = EventContext & (
  | { type: 'usage'; status: Status; elapsedMs: number; inputTokens: number | null;
      outputTokens: number | null; totalTokens: number | null }
  | { type: 'feedback'; rating: Rating }
);

export interface DocsChatOperationsOptions {
  /** Number of chat requests accepted per rolling minute in one handler instance. Defaults to 30. */
  requestsPerMinute?: number;
  /** Receives metadata only. The default sink writes a JSON line to stdout. */
  onEvent?: (event: DocsChatEvent) => void | Promise<void>;
}

interface FeedbackTarget {
  context: ChatContext;
  expiresAt: number;
  rating?: Rating;
  pending?: { rating: Rating; saved: Promise<boolean> };
}

const minuteMs = 60_000;
const feedbackLifetime = 30 * minuteMs;
const maxFeedbackTargets = 2048;

function rollingMinute(capacity: number) {
  const accepted: number[] = [];
  return () => {
    const now = performance.now();
    while (accepted.length && accepted[0] <= now - minuteMs) accepted.shift();
    if (accepted.length < capacity) {
      accepted.push(now);
      return;
    }
    return new Response(null, { status: 429, headers: {
      'Retry-After': String(Math.max(1, Math.ceil((accepted[0] + minuteMs - now) / 1000))),
      'Cache-Control': 'no-store',
    } });
  };
}

export function createChatOperations({
  requestsPerMinute = 30, onEvent = event => console.info(JSON.stringify(event)),
}: DocsChatOperationsOptions) {
  if (!Number.isSafeInteger(requestsPerMinute) || requestsPerMinute < 1) {
    throw new RangeError('requestsPerMinute must be a positive safe integer.');
  }
  const limitChat = rollingMinute(requestsPerMinute);
  const limitFeedback = rollingMinute(60);
  const feedbackTargets = new Map<string, FeedbackTarget>();

  async function record(event: DocsChatEvent) {
    try {
      await onEvent(event);
      return true;
    } catch {
      console.warn('[VaryDocs] Failed to record assistant ' + event.type + '.');
      return false;
    }
  }

  function begin(context: ChatContext) {
    const responseId = randomUUID();
    const started = performance.now();
    let recorded: Promise<boolean> | undefined;
    return {
      complete(status: Status, usage?: Usage) {
        const usedModel = context.mode === 'model';
        recorded ??= record({
          type: 'usage', ...context, responseId, timestamp: new Date().toISOString(), status,
          elapsedMs: Math.round(performance.now() - started),
          inputTokens: usedModel ? usage?.inputTokens ?? null : 0,
          outputTokens: usedModel ? usage?.outputTokens ?? null : 0,
          totalTokens: usedModel ? usage?.totalTokens ?? null : 0,
        });
        return recorded;
      },
      feedbackMetadata() {
        if (feedbackTargets.size >= maxFeedbackTargets) {
          const oldest = feedbackTargets.keys().next().value;
          if (oldest) feedbackTargets.delete(oldest);
        }
        feedbackTargets.set(responseId, { context, expiresAt: performance.now() + feedbackLifetime });
        return { responseId };
      },
    };
  }

  async function feedback(responseId: string, rating: Rating) {
    const rejected = limitFeedback();
    if (rejected) return rejected;
    const target = feedbackTargets.get(responseId);
    if (!target || target.expiresAt <= performance.now()) {
      feedbackTargets.delete(responseId);
      return new Response(null, { status: 404 });
    }
    if (target.rating === rating) return new Response(null, { status: 204 });
    if (target.rating || (target.pending && target.pending.rating !== rating)) {
      return new Response(null, { status: 409 });
    }
    target.pending ??= { rating, saved: record({
      type: 'feedback', ...target.context, responseId, timestamp: new Date().toISOString(), rating,
    }) };
    const saved = await target.pending.saved;
    if (saved) target.rating = rating;
    target.pending = undefined;
    return new Response(null, { status: saved ? 204 : 503 });
  }

  return { limitChat, begin, feedback };
}
