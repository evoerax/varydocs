# VaryDocs

**One source. Endless styles.**

[简体中文](README.zh-CN.md)

VaryDocs is an open-source React library for documentation. Use individual components in an existing app or build a documentation site from Markdown and MDX with the Next.js adapter and interactive CLI.

The MIT-licensed SDK includes eight built-in themes, both CLI templates, and the English and Simplified Chinese developer guides. The GTA6 theme bundles fonts under the SIL Open Font License. The official website, its brand assets, gallery interface, and deployment are maintained separately. Generated sites can be hosted independently.

## Choose an entry point

Use Node.js 22.12 or later. The npm commands below require the public 0.1.0 release. You can [create a site directly from this checkout](#create-a-documentation-site-from-this-checkout).

```sh
npx @varydocs/cli@0.1.0 init my-varydocs --install
cd my-varydocs
npm run dev
```

| Goal | What to install or run | Example |
| --- | --- | --- |
| Create a Next.js site | The interactive CLI above. Choose npm to use the commands shown. | [Starter and Blank](packages/core/docs/en/cli.md) |
| Add Tabs to a React 19 app | `npm install @varydocs/react@0.1.0`, then import the component and its CSS. | [Component usage](#import-individual-react-components) |
| Embed documentation in Vite | Install `@varydocs/react` and `@varydocs/core`. Compile during the build and render the current page. | [Runnable Vite example](examples/vite-embed/) |
| Export a static Next.js site | Create a site with the CLI. Run `npm run build` and deploy `out/`. | [Deployment](#write-and-style-content) |

The release fixtures use Node.js 22.12+, pnpm 10, npm 10 or 11, React 19.2.8 and Next.js 16.4.6. The optional assistant requires React 19.2.1 or later in React 19. Contributor setup and the bug report form are in the [contribution guide](CONTRIBUTING.md).

## Run the React example from source

Use Node.js 22.12 or newer and pnpm 10.

~~~sh
pnpm install --frozen-lockfile
pnpm dev
~~~

Open the URL that Vite prints. The example includes English and Simplified Chinese pages, search, and an MDX component supplied by the React app.

~~~sh
pnpm test
pnpm build
~~~

The React example builds to `examples/vite-embed/dist/`. Read the [English guide](packages/core/docs/en/index.mdx) or [简体中文指南](packages/core/docs/zh-CN/index.mdx).

Run `pnpm dev:gta6` from the repository root to try the GTA6 theme’s comic lettering, neon-pink navigation, and paper-toned pages. The bilingual example includes artwork in its document content. [GTA6 example](examples/gta6/README.md)

## Create a documentation site from this checkout

~~~sh
pnpm create:local my-varydocs
cd my-varydocs
npm run dev
~~~

Select a template, style, navigation layout, document language, and package manager in the wizard. Choose to install dependencies, then run the dev command it prints. The launcher includes the local VaryDocs packages in `vendor/varydocs/`. Keep that directory with the project when moving it.

To script creation and installation, pass the corresponding options.

~~~sh
pnpm create:local my-varydocs --lang zh-CN --template starter --style editorial \
  --language bilingual --package-manager npm --yes --install
~~~

Use `npm run check` to validate content, document links, and localized routes. Use `npm run build` to export the static site to `out/`. You can run the same scripts with pnpm.

If you generated a site before the rename, create a VaryDocs project with the same template and languages, then copy your documentation and public assets and merge your site settings into `varydocs.json`.

## Write and style content

Place Markdown and MDX in content/docs/. Give each page a frontmatter title and use index.md or index.mdx for the documentation home. Link to other pages with relative file paths, including optional heading fragments. Put site images in public/ and reference them with root-relative paths.

Set the site name, navigation groups, and style in `varydocs.json`. Use `Callout`, `Tabs`, `Tab`, `Steps`, and `Step` in MDX with literal props. Add custom components to the React or Next.js component map. The VaryDocs content compiler supports this MDX subset and rejects document-level imports and JavaScript expressions.

For a static deployment, set the public origin and optional mount path when building. Serve the contents of `out/` at that path and configure the host to serve its exported `404.html` with HTTP status 404 for missing files.

```sh
VARYDOCS_SITE_URL=https://docs.example.com VARYDOCS_BASE_PATH=/product npm run build
```

An explicit origin enables canonical URLs, alternates for existing translations and `/product/sitemap.xml`. Keep credentials for the optional AI endpoint on a server. The assistant template uses `npm run build` and `npm start`. A static frontend needs a separately hosted endpoint.

## Import individual React components

```tsx
import { Tab, Tabs } from '@varydocs/react/components/tabs';
import '@varydocs/react/components/tabs.css';
```

Component entry points include `appearance`, `callout`, `tabs`, `steps`, `code-block`, `copy-button`, and `search`. Each has a matching stylesheet and can inherit the surrounding application's CSS custom properties.

For a full documentation view with an explicit theme, import `DocsView` from `@varydocs/react/view` and pass a theme from `@varydocs/react/themes/<style>`. Import the matching `@varydocs/react/themes/<style>.css` stylesheet. The view receives layouts as navigation, article, and outline slots, and accepts `Search={DocSearch}` to enable the search component.

The CLI wizard lists six general-purpose styles (`minimal`, `editorial`, `terminal`, `swiss`, `brutalism`, and `blueprint`) and two themed styles (`gta6` and `desktop`). Retro Desktop gives the file tree, search and code blocks a windowed interface. Apply it to an existing CLI project with `pnpm exec varydocs add style desktop`. [Style and React integration guide](packages/core/docs/en/styling.mdx)

## Add documentation to an existing Next.js app

For a Next.js 16 App Router project using React 19, compile your content before running Next. The CLI template connects the page loader to a reader with the selected theme. Each build includes that layout and its CSS. To adopt single-theme builds in a project generated with the older all-theme template, merge the new imports and reader setup into `lib/docs.jsx` after updating the SDK and CLI together. Existing apps can also use `createDocsAdapter()` from `@varydocs/next` for the reader with built-in theme selection. [Template setup](packages/cli/templates/base/lib/docs.jsx) · [Page and search routes](packages/cli/templates/base/app)

## Add an AI sidebar

Add `--assistant` to the `init` command to create a site with **Ask AI** beside search. From this checkout, run `pnpm create:local my-varydocs --assistant --install`. Readers can ask about the current page, follow up and open the source section. With a model configured, the Vercel AI SDK streams the answer. Readers can look up relevant excerpts without model credentials. The assistant template includes a Next.js server route. [Setup and static-site integration](packages/core/docs/en/assistant.md)

## Internationalization

The built-in themes follow the system color scheme by default. The appearance menu lets readers choose Light, Dark or System, and remembers explicit choices on the same site.

The built-in UI and CLI support English and Simplified Chinese. A multilingual starter offers a language link in the header for the current document. Visiting the site root uses the last chosen language or a supported browser language. Direct documentation URLs open in the language they address. Pass a CLI display language with --lang zh-CN, and choose the site languages independently with --language en, --language zh-CN, or --language bilingual.

For a multilingual project, put each translation under content/docs/<locale>/ and add the language to varydocs.json. With this example, English uses /docs/ and Chinese uses /zh-CN/docs/.

~~~json
{
  "name": "My Docs",
  "i18n": {
    "defaultLocale": "en",
    "locales": [
      { "id": "en", "label": "English" },
      { "id": "zh-CN", "label": "简体中文" }
    ]
  }
}
~~~

Each locale can define its own name and navigation. Use matching source paths for translated pages to retain the current page when switching languages. Builds validate links and generate a separate search index for each language. Pass a messages override to DocsView to translate renderer labels for additional locales.

### Upgrade a single-language starter

1. Update the VaryDocs packages listed in the generated project's `dependencies` and `devDependencies` together. For a project created from source, refresh its vendored tarballs and lockfile from the same checkout.
2. Move the existing documents into `content/docs/en/`, retaining relative paths. Add translations under `content/docs/zh-CN/`, including an index page. Add the `i18n` configuration shown above and keep your project settings.
3. Run `npm run check` then `npm run build`. The CLI adds missing localized routes to generated starters. Keep custom routes and merge SEO exports from the current template into any homepage or document layout you customized. Open both language homes and a translated deep link. Pages without a translation link readers to the other language’s docs home.

If the starter already has a top-level dynamic route such as `app/[lang]`, rename that segment to `[locale]` and update its `params` references. Put custom versions of the localized homepage, docs route or search route at the matching template paths under `app/[locale]`. Next.js route groups share the same URLs, so a second copy in a route group causes a conflict.

## Package boundaries

| Package | Responsibility |
| --- | --- |
| @varydocs/model | Dependency-free manifest types and URL helpers shared by the compiler and renderers |
| @varydocs/core | Build-time content processing, routes, navigation, headings, links, search data, and MDX modules |
| @varydocs/react | Document renderer, keyboard interactions, styles, and component mappings |
| @varydocs/next | App Router params, metadata, and document rendering for an existing Next.js app |
| @varydocs/cli | Template prompts, project scaffolding, content checks, and Next.js build orchestration |
| @varydocs/ai | Optional React sidebar and a server handler that grounds responses in the site's localized documentation |

Core emits a versioned manifest and one import per compiled page. The renderers use that manifest, and Next.js serves the generated search index as static JSON. pnpm packages are versioned together for the first release.

## Verify a release

Build the public packages and React example, then test the CLI-generated Next.js site with Python 3 installed.

~~~sh
pnpm test
pnpm build
pnpm pack:local
node scripts/smoke-release.mjs
~~~

The release smoke test switches a bilingual site through Swiss, GTA6, Retro Desktop and Editorial under a deployment prefix. Each build checks the exported pages, stylesheets and theme fonts. The smoke test also verifies that the example illustrations stay out of the release package and generated sites. It installs standalone Tabs in a separate project and starts a production site with the assistant enabled. HTTP requests check that English and Chinese excerpts link to the right headings. The checks run locally without model credentials. Once the release is available on npm, run `node scripts/smoke-release.mjs --registry` to verify the registry install.

Perform the packaged entry-point checks with `pnpm check:pack`. For the desktop and narrow-screen keyboard, accessibility, network and bundle checks, see the [release verification record](RELEASE-CHECKLIST.zh-CN.md).
