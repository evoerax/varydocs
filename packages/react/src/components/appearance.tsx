'use client';

import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

const modes = ['system', 'light', 'dark'] as const;
type Appearance = typeof modes[number];
export interface AppearanceLabels {
  label: string;
  system: string;
  light: string;
  dark: string;
}

const en = { label: 'Appearance', system: 'System', light: 'Light', dark: 'Dark' };
const zh = { label: '外观', system: '跟随系统', light: '浅色', dark: '深色' };
const key = 'varydocs:appearance';
const legacyKey = 'varydocs:gta6:color-mode';
const icons: Record<Appearance, string> = {
  system: 'M9 21h6m-3-4v4M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  light: 'M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  dark: 'M20.9 13.35A8.9 8.9 0 1 1 10.65 3.1 7.2 7.2 0 0 0 20.9 13.35Z',
};

function isAppearance(value: unknown): value is Appearance {
  return value === 'system' || value === 'light' || value === 'dark';
}

function readPreference(shell: HTMLElement | null | undefined): Appearance {
  try {
    const stored = localStorage.getItem(key);
    if (isAppearance(stored)) return stored;
    if (shell?.dataset.docTheme === 'gta6') {
      const legacy = localStorage.getItem(legacyKey);
      if (legacy === 'light' || legacy === 'dark') return legacy;
    }
  } catch { /* A reader with storage disabled can still choose an appearance. */ }
  return 'system';
}

function AppearanceIcon({ mode }: { mode: Appearance }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d={icons[mode]} />
  </svg>;
}

/** Controls the nearest VaryDocs shell, without changing the host document. */
export function AppearanceSelect({ locale, labels }: { locale: string; labels?: AppearanceLabels }) {
  const text = labels ?? (/^zh(?:-|$)/i.test(locale) ? zh : en);
  const id = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const target = useRef<Appearance>('system');
  const [appearance, setAppearance] = useState<Appearance>('system');
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const shell = wrapper.current?.closest<HTMLElement>('.dt-shell');
    const apply = (value: Appearance) => {
      if (value === 'system') shell?.removeAttribute('data-vd-appearance');
      else if (shell) shell.dataset.vdAppearance = value;
      setAppearance(value);
    };
    const stored = (event: StorageEvent) => {
      if (!event.key || event.key === key || event.key === legacyKey) apply(readPreference(shell));
    };
    const changed = (event: Event) => {
      const value = (event as CustomEvent<unknown>).detail;
      if (isAppearance(value)) apply(value);
    };
    apply(readPreference(shell));
    window.addEventListener('storage', stored);
    window.addEventListener(key, changed);
    return () => {
      window.removeEventListener('storage', stored);
      window.removeEventListener(key, changed);
      shell?.removeAttribute('data-vd-appearance');
    };
  }, []);

  useLayoutEffect(() => {
    const panel = menu.current;
    if (!open || !panel) return;

    function fitViewport() {
      if (!panel) return;
      panel.style.removeProperty('--dt-appearance-offset');
      const { left, right } = panel.getBoundingClientRect();
      const edge = document.documentElement.clientWidth - 8;
      const offset = left < 8 ? 8 - left : right > edge ? edge - right : 0;
      panel.style.setProperty('--dt-appearance-offset', offset + 'px');
    }

    function dismissOutside(event: PointerEvent) {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) setOpen(false);
    }

    fitViewport();
    focusOption(target.current);
    document.addEventListener('pointerdown', dismissOutside);
    window.addEventListener('resize', fitViewport);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      window.removeEventListener('resize', fitViewport);
    };
  }, [open]);

  function focusOption(mode: Appearance) {
    menu.current?.querySelector<HTMLButtonElement>('[data-appearance-option="' + mode + '"]')?.focus({ preventScroll: true });
  }

  function openMenu(mode: Appearance) {
    if (open) {
      focusOption(mode);
      return;
    }
    target.current = mode;
    setOpen(true);
  }

  function closeAndFocus() {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }

  function select(mode: Appearance) {
    try { localStorage.setItem(key, mode); } catch { /* Apply it for this page. */ }
    window.dispatchEvent(new CustomEvent(key, { detail: mode }));
    closeAndFocus();
  }

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        closeAndFocus();
        return;
      case 'Tab':
        closeAndFocus();
        return;
      case 'ArrowDown':
        focusOption(modes[(index + 1) % modes.length]);
        break;
      case 'ArrowUp':
        focusOption(modes[(index - 1 + modes.length) % modes.length]);
        break;
      case 'Home':
        focusOption(modes[0]);
        break;
      case 'End':
        focusOption(modes[modes.length - 1]);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  return <div className="dt-appearance" ref={wrapper} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} id={id} type="button" className="dt-appearance-trigger"
      data-appearance={appearance} aria-label={text.label} title={text.label}
      aria-haspopup="menu" aria-expanded={open} aria-controls={id + '-menu'}
      onClick={() => open ? setOpen(false) : openMenu(appearance)}
      onKeyDown={event => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        openMenu(event.key === 'ArrowDown' ? modes[0] : modes[modes.length - 1]);
      }}>
      <AppearanceIcon mode={appearance} />
    </button>
    <div ref={menu} className="dt-appearance-menu" id={id + '-menu'} role="menu"
      aria-labelledby={id} hidden={!open}>
      {modes.map((mode, index) => <button key={mode} type="button" className="dt-appearance-option"
        role="menuitemradio" aria-checked={appearance === mode} data-appearance-option={mode}
        tabIndex={-1} onClick={() => select(mode)} onKeyDown={event => navigate(event, index)}>
        <AppearanceIcon mode={mode} />
        <span>{text[mode]}</span>
        <svg className="dt-appearance-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="m5 12 4 4L19 6" />
        </svg>
      </button>)}
    </div>
  </div>;
}
