'use client';

import { AssistantLayout } from '@varydocs/ai';
import { useRouter } from 'next/navigation';

export function DocsAssistantLayout({ children, basePath }) {
  const router = useRouter();
  function navigate(href) {
    // Next adds basePath when pushing a route. Keep the locale, query, and section fragment.
    router.push(href.startsWith(basePath + '/') ? href.slice(basePath.length) : href);
  }
  return <AssistantLayout navigate={navigate}>{children}</AssistantLayout>;
}
