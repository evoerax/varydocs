---
title: Command line
description: Pick a template and create a project in your terminal.
---

## Create a site

Run the interactive wizard from the directory where you want to create a project. Choose npm to use the commands shown.

~~~bash
npx @varydocs/cli@0.1.0 init my-varydocs --install
cd my-varydocs
npm run dev
~~~


The template sets the initial content. **Starter** includes a getting-started page, component examples and a configuration guide. **Blank** starts with a single Markdown home page. Either template works with the wizard’s general-purpose styles or themed styles, including Retro Desktop and GTA6. You can change the layout, typography and colors later while keeping your content.

Choose English, Simplified Chinese or both for the site. Use `--lang zh-CN` for the Chinese CLI interface.

To test local changes to VaryDocs, use the [source checkout workflow](#install-from-a-local-checkout).

## Install from a local checkout

From a VaryDocs checkout, start the wizard with the local packages.

~~~bash
pnpm create:local my-varydocs
~~~

Choose a template, style, navigation layout, language and package manager. If you install dependencies in the wizard, you can open the new directory and run the printed dev command. Keep vendor/varydocs with the generated project to install it again from the same packages.

## Run without prompts

~~~bash
pnpm create:local my-varydocs --template starter --style editorial \
  --layout topbar --language bilingual --package-manager pnpm --yes --install
~~~

Use `varydocs check` to validate content, links, and localized routes. Use `varydocs build` to compile and export a static site.

## Switch styles

From the generated project directory, select a built-in style with the installed CLI.

~~~bash
pnpm exec varydocs add style swiss
~~~

The command updates `style` in `varydocs.json`. A running development server picks up the change. Run `npm run build` to export the site with the Swiss theme and its stylesheet. The CLI also picks up direct edits to the style setting.

## Choose a navigation layout

The `layout` field in `varydocs.json` controls where navigation and site controls sit. It works with the selected theme across all site languages.

- `theme` follows the theme's own layout and is the default.
- `topbar` keeps the site controls visible across the top, with page navigation beside the article.
- `sidebar` puts the site controls above an independently scrolling page list on the left.

Set the same value with `varydocs init --layout` when creating a project.
