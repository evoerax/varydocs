#!/usr/bin/env node
import { Argument, Command, Option } from 'commander';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { setSiteStyle } from './style.js';
import { runInit, templates } from './init.js';
import { runNext } from './next.js';
import { prepareStarterRoutes } from './routes.js';
import { buildDocs, builtinStyles, docLayouts, readConfig } from '@varydocs/core';
import { cliLanguage, cliMessages } from './messages.js';

const require = createRequire(import.meta.url);
const { version } = JSON.parse(await readFile(require.resolve('../package.json'), 'utf8'));
const language = cliLanguage();
const messages = cliMessages(language);
const program = new Command().name('varydocs').description(messages.description).version(version)
  .addOption(new Option('--lang <locale>', messages.lang).choices(['en', 'zh-CN']));

program.command('init [directory]')
  .description(messages.init)
  .addOption(new Option('--template <id>', messages.template).choices(templates.map(template => template.id)))
  .addOption(new Option('--style <id>', messages.style).choices(builtinStyles.map(style => style.id)))
  .addOption(new Option('--layout <id>', messages.layout).choices(docLayouts))
  .addOption(new Option('--language <mode>', messages.language).choices(['en', 'zh-CN', 'bilingual']))
  .addOption(new Option('--package-manager <name>', messages.packageManager).choices(['npm', 'pnpm']))
  .option('--assistant', messages.assistant)
  .option('--local-packages <directory>', messages.localPackages)
  .option('--install', messages.installOption)
  .option('--no-install', messages.skipInstall)
  .option('-y, --yes', messages.defaults)
  .action((directory, options) => runInit(directory, options, version, language, messages));

program.command('add').description(messages.add).command('style')
  .description(messages.chooseStyle)
  .addArgument(new Argument('<id>', messages.style).choices(builtinStyles.map(style => style.id)))
  .action(async (id: string) => {
    await setSiteStyle(process.cwd(), id);
    console.log(messages.selectedStyle(id));
  });

program.command('dev')
  .description(messages.dev)
  .option('-p, --port <number>', messages.port)
  .option('-H, --hostname <address>', messages.host)
  .action(options => runNext('dev', messages, options));

program.command('build')
  .description(messages.build)
  .action(() => runNext('build', messages));

program.command('check')
  .description(messages.check)
  .action(async () => {
    const root = process.cwd();
    const config = await readConfig(root);
    if ((config.i18n?.locales.length ?? 0) > 1) await prepareStarterRoutes(root, true, { messages, write: false });
    const manifest = await buildDocs(root, { write: false });
    console.log(messages.checked(manifest.pages.length));
  });

try {
  await program.parseAsync();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
