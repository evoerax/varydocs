import { otherLanguages, SiteLayout } from '@/lib/docs.jsx';
import { defaultLocale, locales } from '@/.varydocs/index.mjs';

export const dynamicParams = false;
export function generateStaticParams() {
  const translated = otherLanguages();
  return translated.length ? translated : [{ locale: defaultLocale }];
}
export async function generateMetadata({ params }) {
  return { title: locales[(await params).locale].manifest.name };
}
export default async function Layout({ children, params }) {
  return <SiteLayout locale={(await params).locale}>{children}</SiteLayout>;
}
