import { AskAI } from '@varydocs/ai';
import '@varydocs/ai/styles.css';

export function headerActions({ locale, page, basePath }) {
  return <AskAI endpoint={basePath + '/api/ask/'} locale={locale} pageId={page.id} pageTitle={page.title}
    headings={page.headings.slice(0, 2).map(heading => heading.title)} />;
}
