---
description: >-
  Guide to using @vertana/context-web for fetching and extracting content
  from linked web pages to provide additional translation context.
---

Web context
===========

The *@vertana/context-web* package provides context sources that fetch and
extract content from web pages.  This is useful when translating documents
that reference external articles or resources.


Installation
------------

::: code-group

~~~~ bash [Deno]
deno add jsr:@vertana/context-web
~~~~

~~~~ bash [npm]
npm add @vertana/context-web
~~~~

~~~~ bash [pnpm]
pnpm add @vertana/context-web
~~~~

~~~~ bash [Yarn]
yarn add @vertana/context-web
~~~~

~~~~ bash [Bun]
bun add @vertana/context-web
~~~~

:::


Overview
--------

This package provides three main context sources:

[`fetchWebPage`](#fetchwebpage)
:   A passive context source that fetches a single URL on demand.
    The LLM can call this tool when it needs additional context.

[`searchWeb`](#searchweb)
:   A passive context source that performs a web search and returns a list
    of results (title, URL, snippet).

[`fetchLinkedPages`](#fetchlinkedpages)
:   A required context source factory that extracts links from the source
    text and fetches their content before translation begins.

`fetchWebPage` and `fetchLinkedPages` use [Mozilla's Readability] algorithm
to extract the main article content from web pages, filtering out navigation,
ads, and other noise.

> [!TIP]
> Prefer the *passive* sources (`fetchWebPage`, `searchWeb`) for most use
> cases.  The translator only invokes them when it actually needs the
> information, which keeps the prompt focused on the source text.  The
> *required* `fetchLinkedPages` helper is convenient for short, trusted link
> sets, but pulling many large pages into required context can cause the
> translator to echo a fetched page back as the translation; see the
> [warning below](#fetchlinkedpages) before using it on large or untrusted
> documents.

[Mozilla's Readability]: https://github.com/mozilla/readability


`fetchWebPage`
--------------

A passive context source that the LLM can invoke when it needs to fetch
a specific URL.

~~~~ typescript twoslash
import type { LanguageModel } from "ai";
declare const model: LanguageModel;
// ---cut-before---
import { translate } from "@vertana/facade";
import { fetchWebPage } from "@vertana/context-web";

const text = `
This article discusses the concept explained at https://example.com/guide.
`;

const result = await translate(model, "ko", text, {
  contextSources: [fetchWebPage],
});
~~~~

When the LLM encounters a reference it wants to understand better, it can
call the `fetch-web-page` tool with the URL to retrieve the page content.


`fetchLinkedPages`
------------------

A factory function that creates a required context source.  It extracts
URLs from the source text and fetches their content before translation
begins.  By default it fetches up to ten links (configurable via
`maxLinks`).

> [!WARNING]
> Pulling many large pages into *required* context can confuse the
> translator: when the combined reference material is much larger than the
> source text, and especially when it is in the target language, the model
> may echo a fetched page back instead of translating the actual input.  For
> large or untrusted link sets, prefer the passive
> [`fetchWebPage`](#fetchwebpage) source so the translator only fetches what
> it actually needs.

~~~~ typescript twoslash
import type { LanguageModel } from "ai";
declare const model: LanguageModel;
// ---cut-before---
import { translate } from "@vertana/facade";
import { fetchLinkedPages } from "@vertana/context-web";

const text = `
Check out https://example.com/article for background.
Also see https://example.com/reference for more details.
`;

const result = await translate(model, "ko", text, {
  contextSources: [
    fetchLinkedPages({
      text,
      mediaType: "text/plain",
    }),
  ],
});
~~~~


### Options

`text`
:   The source text to extract links from.

`mediaType`
:   The media type of the text (`"text/plain"`, `"text/markdown"`,
    or `"text/html"`).  This affects how links are extracted.

`maxLinks`
:   Maximum number of links to fetch.  Defaults to `10`.

`timeout`
:   Timeout for each fetch request in milliseconds.  Defaults to `10000`.


`searchWeb`
-----------

A passive context source that the LLM can invoke when it needs to perform
web search.  This source only returns a list of results and does not fetch
any result pages.

~~~~ typescript twoslash
import type { LanguageModel } from "ai";
declare const model: LanguageModel;
// ---cut-before---
import { translate } from "@vertana/facade";
import { searchWeb } from "@vertana/context-web";

const text = "Please translate this and cite sources.";

const result = await translate(model, "ko", text, {
  contextSources: [searchWeb],
});
~~~~

When the LLM needs to find a relevant resource, it can call the `search-web`
tool with a query to obtain a list of results (title, URL, snippet).


### Options

`query`
:   The search query keyword(s).

`maxResults`
:   Maximum number of results to return.  Defaults to `10`.

`region`
:   DuckDuckGo region parameter (`kl`), e.g. `"kr-kr"` or `"us-en"`.

`timeRange`
:   Time range filter (`df`): `"d"` (day), `"w"` (week), `"m"` (month),
    `"y"` (year).


Combining sources
-----------------

For most cases, combining the two passive sources gives the LLM enough
flexibility to gather context only when it actually helps the translation:

 1. `fetchWebPage` lets the LLM fetch a specific URL for more detail.
 2. `searchWeb` helps the LLM find relevant pages when the input has no links.

~~~~ typescript twoslash
import type { LanguageModel } from "ai";
declare const model: LanguageModel;
// ---cut-before---
import { translate } from "@vertana/facade";
import { fetchWebPage, searchWeb } from "@vertana/context-web";

const text = `
Read the introduction at https://example.com/intro.
`;

const result = await translate(model, "ko", text, {
  contextSources: [
    // The LLM may fetch a specific URL when it needs more context.
    fetchWebPage,
    // The LLM may run a web search when it needs more context.
    searchWeb,
  ],
});
~~~~

If the source text has a small, trusted set of links you want pulled in
up-front, you can add `fetchLinkedPages` alongside the passive sources.
Mind the warning in the [`fetchLinkedPages`](#fetchlinkedpages) section
above before doing so on large or untrusted documents:

~~~~ typescript twoslash
import type { LanguageModel } from "ai";
declare const model: LanguageModel;
// ---cut-before---
import { translate } from "@vertana/facade";
import { fetchLinkedPages, fetchWebPage, searchWeb } from "@vertana/context-web";

const text = `
Read the introduction at https://example.com/intro.
`;

const result = await translate(model, "ko", text, {
  contextSources: [
    fetchLinkedPages({ text, mediaType: "text/plain" }),
    fetchWebPage,
    searchWeb,
  ],
});
~~~~


extractLinks utility
--------------------

The `extractLinks` function extracts URLs from text.  It's used internally
by `fetchLinkedPages` but is also exported for custom use cases.

~~~~ typescript twoslash
import { extractLinks } from "@vertana/context-web";

// From plain text
const plainUrls = extractLinks(
  "Check https://example.com for info.",
  "text/plain"
);
// => ["https://example.com"]

// From Markdown
const mdUrls = extractLinks(
  "See [this article](https://example.com/article).",
  "text/markdown"
);
// => ["https://example.com/article"]

// From HTML
const htmlUrls = extractLinks(
  '<a href="https://example.com">Link</a>',
  "text/html"
);
// => ["https://example.com"]
~~~~


CLI usage
---------

The Vertana CLI includes the `-L` or `--fetch-links` flag that enables
web context fetching:

~~~~ bash
vertana translate -t ko -L document.md
~~~~

This automatically:

 1. Extracts links from the input document.
 2. Fetches and extracts content from those linked pages.
 3. Provides the content as context for translation.

This flag wires up `fetchLinkedPages`, so the same caveat applies: it is
appropriate for documents with a short set of links you trust, but on
inputs with many large linked pages the fetched material can dominate the
prompt and cause the translator to echo a fetched page back as the
translation.  Treat `-L` as an opt-in convenience for those cases, not as
a default.

See the [*CLI reference*](./cli.md) for more details.
