import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildDocs } from '@varydocs/core';

const root = process.argv[2] ?? fileURLToPath(new URL('.', import.meta.url));
await buildDocs(root);

// Pass asset URLs to DocSearch. Vite hosts each translation separately and the
// reader fetches the selected one only when the search dialog opens.
const output = resolve(root, '.varydocs');
const { searchByLocale } = await import(pathToFileURL(resolve(output, 'search.mjs')));
const urls = [];
for (const [locale, documents] of Object.entries(searchByLocale)) {
  const name = 'search-' + locale + '.json';
  await writeFile(resolve(output, name), JSON.stringify(documents));
  urls.push(JSON.stringify(locale) + ': new URL(' + JSON.stringify('./' + name + '?no-inline') + ', import.meta.url).href');
}
await writeFile(resolve(output, 'search-urls.mjs'), 'export const searchUrls = {\n' + urls.join(',\n') + '\n};\n');
