import { gateway } from 'ai';
import { createDocsChatHandler } from '@varydocs/ai/server';
import { defaultLocale, locales } from '@/.varydocs/index.mjs';
import { searchByLocale } from '@/.varydocs/search.mjs';

export const runtime = 'nodejs';

const requestsPerMinute = process.env.VARYDOCS_AI_REQUESTS_PER_MINUTE;

export const POST = createDocsChatHandler({
  locales, defaultLocale, searchByLocale,
  basePath: process.env.VARYDOCS_BASE_PATH ?? '',
  model: process.env.AI_GATEWAY_API_KEY && process.env.VARYDOCS_AI_MODEL
    ? gateway(process.env.VARYDOCS_AI_MODEL)
    : undefined,
  searchDocumentation: process.env.VARYDOCS_AI_DOCUMENT_SEARCH === '1',
  operations: {
    requestsPerMinute: requestsPerMinute === undefined ? undefined : Number(requestsPerMinute),
    onEvent: event => console.info('[varydocs:assistant]', JSON.stringify(event)),
  },
});
