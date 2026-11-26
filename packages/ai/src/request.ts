import type { UIMessage } from 'ai';

export const maxBodyBytes = 96 * 1024;
export const maxMessages = 12;
export const maxQuestionLength = 2000;
export const maxAnswerLength = 8000;

/** Keep the most recent turns that fit the endpoint's serialized request limit. */
export function prepareChatBody(locale: string, pageId: string, history: UIMessage[]) {
  const messages: { role: 'user' | 'assistant'; parts: { type: 'text'; text: string }[] }[] = [];
  const body = { locale, pageId, messages };
  const encoder = new TextEncoder();
  let bytes = encoder.encode(JSON.stringify(body)).length;
  for (let i = history.length - 1; i >= 0 && messages.length < maxMessages; i--) {
    const { role, parts } = history[i];
    if (role !== 'user' && role !== 'assistant') continue;
    const limit = role === 'user' ? maxQuestionLength : maxAnswerLength;
    const text = parts.flatMap(part => part.type === 'text' ? [part.text] : [])
      .join('\n').trim().slice(0, limit).replace(/[\uD800-\uDBFF]$/u, '');
    if (!text) continue;
    const message = { role, parts: [{ type: 'text' as const, text }] };
    bytes += encoder.encode(JSON.stringify(message)).length + (messages.length ? 1 : 0);
    if (bytes > maxBodyBytes) break;
    messages.unshift(message);
  }
  while (messages[0]?.role === 'assistant') messages.shift();
  return body;
}
