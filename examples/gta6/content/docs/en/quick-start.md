---
title: Quick start
description: Create a GTA6-themed Next.js documentation site from a local VaryDocs checkout.
---

## Create the site

From the repository root, install the workspace dependencies and generate a bilingual starter. The wizard installs the packaged SDK into the new project.

```sh
pnpm install
pnpm create:local my-varydocs --style gta6 --language bilingual --package-manager pnpm --yes --install
cd my-varydocs
pnpm dev
```

Open `/docs/` on the local server for English or `/zh-CN/docs/` for Chinese.

## Make an edit

Change the description in `content/docs/en/index.mdx`. Save it and check the text beneath the page title. The Chinese introduction lives in `content/docs/zh-CN/index.mdx`.

## Build for deployment

```sh
pnpm run check
pnpm build
```

With the default static starter, the exported site is in `out/`. Upload that directory to a static host. To add another guide first, follow [Writing content](./writing-content.mdx).
