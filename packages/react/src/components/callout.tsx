import type { ReactNode } from 'react';

export interface CalloutProps { title?: string; children?: ReactNode }

export function Callout({ title = 'Note', children }: CalloutProps) {
  return <aside className="dt-callout"><strong>{title}</strong><div>{children}</div></aside>;
}
