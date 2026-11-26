import type { ReactNode } from 'react';

export function Step({ title, children }: { title?: string; children?: ReactNode }) {
  return <li>{title && <strong>{title}</strong>}<div>{children}</div></li>;
}

export function Steps({ children }: { children?: ReactNode }) {
  return <ol className="dt-steps">{children}</ol>;
}
