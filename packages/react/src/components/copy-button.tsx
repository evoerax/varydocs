'use client';

import { useEffect, useRef, useState } from 'react';
import { useDocsLanguage } from '../language.js';

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const { messages } = useDocsLanguage();
  const [status, setStatus] = useState<'ready' | 'copied' | 'error'>('ready');
  const reset = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (reset.current) clearTimeout(reset.current); }, []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus('copied');
    } catch {
      setStatus('error');
    }
    if (reset.current) clearTimeout(reset.current);
    reset.current = setTimeout(() => setStatus('ready'), 1800);
  }
  return <button className="dt-copy" onClick={copy} type="button" aria-label={label ?? messages.copyCode}>
    <span aria-live="polite">{status === 'copied' ? messages.copied : status === 'error' ? messages.copyFailed : messages.copy}</span>
  </button>;
}
