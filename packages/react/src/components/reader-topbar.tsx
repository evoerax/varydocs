'use client';

import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export function ReaderTopbar({ children }: { children: ReactNode }) {
  const bar = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = bar.current;
    const shell = node?.closest<HTMLElement>('.dt-shell');
    if (!node || !shell) return;

    const property = '--dt-reader-header-size';
    const update = () => {
      const bounds = node.getBoundingClientRect();
      const size = Math.ceil(bounds.height) + 'px';
      if (shell.style.getPropertyValue(property) === size) return;
      shell.style.setProperty(property, size);

      // A server-rendered fragment can scroll before a wrapped header is measured.
      if (!window.location.hash) return;
      let id: string;
      try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
      const target = document.getElementById(id);
      if (!target || !shell.contains(target) || !target.closest('.dt-article') || !target.getClientRects().length) return;
      const top = target.getBoundingClientRect().top;
      if (top >= 0 && top < bounds.bottom) target.scrollIntoView({ block: 'start' });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => {
      observer.disconnect();
      shell.style.removeProperty(property);
    };
  }, []);

  return <div className="dt-reader-topbar" ref={bar}>{children}</div>;
}
