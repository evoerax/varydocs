'use client';

import { useEffect, useRef, useState } from 'react';
import type { Heading } from '@varydocs/model';

interface ReaderOutlineProps {
  headings: readonly Readonly<Heading>[];
  label: string;
  track?: boolean;
}

function fragmentId(hash: string) {
  if (!hash.startsWith('#') || hash.length < 2) return;
  try { return decodeURIComponent(hash.slice(1)); } catch { return; }
}

export function ReaderOutline({ headings, label, track = true }: ReaderOutlineProps) {
  const outline = useRef<HTMLElement>(null);
  const [activeId, setActiveId] = useState<string>();

  useEffect(() => {
    const nav = outline.current;
    const shell = nav?.closest<HTMLElement>('.dt-shell');
    if (!track || !nav || !shell) return;

    const article = Array.from(shell.querySelectorAll<HTMLElement>('.dt-article'))
      .find(element => element.closest('.dt-shell') === shell);
    if (!article) return;

    const headingIds = new Set(headings.map(heading => heading.id));
    const targets = Array.from(article.querySelectorAll<HTMLElement>('[id]'))
      .filter(element => headingIds.has(element.id) && element.closest('.dt-shell') === shell);
    const topbar = shell.querySelector<HTMLElement>(':scope > .dt-reader-topbar');
    let fragment = fragmentId(window.location.hash);
    let fragmentScrollTop: number | undefined;
    let frame: number | undefined;
    let previous: string | undefined | null = null;

    function update() {
      frame = undefined;
      const scroller = document.scrollingElement;
      const scrollTop = scroller?.scrollTop ?? window.scrollY;
      const viewportHeight = window.innerHeight;
      const scrollLimit = scroller ? scroller.scrollHeight - scroller.clientHeight : 0;
      const atBottom = scrollLimit > 1 && scrollTop >= scrollLimit - 1;
      const coveredHeight = Math.max(0, topbar?.getBoundingClientRect().bottom ?? 0);
      const readingLine = coveredHeight + 24;
      let current: string | undefined;
      let lastInView: string | undefined;
      let hashInView = false;

      for (const target of targets) {
        const { top, bottom, height } = target.getBoundingClientRect();
        if (!height) continue;
        if (current === undefined || top <= readingLine) current = target.id;
        if (top < viewportHeight) lastInView = target.id;
        if (target.id === fragment && bottom > coveredHeight && top < viewportHeight) hashInView = true;
      }

      if (atBottom && lastInView) current = lastInView;

      // A fragment can be visible near the bottom without reaching the reading line.
      // Respect that explicit jump until the reader scrolls again.
      if (fragment && hashInView && (fragmentScrollTop === undefined || Math.abs(scrollTop - fragmentScrollTop) <= 1)) {
        fragmentScrollTop ??= scrollTop;
        current = fragment;
      } else {
        fragment = undefined;
      }

      if (current === previous) return;
      previous = current;
      setActiveId(current);
    }

    function schedule() {
      if (frame === undefined) frame = window.requestAnimationFrame(update);
    }

    function followHash(hash: string) {
      fragment = fragmentId(hash);
      fragmentScrollTop = undefined;
      schedule();
    }

    function hashChanged() {
      followHash(window.location.hash);
    }

    function outlineClicked(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element && event.target.closest<HTMLAnchorElement>('a[href^="#"]');
      if (link) followHash(link.hash);
    }

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('hashchange', hashChanged);
    nav.addEventListener('click', outlineClicked);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : undefined;
    observer?.observe(article);
    if (topbar) observer?.observe(topbar);
    schedule();

    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('hashchange', hashChanged);
      nav.removeEventListener('click', outlineClicked);
    };
  }, [headings, track]);

  return <nav ref={outline} className="dt-outline" aria-label={label}>
    <p>{label}</p>
    <ul>{headings.map(heading => <li key={heading.id} data-level={heading.level}>
      <a href={'#' + encodeURIComponent(heading.id)}
        aria-current={track && activeId === heading.id ? 'location' : undefined}>{heading.title}</a>
    </li>)}</ul>
  </nav>;
}
