import { seo } from '@/lib/varydocs-seo';
import { defaultLocale } from '@/.varydocs/index.mjs';

export async function generateMetadata({ params }) {
  return seo.metadata(defaultLocale, (await params).slug ?? []);
}
export default function Layout({ children }) { return children; }
