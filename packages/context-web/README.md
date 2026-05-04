# @vertana/context-web

[![JSR][JSR badge]][JSR]
[![npm][npm badge]][npm]

Web context gathering for [Vertana] — fetch and extract content from
linked pages to provide additional context for translation.

[JSR]: https://jsr.io/@vertana/context-web
[JSR badge]: https://jsr.io/badges/@vertana/context-web
[npm]: https://www.npmjs.com/package/@vertana/context-web
[npm badge]: https://img.shields.io/npm/v/@vertana/context-web
[Vertana]: https://vertana.org/


Features
--------

The recommended way to give the translator access to web context is to expose
*passive* sources, which the translator only invokes when it decides it
actually needs them:

 -  `fetchWebPage`: A passive context source that fetches a single URL and
    extracts the main content using Mozilla's [Readability] algorithm.  The
    LLM calls it on demand with a specific URL.
 -  `searchWeb`: A passive context source that performs a web search
    (DuckDuckGo Lite) and returns a list of results (title, URL, snippet).

A *required* helper is also provided for short, trusted link sets where you
want links fetched up-front:

 -  `fetchLinkedPages`: A required context source factory that extracts
    links from the source text and fetches their content before translation
    begins.  By default it fetches up to ten links (configurable via
    `maxLinks`).  This is a convenience helper; see the warning below
    before using it on large or untrusted documents.

Plus a low-level utility:

 -  `extractLinks`: Extracts URLs from text in various formats (plain text,
    Markdown, HTML).

[Readability]: https://github.com/mozilla/readability


Installation
------------

### Deno

~~~~ bash
deno add jsr:@vertana/context-web
~~~~

### npm

~~~~ bash
npm add @vertana/context-web
~~~~

### pnpm

~~~~ bash
pnpm add @vertana/context-web
~~~~


Usage
-----

The recommended pattern uses passive sources, so the translator decides
which URLs (if any) are worth fetching:

~~~~ typescript
import { translate } from "@vertana/facade";
import { fetchWebPage, searchWeb } from "@vertana/context-web";
import { openai } from "@ai-sdk/openai";

const text = `
Check out this article: https://example.com/article
It explains the concept in detail.
`;

const result = await translate(openai("gpt-4o"), "ko", text, {
  contextSources: [
    // The translator may fetch a specific URL when it needs more context.
    fetchWebPage,
    // The translator may run a web search when it needs more context.
    searchWeb,
  ],
});
~~~~

### Eagerly fetching linked pages

If you have a short, trusted set of links and you want them pulled in before
translation begins, `fetchLinkedPages` does that (up to ten links by default;
raise `maxLinks` to widen or lower the cap):

~~~~ typescript
import { translate } from "@vertana/facade";
import { fetchLinkedPages } from "@vertana/context-web";
import { openai } from "@ai-sdk/openai";

const text = "Check out https://example.com/article for details.";

const result = await translate(openai("gpt-4o"), "ko", text, {
  contextSources: [
    fetchLinkedPages({ text, mediaType: "text/plain" }),
  ],
});
~~~~

> [!WARNING]
> Pulling many large pages into *required* context can confuse the
> translator: when the combined reference material is much larger than the
> source text, and especially when it is in the target language, the model
> may echo a fetched page back instead of translating the actual input.  For
> large or untrusted link sets, prefer the passive `fetchWebPage` source
> above so the translator only fetches what it actually needs.


License
-------

[MIT License](../../LICENSE)
