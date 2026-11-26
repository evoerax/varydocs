# @varydocs/cli

Create a Next.js documentation site with the interactive wizard. Use Node.js 22.12 or later.

## Create a site with npm

These commands require the public 0.1.0 release. Choose npm in the wizard to use the commands shown.

~~~sh
npx @varydocs/cli@0.1.0 init my-varydocs --install
cd my-varydocs
npm run dev
~~~

Choose Starter or Blank, a documentation style, a navigation layout, and the site languages. Use `--lang zh-CN` for a Simplified Chinese terminal interface. Run `npm run check` to validate content, links, and localized routes. For a static site, run `npm run build` and deploy `out/`.

## Run from source

Run these commands from the VaryDocs repository root with pnpm 10.

~~~sh
pnpm install --frozen-lockfile
pnpm create:local my-varydocs --install
cd my-varydocs
npm run dev
~~~

The source launcher includes the SDK tarballs in `vendor/varydocs/`. Keep that directory when moving the generated project.

## Add the documentation assistant

Add `--assistant` to the `init` or `create:local` command. These projects use a Next.js server for the chat endpoint. Run `npm run build` and `npm start` for production. The assistant can show document excerpts immediately. Configure `AI_GATEWAY_API_KEY` and `VARYDOCS_AI_MODEL` on the server to stream model answers with links to the documentation.

## Switch styles

Choose from six general-purpose styles (Minimal, Editorial, Terminal, Swiss, Brutalism, and Blueprint) and two themed styles (GTA6 and Retro Desktop). Run `npm exec -- varydocs add style desktop` in an existing project to give its navigation, search, and code blocks a desktop-window treatment.

In a new CLI project, each build bundles the selected layout and its stylesheet. Change `style` in `varydocs.json` or use the command above to switch the running preview, then run `npm run build` to export that version.
