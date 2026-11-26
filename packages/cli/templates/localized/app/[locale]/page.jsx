import { Home } from '@/lib/docs.jsx';
import { seo } from '@/lib/varydocs-seo';
export async function generateMetadata({ params }) { return seo.metadata((await params).locale); }
export default async function Page({ params }) { return <Home locale={(await params).locale} />; }
