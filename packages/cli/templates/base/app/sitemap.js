import { seo } from '@/lib/varydocs-seo';

export const dynamic = 'force-static';
export default function sitemap() { return seo.sitemap(); }
