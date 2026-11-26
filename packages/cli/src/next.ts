import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { basename, resolve, sep } from 'node:path';
import { watch } from 'chokidar';
import { buildDocs, contentPath, readConfig } from '@varydocs/core';
import type { CliMessages } from './messages.js';
import { prepareStarterRoutes } from './routes.js';
import { writeThemeEntry } from './style.js';

async function compileSite(root: string, messages: CliMessages, multilingual?: boolean) {
  const manifest = await buildDocs(root);
  if (multilingual !== undefined) await prepareStarterRoutes(root, multilingual, { messages });
  await writeThemeEntry(root, manifest.style);
  return manifest;
}

export async function runNext(command: 'dev' | 'build', messages: CliMessages, options: { port?: string; hostname?: string } = {}) {
  const cwd = process.cwd();
  let nextBin: string;
  try {
    nextBin = createRequire(resolve(cwd, 'package.json')).resolve('next/dist/bin/next');
  } catch {
    throw new Error(messages.dependenciesMissing + ' varydocs ' + command + '.');
  }
  const config = await readConfig(cwd);
  let multilingual = (config.i18n?.locales.length ?? 0) > 1;
  const manifest = await compileSite(cwd, messages, multilingual);
  console.log(messages.compiled(manifest.pages.length));
  const args = [nextBin, command];
  if (options.port) args.push('--port', options.port);
  if (options.hostname) args.push('--hostname', options.hostname);

  let cleanup = async () => {};
  if (command === 'dev') {
    let docsDir = contentPath(cwd, config);
    const publicDir = resolve(cwd, 'public');
    const inPublicDir = (path: string) => path === publicDir || path.startsWith(publicDir + sep);
    const watched = [resolve(cwd, 'varydocs.json'), publicDir];
    if (!inPublicDir(docsDir)) watched.push(docsDir);
    const watcher = watch(watched, {
      ignoreInitial: true,
      ignored: path => basename(path).startsWith('.'),
      awaitWriteFinish: { stabilityThreshold: 120, pollInterval: 40 },
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = Promise.resolve();
    watcher.on('all', (event, path) => {
      // The compiler also checks that root-relative images exist in public/.
      const assetAddedOrRemoved = (event === 'add' || event === 'unlink') && inPublicDir(path);
      if (!assetAddedOrRemoved && !/(?:\.mdx?|varydocs\.json)$/u.test(path)) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        running = running.then(async () => {
          try {
            const nextConfig = await readConfig(cwd);
            const nextDir = contentPath(cwd, nextConfig);
            if (nextDir !== docsDir) {
              if (!inPublicDir(docsDir)) await watcher.unwatch(docsDir);
              if (!inPublicDir(nextDir)) watcher.add(nextDir);
              docsDir = nextDir;
            }
            const hasTranslations = (nextConfig.i18n?.locales.length ?? 0) > 1;
            const changed = await compileSite(cwd, messages, hasTranslations === multilingual ? undefined : hasTranslations);
            multilingual = hasTranslations;
            console.log(messages.updated(changed.pages.length));
          } catch (error) {
            console.error(error instanceof Error ? error.message : error);
          }
        });
      }, 90);
    });
    watcher.on('error', error => console.error('Content watcher: ' + error));
    cleanup = async () => {
      clearTimeout(timer);
      await watcher.close();
      await running;
    };
  }
  const child = spawn(process.execPath, args, { cwd, stdio: 'inherit' });
  const stop = () => child.kill('SIGTERM');
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    await new Promise<void>((resolve, reject) => {
      child.on('error', reject);
      child.on('exit', (code, signal) => {
        if (code === 0 || (command === 'dev' && signal)) resolve();
        else reject(new Error('Next.js ' + command + ' failed (' + (signal ?? code) + ').'));
      });
    });
  } finally {
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
    await cleanup();
  }
}
