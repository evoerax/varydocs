'use client';

import { Children, isValidElement, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { useDocsLanguage } from '../language.js';

interface TabProps { title: string; children?: ReactNode }

export function Tab({ children }: TabProps) { return children; }

export function Tabs({ children }: { children?: ReactNode }) {
  const { messages } = useDocsLanguage();
  const id = useId();
  const [selected, setSelected] = useState(0);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const panels = useRef<Array<HTMLDivElement | null>>([]);
  const scrollTarget = useRef<HTMLElement | null>(null);
  const tabs = Children.toArray(children).filter(isValidElement<TabProps>);

  useEffect(() => {
    function reveal() {
      if (!window.location.hash) return;
      let anchor: string;
      try { anchor = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
      const target = document.getElementById(anchor);
      if (!target) return;
      const index = panels.current.findIndex(panel => panel?.hidden && panel.contains(target));
      if (index >= 0) {
        scrollTarget.current = target;
        setSelected(index);
      }
    }
    function sameFragment(event: MouseEvent) {
      if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (link instanceof HTMLAnchorElement && link.href === window.location.href) reveal();
    }
    reveal();
    window.addEventListener('hashchange', reveal);
    document.addEventListener('click', sameFragment);
    return () => {
      window.removeEventListener('hashchange', reveal);
      document.removeEventListener('click', sameFragment);
    };
  }, [tabs.length]);

  useEffect(() => {
    if (scrollTarget.current && !scrollTarget.current.closest('[hidden]')) {
      scrollTarget.current.scrollIntoView();
      scrollTarget.current = null;
    }
  }, [selected]);

  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    switch (event.key) {
      case 'ArrowLeft': next = (index + tabs.length - 1) % tabs.length; break;
      case 'ArrowRight': next = (index + 1) % tabs.length; break;
      case 'Home': next = 0; break;
      case 'End': next = tabs.length - 1; break;
      default: return;
    }
    event.preventDefault();
    scrollTarget.current = null;
    setSelected(next);
    buttons.current[next]?.focus();
  }
  return <div className="dt-tabs">
    <div role="tablist" aria-label={messages.examples}>
      {tabs.map((tab, index) => <button key={tab.key} type="button" role="tab"
        ref={element => { buttons.current[index] = element; }}
        id={id + '-tab-' + index} aria-controls={id + '-panel-' + index}
        aria-selected={selected === index} tabIndex={selected === index ? 0 : -1}
        onClick={() => { scrollTarget.current = null; setSelected(index); }} onKeyDown={event => move(event, index)}>
        {tab.props.title}
      </button>)}
    </div>
    {tabs.map((tab, index) => <div key={tab.key} role="tabpanel" hidden={selected !== index}
      ref={element => { panels.current[index] = element; }}
      id={id + '-panel-' + index} aria-labelledby={id + '-tab-' + index} tabIndex={0}>
      {tab.props.children}
    </div>)}
  </div>;
}
