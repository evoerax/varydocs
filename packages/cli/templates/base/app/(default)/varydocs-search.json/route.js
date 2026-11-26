import { search } from '@/.varydocs/search.mjs';

export const dynamic = 'force-static';
export function GET() { return Response.json(search); }
