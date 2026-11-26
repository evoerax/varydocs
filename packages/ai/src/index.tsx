'use client';

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { Icon } from './icons.js';
import type { ChatPanel } from './panel.js';

export interface AskAIProps {
  endpoint: string;
  locale: string;
  pageId: string;
  pageTitle: string;
  headings?: string[];
}

interface AssistantLayoutProps {
  children: ReactNode;
  /** Navigate to a same-origin document without remounting this layout. */
  navigate?: (href: string) => void;
}

interface AssistantControls {
  dialogId: string;
  open: boolean;
  register: (page: AskAIProps, trigger: HTMLButtonElement) => void;
  show: (pointer: boolean) => void;
}

const AssistantContext = createContext<AssistantControls | null>(null);
const placementKey = 'varydocs:assistant-placement';
const themeTokens = [
  'bg', 'panel', 'ink', 'muted', 'line', 'accent', 'radius', 'font', 'head', 'mono', 'code-bg',
].map(name => '--dt-' + name);

export function AssistantLayout(props: AssistantLayoutProps) {
  return <Assistant {...props} dockable />;
}

export function AskAI(props: AskAIProps) {
  const layout = useContext(AssistantContext);
  const trigger = <AssistantTrigger {...props} />;
  return layout ? trigger : <Assistant key={JSON.stringify([props.endpoint, props.locale])}>{trigger}</Assistant>;
}

function AssistantTrigger({ endpoint, locale, pageId, pageTitle, headings }: AskAIProps) {
  const controls = useContext(AssistantContext);
  const trigger = useRef<HTMLButtonElement>(null);
  const register = controls?.register;

  useLayoutEffect(() => {
    if (trigger.current) register?.({ endpoint, locale, pageId, pageTitle, headings }, trigger.current);
  }, [register, endpoint, locale, pageId, pageTitle, headings]);

  return <button type="button" ref={trigger} className="vd-ai-trigger" aria-haspopup="dialog" aria-expanded={controls?.open}
    aria-controls={controls?.dialogId} aria-keyshortcuts="Control+I Meta+I" onClick={event => controls?.show(event.detail > 0)}>
    <Icon name="assistant" />{/^zh(?:-|$)/i.test(locale) ? '问 AI' : 'Ask AI'}
  </button>;
}

function Assistant({ children, navigate, dockable = false }: AssistantLayoutProps & { dockable?: boolean }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [page, setPage] = useState<AskAIProps>();
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<'floating' | 'docked'>('floating');
  const [Panel, setPanel] = useState<typeof ChatPanel | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const zh = /^zh(?:-|$)/i.test(page?.locale ?? '');
  const isDocked = placement === 'docked';
  const placementLabel = isDocked
    ? (zh ? '切换为悬浮窗口' : 'Switch to floating')
    : (zh ? '切换为右侧并排' : 'Dock on the right');

  const register = useCallback((nextPage: AskAIProps, button: HTMLButtonElement) => {
    trigger.current = button;
    setPage(nextPage);
  }, []);

  useLayoutEffect(() => {
    if (!dockable) return;
    try {
      if (localStorage.getItem(placementKey) === 'docked') setPlacement('docked');
    } catch { /* Keep the default when browser storage is unavailable. */ }
  }, [dockable]);

  function togglePlacement() {
    const next = isDocked ? 'floating' : 'docked';
    setPlacement(next);
    try { localStorage.setItem(placementKey, next); } catch { /* Still switch for this session. */ }
  }

  useLayoutEffect(() => {
    if (!dockable || !page) return;
    const drawer = dialog.current;
    const shell = trigger.current?.closest('.dt-shell');
    if (!drawer || !shell) return;
    function apply() {
      if (!drawer || !shell) return;
      const style = getComputedStyle(shell);
      drawer.style.colorScheme = style.colorScheme;
      for (const property of themeTokens) drawer.style.setProperty(property, style.getPropertyValue(property));
    }
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(shell, { attributes: true, attributeFilter: ['data-doc-theme', 'data-vd-appearance'] });
    return () => observer.disconnect();
  }, [dockable, page]);

  function load() {
    setLoadFailed(false);
    void import('./panel.js').then(
      module => setPanel(() => module.ChatPanel),
      () => setLoadFailed(true),
    );
  }

  function show(pointer: boolean) {
    if (open) {
      dialog.current?.querySelector('textarea')?.focus({ preventScroll: true });
      return;
    }
    const previous = document.activeElement;
    returnFocus.current = !pointer && previous instanceof HTMLElement && previous !== document.body ? previous : trigger.current;
    setOpen(true);
    if (!Panel) load();
  }

  const close = useCallback(() => {
    setOpen(false);
    const target = returnFocus.current?.isConnected ? returnFocus.current : trigger.current;
    target?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || event.isComposing) return;
      if (open && event.key === 'Escape' && !document.querySelector('dialog:modal')) {
        event.preventDefault();
        close();
        return;
      }
      if (event.altKey || event.shiftKey || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'i') return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input,textarea,select,[role="textbox"],dialog[open]'))) return;
      event.preventDefault();
      trigger.current?.click();
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [close, open]);

  function navigateToSource(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (!navigate) return;
    const target = new URL(href, window.location.href);
    // Native fragment navigation also handles a repeated click and hidden MDX tabs.
    if (target.origin !== window.location.origin ||
        (target.pathname === window.location.pathname && target.search === window.location.search)) return;
    event.preventDefault();
    navigate(target.pathname + target.search + target.hash);
  }

  const renderHeading = (newChat?: ReactNode) => <div className="vd-ai-heading">
    <h2 id={id + '-title'}>{zh ? '文档助手' : 'Docs assistant'}</h2>
    <div className="vd-ai-heading-actions">
      {newChat}
      {dockable && <button type="button" className="vd-ai-icon-button vd-ai-placement" aria-label={placementLabel}
        title={placementLabel} onClick={togglePlacement}>
        <Icon name={isDocked ? 'floating' : 'docked'} />
      </button>}
      <button type="button" className="vd-ai-icon-button" aria-label={zh ? '关闭助手' : 'Close assistant'} onClick={close}>
        <Icon name="close" />
      </button>
    </div>
  </div>;

  const drawer = page && <dialog ref={dialog} id={id} open={open} className="vd-ai-drawer" data-placement={placement}
    lang={page.locale} aria-labelledby={id + '-title'}>
    {Panel ? <Panel key={JSON.stringify([page.endpoint, page.locale])} {...page} active={open}
      renderHeading={renderHeading} onNavigate={navigateToSource} /> : <>
      {renderHeading()}
      {open && <div className="vd-ai-loading">
        {loadFailed ? <><p role="alert">{zh ? '助手加载失败。' : 'The assistant could not load.'}</p>
          <button type="button" className="vd-ai-retry" onClick={load}>{zh ? '重试' : 'Try again'}</button></> :
          <p role="status">{zh ? '正在打开助手…' : 'Opening the assistant…'}</p>}
      </div>}
    </>}
  </dialog>;

  return <AssistantContext.Provider value={{ dialogId: id, open, register, show }}>
    {dockable ? <div className="vd-ai-layout"><div className="vd-ai-document">{children}</div>{drawer}</div> : <>{children}{drawer}</>}
  </AssistantContext.Provider>;
}
