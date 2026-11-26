import { searchByLocale, searchDefaultLocale } from '@/.varydocs/search.mjs';

export const dynamic = 'force-static';
export const dynamicParams = false;
export function generateStaticParams() {
  const translated = Object.keys(searchByLocale).filter(locale => locale !== searchDefaultLocale);
  return (translated.length ? translated : [searchDefaultLocale]).map(locale => ({ locale }));
}
export async function GET(_request, { params }) {
  return Response.json(searchByLocale[(await params).locale]);
}
