import { defaultLocale, docsFor, Documentation } from '@/lib/docs.jsx';

const docs = docsFor(defaultLocale);
export const dynamicParams = false;
export function generateStaticParams() { return docs.staticParams(); }
export async function generateMetadata({ params }) { return docs.metadata((await params).slug); }
export default async function Page({ params }) { return <Documentation locale={defaultLocale} slug={(await params).slug} />; }
