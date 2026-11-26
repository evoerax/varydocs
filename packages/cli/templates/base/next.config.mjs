import { fileURLToPath } from 'node:url';

export default {
  output: 'export',
  trailingSlash: true,
  basePath: process.env.VARYDOCS_BASE_PATH ?? '',
  turbopack: { root: fileURLToPath(new URL('.', import.meta.url)) },
};
