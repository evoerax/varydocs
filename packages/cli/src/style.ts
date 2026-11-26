import { randomUUID } from 'node:crypto';
import { readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { builtinStyles } from '@varydocs/core';
import jsonc from 'jsonc-parser';

async function replaceFile(path: string, content: string, mode?: number) {
  const temporary = path + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(temporary, content, { flag: 'wx', mode });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function writeThemeEntry(root: string, style: string) {
  const path = resolve(root, '.varydocs/theme.mjs');
  const builtin = builtinStyles.find(item => item.id === style);
  // Custom hosts can supply their own theme without importing the starter's entry.
  const content = builtin
    ? `import '@varydocs/react/themes/${builtin.id}.css';\nexport { ${builtin.id}Theme as theme } from '@varydocs/react/themes/${builtin.id}';\n`
    : `export const theme = undefined;\nthrow new Error(${JSON.stringify('Unknown VaryDocs style: ' + style)});\n`;
  try {
    if (await readFile(path, 'utf8') === content) return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await replaceFile(path, content);
}

export async function setSiteStyle(root: string, style: string) {
  const path = await realpath(resolve(root, 'varydocs.json'));
  const source = await readFile(path, 'utf8');
  const errors: jsonc.ParseError[] = [];
  const document = jsonc.parseTree(source, errors, { disallowComments: true, allowTrailingComma: false });
  if (errors.length || document?.type !== 'object') throw new Error('Invalid JSON object in ' + path);
  // Native JSON parsing uses the last value for a duplicate key.
  const property = document.children?.filter(entry => entry.children?.[0].value === 'style').at(-1)?.children?.[1];
  if (property?.value === style) return;

  // Replace only the value. For an absent key, mirror the first property's spacing.
  let updated: string;
  if (property) {
    updated = source.slice(0, property.offset) + JSON.stringify(style) + source.slice(property.offset + property.length);
  } else {
    const first = document.children?.[0];
    const last = document.children?.at(-1);
    const offset = last ? last.offset + last.length : document.offset + 1;
    const whitespace = first ? source.slice(document.offset + 1, first.offset) : '';
    const [key, value] = first?.children ?? [];
    const separator = key && value ? source.slice(key.offset + key.length, value.offset) : ': ';
    const entry = (last ? ',' : '') + whitespace + '"style"' + separator + JSON.stringify(style);
    updated = source.slice(0, offset) + entry + source.slice(offset);
  }

  await replaceFile(path, updated, (await stat(path)).mode);
}
