import { DocsAssistantLayout } from '@/lib/varydocs-assistant-layout';

export default function Layout({ children }) {
  return <DocsAssistantLayout basePath={process.env.VARYDOCS_BASE_PATH ?? ''}>{children}</DocsAssistantLayout>;
}
