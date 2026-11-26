import { defaultLocale, SiteLayout } from '@/lib/docs.jsx';
import { manifest } from '@/.varydocs/index.mjs';

export const metadata = { title: manifest.name };
export default function Layout({ children }) { return <SiteLayout locale={defaultLocale}>{children}</SiteLayout>; }
