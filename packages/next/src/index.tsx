import { DocsView } from '@varydocs/react';
import type { DocsViewProps } from '@varydocs/react';
import { createDocsLoader } from './loader.js';
import type { LoaderOptions } from './loader.js';

type PageOptions = Omit<DocsViewProps, 'manifest' | 'page' | 'Body' | 'mount' | 'assetBase' | 'searchIndex'>;

export function createDocsAdapter(config: LoaderOptions) {
  const loader = createDocsLoader(config);
  return {
    staticParams: loader.staticParams,
    metadata: loader.metadata,
    async render(slug?: string[], options: PageOptions = {}) {
      const props = await loader.load(slug);
      return <DocsView {...options} {...props} />;
    },
  };
}
