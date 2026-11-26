# @varydocs/ai

Add a documentation assistant to a React 19.2.1+ reader. Supply the current page and language so readers can open sources in context.

```tsx
import { AskAI } from '@varydocs/ai';
import '@varydocs/ai/styles.css';

export function AskAboutThisPage() {
  return <AskAI endpoint="/api/ask/" pageId="index" pageTitle="Getting started" locale="en" />;
}
```

On the server, pass `locales`, `defaultLocale` and `searchByLocale` from the compiler output to `createDocsChatHandler` from `@varydocs/ai/server`. The returned function handles POST requests and streams matching excerpts with source links. Supply a Vercel AI SDK language model through the optional `model` argument to generate answers. Pass `basePath` when the site is deployed under a prefix.

The CLI's `init --assistant` template wires up both ends and forwards `AI_GATEWAY_API_KEY` and `VARYDOCS_AI_MODEL` to AI Gateway on the server. A static frontend can reach a separately hosted handler through a same-origin proxy.

With a model that supports tool calling, pass `searchDocumentation: true` to let the assistant search the current language's compiled index again when the initial passages are insufficient. The handler permits one supplemental search per answer and validates the resulting links against the manifest. In the CLI template, set the server variable `VARYDOCS_AI_DOCUMENT_SEARCH=1` to enable this option.

Generated assistant sites let readers switch between a floating window and a docked right column. Chapter links in answers open the referenced section while the conversation stays open.

For an existing React app, wrap your documents and their `AskAI` trigger with `<AssistantLayout navigate={navigate}>` from `@varydocs/ai`. Keep the layout above the routes that change on document navigation. Pass your router's same-tab navigation function, which receives a root-relative URL including the section fragment. This keeps the conversation and draft mounted as each page updates its `AskAI` props. The standalone `AskAI` trigger can also open a floating window.

The template enables a per-process rate limit and writes structured usage and rating events to the server log. Set `VARYDOCS_AI_REQUESTS_PER_MINUTE` to change the chat limit. In an existing app, pass an `operations` object to `createDocsChatHandler` and supply an `onEvent` callback to forward events to your logging or metrics service. Events include a response ID and document context, and omit questions, answers and credentials.

Ratings use recent response IDs held by the server instance that issued them. The same rating can be retried without duplicating the event. For multiple replicas, keep a reader on the same instance for chat and ratings, and apply a shared limit at your deployment gateway.
