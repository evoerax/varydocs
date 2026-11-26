'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { SearchDocument } from '@varydocs/model';
import { createDocumentSearch } from '@varydocs/model/search';
import { useDocsLanguage } from '../language.js';

export interface DocSearchProps {
  indexUrl?: string;
  documents?: SearchDocument[];
  hrefs: Record<string, string>;
}

export function DocSearch({ indexUrl, documents, hrefs }: DocSearchProps) {
  const { locale, messages } = useDocsLanguage();
  const title = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const resultList = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loaded, setLoaded] = useState<{ url: string; documents: SearchDocument[] }>();
  const [failedUrl, setFailedUrl] = useState<string>();
  const data = documents ?? (loaded?.url === indexUrl ? loaded?.documents : undefined);
  const search = useMemo(() => data && createDocumentSearch(data, locale), [data, locale]);
  const error = !documents && indexUrl && failedUrl === indexUrl;

  function show() {
    if (!dialog.current || dialog.current.open) return;
    setQuery('');
    dialog.current.showModal();
    setOpen(true);
    input.current?.focus();
  }
  useEffect(() => {
    const shortcut = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      show();
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);
  useEffect(() => {
    if (!open || documents || !indexUrl || loaded?.url === indexUrl) return;
    const abort = new AbortController();
    setFailedUrl(undefined);
    fetch(indexUrl, { signal: abort.signal, cache: 'no-cache' }).then(response => {
      if (!response.ok) throw new Error('Search unavailable');
      return response.json() as Promise<SearchDocument[]>;
    }).then(entries => {
      if (!abort.signal.aborted) setLoaded({ url: indexUrl, documents: entries });
    }).catch(() => {
      if (!abort.signal.aborted) setFailedUrl(indexUrl);
    });
    return () => abort.abort();
  }, [open, documents, indexUrl, loaded?.url]);

  function navigateResults(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || event.defaultPrevented ||
        event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      dialog.current?.close();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter') return;
    const links = Array.from(resultList.current?.querySelectorAll<HTMLAnchorElement>('a[href]') ?? []);
    if (!links.length) return;
    const searchFocused = event.target === input.current;
    const current = links.findIndex(link => link === event.target);
    if (!searchFocused && current === -1) return;

    if (event.key === 'Enter') {
      if (searchFocused) {
        event.preventDefault();
        links[0].click();
      }
      return;
    }

    event.preventDefault();
    const target = event.key === 'ArrowDown' ? current + 1 : searchFocused ? links.length - 1 : current - 1;
    (links[target] ?? input.current)?.focus();
  }

  const results = search ? search(query).slice(0, 9).map(hit => hit.doc) : [];
  return <>
    <button className="dt-search-button" type="button" onClick={show}
      aria-haspopup="dialog" aria-keyshortcuts="Control+k Meta+k">
      {messages.search} <kbd aria-hidden="true">⌘ K</kbd>
    </button>
    <dialog className="dt-search" ref={dialog} aria-labelledby={title} onKeyDown={navigateResults}
      onClose={() => { if (!dialog.current?.open) setOpen(false); }}>
      <div className="dt-search-top">
        <label id={title} htmlFor={title + '-query'}>{messages.searchTitle}</label>
        <button type="button" onClick={() => dialog.current?.close()}>{messages.close}</button>
      </div>
      <input ref={input} id={title + '-query'} type="search" value={query}
        placeholder={messages.searchPlaceholder} aria-describedby={results.length ? title + '-keys' : undefined}
        onChange={event => setQuery(event.target.value)} />
      <div className="dt-search-results">
        {error ? <p role="status">{messages.searchError}</p> :
          !data ? <p role="status">{messages.searchLoading}</p> :
          !query.trim() ? <p>{messages.searchHint}</p> :
          !results.length ? <p role="status">{messages.noResults.replace('{query}', () => query)}</p> :
          <><p id={title + '-keys'} className="dt-search-keys">{messages.searchKeyboardHint}</p>
          <ul ref={resultList}>{results.map(doc => <li key={doc.id + '#' + (doc.anchor ?? '')}>
            <a href={hrefs[doc.id] + (doc.anchor ? '#' + encodeURIComponent(doc.anchor) : '')}
              onClick={() => dialog.current?.close()}>
              <strong>{doc.section ?? doc.title}</strong>
              {doc.section && <small>{doc.title}</small>}
            </a>
          </li>)}</ul></>}
      </div>
    </dialog>
  </>;
}
