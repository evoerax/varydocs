import type { ComponentPropsWithoutRef } from 'react';
import { Callout } from '../components/callout.js';
import { CodeBlock } from '../components/code-block.js';
import { Step, Steps } from '../components/steps.js';
import { Tab, Tabs } from '../components/tabs.js';

function Table({ 'aria-label': label = 'Data table', ...props }: ComponentPropsWithoutRef<'table'>) {
  return <div className="dt-table" tabIndex={0} role="region" aria-label={label}><table {...props} /></div>;
}

export const standardComponents = { Callout, Tabs, Tab, Steps, Step, pre: CodeBlock, table: Table };
