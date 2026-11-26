import { docsFor, Documentation } from '@/lib/docs.jsx';

export const dynamicParams = false;
export function generateStaticParams({ params }) { return docsFor(params.locale).staticParams(); }
export async function generateMetadata({ params }) {
  const { locale, slug } = await params;
  return docsFor(locale).metadata(slug);
}
export default async function Page({ params }) { return <Documentation {...(await params)} />; }
