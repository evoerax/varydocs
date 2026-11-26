import { seo } from '@/lib/varydocs-seo';

export async function generateMetadata({ params }) {
  const { locale, slug } = await params;
  return seo.metadata(locale, slug ?? []);
}
export default function Layout({ children }) { return children; }
