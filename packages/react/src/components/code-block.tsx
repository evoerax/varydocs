import { isValidElement } from 'react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { CopyButton } from './copy-button.js';

export function CodeBlock({ children, ...props }: ComponentPropsWithoutRef<'pre'>) {
  const source = isValidElement<{ children?: ReactNode }>(children) && typeof children.props.children === 'string'
    ? children.props.children.replace(/\n$/u, '') : '';
  return <div className="dt-code-block">
    {source && <CopyButton text={source} />}
    <pre tabIndex={0} {...props}>{children}</pre>
  </div>;
}
