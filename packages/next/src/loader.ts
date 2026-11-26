import { notFound } from 'next/navigation.js';
import type { DocManifest } from '@varydocs/model';
import type { PageModules } from '@varydocs/react/view';

export interface LoaderOptions {
  manifest: DocManifest;
  modules: PageModules;
  mount?: string;
  basePath?: string;
  searchPath?: string;
}

export function createDocsLoader({ manifest, modules, mount = '/docs', basePath = '', searchPath }: LoaderOptions) {
  const pages = new Map(manifest.pages.map(page => [page.slug.join('/'), page]));
  function getPage(slug: string[] = []) {
    const page = pages.get(slug.join('/'));
    if (!page) notFound();
    return page;
  }
  return {
    staticParams: () => manifest.pages.map(page => ({ slug: page.slug })),
    metadata: (slug?: string[]) => {
      const page = getPage(slug);
      return { title: page.title, description: page.description };
    },
    async load(slug?: string[]) {
      const page = getPage(slug);
      const { default: Body } = await modules[page.id]();
      return { manifest, page, Body, mount: basePath + mount, assetBase: basePath, searchIndex: searchPath && basePath + searchPath };
    },
  };
}
