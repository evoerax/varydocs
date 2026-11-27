# Changelog

## 0.1.1

- Put branding and search above the independently scrolling navigation in the built-in sidebar layout. Show appearance, language, and other configured site actions at the top right.
- Keep right-hand desktop outlines visible beside the article and highlight the current section when scrolling or following chapter links.

## 0.1.0

- Enable rate limiting and structured AI usage and feedback logs in CLI-generated assistant sites. Readers can rate a reply in the sidebar.
- Dock the assistant beside the reader or open it in a floating window. Follow an inline source to a document heading while keeping the conversation open. Supplemental search stays within the current page or selected section when the question has that scope.

- Add Retro Desktop (`desktop`) with a windowed file tree, keyboard-driven document finder and command windows. The CLI wizard presents it alongside GTA6 under Themed styles.
- Follow the operating system’s color scheme in the built-in themes, with a localized System, Light or Dark control and a saved manual preference.
- Put translated-page links in the starter’s header. On the bare site root, choose a supported language from the reader’s saved choice or browser preference.

- Preserve authored layouts and routes when upgrading an existing monolingual starter to a bilingual site. The CLI reports conflicts before it writes generated locale routes. Move the original documents into the default locale directory, add translations, and update the SDK and CLI together. Merge SEO metadata into any custom route that owns it.
- Set `VARYDOCS_SITE_URL` and optionally `VARYDOCS_BASE_PATH` to generate canonical URLs, translated alternates and a sitemap. Language switching offers the target docs home for untranslated pages.
- Resolve nested MDX headings, repeated anchors, document links and local public images during compilation. Deep links can open a heading inside a collapsed Tab.
- Recompile in dev when a previously missing public image is added. Pass the host router's link component through to both desktop and mobile document navigation.
- Rank localized sections for both search and the AI sidebar. Vite examples request a language’s search index when the reader opens search.
- Make horizontally scrolling code reachable by keyboard. The release suite exercises themes at desktop and narrow widths, keyboard controls and accessible names.

- Add an optional documentation assistant with localized sources, streamed responses through the Vercel AI SDK and a document excerpt mode for sites without model credentials.

- Compile Markdown and MDX into a page manifest, theme-ready components and a search index for each language.
- Use the Next.js App Router adapter to export static HTML or embed the React renderer in an existing application.
- Start with a built-in style or provide your own layout and component mapping. GTA6 combines comic lettering and neon-pink navigation with a paper-toned reading surface.
- Create English, Simplified Chinese or bilingual projects with the interactive CLI and Starter or Blank templates.
- Bundle the selected theme in CLI-generated sites and update its layout and CSS when the project switches styles.
- Install standalone React components with React and the dependency-free `@varydocs/model` package. The content compiler remains available through `@varydocs/core`.
