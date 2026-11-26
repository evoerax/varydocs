import React from 'react';
import { CodeBlock } from '@varydocs/react/components/code-block';
import { terminalTheme } from '@varydocs/react/themes/terminal';
import '@varydocs/react/themes/terminal.css';
import { defaultLocale, languages, locales } from './.varydocs/index.mjs';
import { searchUrls } from './.varydocs/search-urls.mjs';
import { renderDocs } from './render-docs.jsx';

function InstallCommand({ packageManager }) {
  return <CodeBlock><code>{packageManager + ' add @varydocs/react'}</code></CodeBlock>;
}

const components = { InstallCommand };

await renderDocs({ theme: terminalTheme, components, defaultLocale, languages, locales, searchUrls });
