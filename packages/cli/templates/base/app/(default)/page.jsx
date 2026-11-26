import { defaultLocale, Home } from '@/lib/docs.jsx';
import { seo } from '@/lib/varydocs-seo';
export function generateMetadata() { return seo.metadata(defaultLocale); }
export default function Page() { return <Home locale={defaultLocale} />; }
