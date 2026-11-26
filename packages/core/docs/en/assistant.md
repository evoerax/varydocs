---
title: Ask AI
description: Add a documentation assistant with answers grounded in the current language and links to the original sections.
---

## Create a site with the sidebar

From an installed checkout, run the following commands.

~~~sh
pnpm create:local my-varydocs --assistant --style swiss --language bilingual --yes --install
cd my-varydocs
npm run dev
~~~

Open a documentation page and choose **Ask AI** next to search. Select a suggested heading, then ask “Can you give me an example?” to stay with that section. To explore a different topic, name it in your next question.

Use the layout button beside Close to switch between a floating window and a docked right column. The site remembers your choice and uses the floating window when space is limited. Follow a chapter link in an answer to jump to the original heading while keeping the conversation and draft open. The next question uses the newly opened page.

You can stop a response and choose **Try again** to repeat the question. Closing the assistant stops an active response and keeps the conversation. Once the chat has messages, **New chat** appears in the header. It stops the current response and clears the history while keeping any unsent draft.

## Enable generated answers

To enable model-generated answers, set the server environment variables `AI_GATEWAY_API_KEY` and `VARYDOCS_AI_MODEL` in Next.js or in the generated site's `.env.local`, then restart the server. Use a model ID from your Vercel AI Gateway account. Keep the key on the server. With no model configured, the assistant shows excerpts with links to the original sections.

The browser sends the conversation, current page ID and language to `POST /api/ask/`. The server selects matching sections from that language's search index and supplies them to the model as context. Readers see the response as it streams and can follow links built from the site's own manifest.

To deploy this template, build with `npm run build` and serve with `npm start`, or use a host that runs Next.js route handlers. A public model-backed endpoint uses the site's model quota. Apply your host's access and rate controls when making it public.

## Enable supplemental document search

With a model that supports tool calling, set the server environment variable `VARYDOCS_AI_DOCUMENT_SEARCH=1` and restart the generated site. When the first search finds too little, the assistant can refine its query and run a second search in the current language. Links to newly found sections are validated against the documentation manifest.

## Use the sidebar on an existing site

Install `@varydocs/ai` in the application. Pass the button to the reader's `headerActions` slot. This example assumes that a server handles the same-origin path `/api/ask/`.

~~~jsx
import { AskAI } from '@varydocs/ai';
import '@varydocs/ai/styles.css';

<DocsView {...props} theme={theme} headerActions={
  <AskAI endpoint="/api/ask/" locale={props.manifest.locale}
    pageId={props.page.id} pageTitle={props.page.title}
    headings={props.page.headings.map(heading => heading.title)} />
} />
~~~

To support docking and keep chats open across citation clicks, wrap the reader in `AssistantLayout` from `@varydocs/ai` above your document routes. Pass the router's navigation function as `navigate` and keep the layout mounted across documents.

If your frontend stays on a static host, run the assistant API in a separate server service and proxy the frontend's same-origin `/api/ask/` to it. Import `createDocsChatHandler` from `@varydocs/ai/server` in that service, and supply the compiled `locales`, `searchByLocale`, and `defaultLocale`. Pass a Vercel AI SDK language model in the optional `model` field to use your own provider. With a tool-capable model, set `searchDocumentation: true` in the handler options to enable supplemental search.

If the website lives under a subpath such as `/product/`, set the button's endpoint to `/product/api/ask/` and pass the same URL prefix, `basePath: '/product'`, to the server handler. The handler uses the deployment prefix in its citation links.

## Track usage and answer feedback

The CLI assistant accepts 30 chat requests per minute per server process. Set `VARYDOCS_AI_REQUESTS_PER_MINUTE` to change the limit. The endpoint sends HTTP 429 and `Retry-After` when the limit is reached. Set a shared limit at your deployment gateway for multiple replicas.

Readers can rate a completed reply. Look for JSON lines prefixed with `[varydocs:assistant]` in the server log. Usage events distinguish model replies, excerpts and no matches, and record latency, outcome and provider-reported tokens. Use the response ID to match a rating to its usage event. These events log document identifiers and metrics. Existing apps can forward them through `operations.onEvent` on the server handler.

Each reply accepts one rating, and retrying the same vote records it once. Recent response IDs live on the server instance that issued them. Use session affinity to keep chat and rating requests on the same instance when deploying multiple replicas.
