---
description: >-
  Guide to using context sources in Vertana to provide additional information
  for improved translation quality.
---

Context sources
===============

Context sources provide additional information to improve translation quality.
They can supply background knowledge, style guides, terminology databases, or
any external information relevant to the translation.


What are context sources?
-------------------------

Context sources are functions that gather information before or during
translation.  This context helps the LLM make better translation decisions by
understanding:

 -  The author's writing style
 -  Domain-specific terminology
 -  Document metadata
 -  Related content or references


Two modes of operation
----------------------

Context sources operate in two modes:

`required`
:   Always invoked before translation begins.  Use for essential context like
    author information or document metadata.

`passive`
:   Exposed as tools the LLM can call on demand.  Use for optional context the
    LLM requests when needed, like looking up specific terms.


Required context sources
------------------------

Required sources run automatically before translation starts.  They provide
context that's always relevant.


### Creating a required source

~~~~ typescript twoslash
import type { RequiredContextSource } from "@vertana/core/context";

const authorBioSource: RequiredContextSource = {
  name: "author-bio",
  description: "Author biography and writing style notes",
  mode: "required",
  async gather(options) {
    // Fetch or compute the context
    const bio = await fetchAuthorBio();
    return {
      content: `Author: Jane Smith. Style: Technical but accessible.`,
      metadata: { authorId: "jane-smith" },
    };
  },
};

async function fetchAuthorBio(): Promise<string> {
  return "Jane Smith is a technical writer...";
}
~~~~


### Using required sources

Pass context sources to the `translate()` function:

~~~~ typescript twoslash
import type { RequiredContextSource } from "@vertana/core/context";
const authorBioSource: RequiredContextSource = {
  name: "author-bio",
  description: "Author biography",
  mode: "required",
  async gather() { return { content: "" }; },
};
const document: string = "";
// ---cut-before---
import { translate } from "@vertana/facade";
import { openai } from "@ai-sdk/openai";

const result = await translate(
  openai("gpt-4o"),
  "ko",
  document,
  {
    contextSources: [authorBioSource],
  }
);
~~~~


Passive context sources
-----------------------

Passive sources are tools the LLM can invoke when it needs specific
information.  They require a parameter schema so the LLM knows how to call
them.


### Creating a passive source

Passive sources need a parameter schema using Standard Schema:

~~~~ typescript twoslash
import type { PassiveContextSource } from "@vertana/core/context";
import { z } from "zod";

const termLookupSource: PassiveContextSource<{ term: string }> = {
  name: "term-lookup",
  description: "Look up the definition and translation of a technical term",
  mode: "passive",
  parameters: z.object({
    term: z.string().describe("The term to look up"),
  }),
  async gather(params, options) {
    const definition = await lookupTerm(params.term);
    return {
      content: definition,
      metadata: { term: params.term },
    };
  },
};

async function lookupTerm(term: string): Promise<string> {
  // Look up from a terminology database
  return `${term}: A technical concept...`;
}
~~~~


### When passive sources are called

The LLM decides when to call passive sources based on:

 -  The source's `name` and `description`
 -  The translation content and domain
 -  Whether it encounters unfamiliar terms or concepts

For example, if translating technical documentation and encountering an
unfamiliar acronym, the LLM might call a term lookup source.


Standard Schema compatibility
-----------------------------

Passive sources use [Standard Schema] for parameter definitions.  This allows
you to use any compatible schema library:

[Standard Schema]: https://standardschema.dev/


### Using Zod

~~~~ typescript twoslash
import type { PassiveContextSource } from "@vertana/core/context";
import { z } from "zod";

const source: PassiveContextSource<{ query: string; limit: number }> = {
  name: "search",
  description: "Search for related articles",
  mode: "passive",
  parameters: z.object({
    query: z.string().describe("Search query"),
    limit: z.number().describe("Maximum results"),
  }),
  async gather(params) {
    return { content: `Results for: ${params.query}` };
  },
};
~~~~


### Using Valibot

~~~~ typescript twoslash
import type { PassiveContextSource } from "@vertana/core/context";
import * as v from "valibot";

const source: PassiveContextSource<{ query: string }> = {
  name: "search",
  description: "Search for related articles",
  mode: "passive",
  parameters: v.object({
    query: v.pipe(v.string(), v.description("Search query")),
  }),
  async gather(params) {
    return { content: `Results for: ${params.query}` };
  },
};
~~~~


### Using ArkType

~~~~ typescript twoslash
import type { PassiveContextSource } from "@vertana/core/context";
import { type } from "arktype";

const source: PassiveContextSource<{ query: string }> = {
  name: "search",
  description: "Search for related articles",
  mode: "passive",
  parameters: type({
    query: "string",
  }),
  async gather(params) {
    return { content: `Results for: ${params.query}` };
  },
};
~~~~


Helper functions
----------------

Vertana provides helper functions for working with context sources.


### Gathering required context

~~~~ typescript twoslash
import type { ContextSource } from "@vertana/core/context";
const sources: ContextSource[] = [];
// ---cut-before---
import { gatherRequiredContext } from "@vertana/core/context";

const results = await gatherRequiredContext(sources);
// Only required sources are invoked
~~~~


### Combining context results

~~~~ typescript twoslash
import type { ContextResult } from "@vertana/core/context";
const results: ContextResult[] = [];
// ---cut-before---
import { combineContextResults } from "@vertana/core/context";

const combined = combineContextResults(results);
// Returns a single string with all context content
~~~~


Practical examples
------------------


### Style guide source

Provide a style guide for consistent tone:

~~~~ typescript twoslash
import type { RequiredContextSource } from "@vertana/core/context";

const styleGuideSource: RequiredContextSource = {
  name: "style-guide",
  description: "Company style guide for translations",
  mode: "required",
  async gather() {
    return {
      content: `
Style Guide:
- Use formal language (합쇼체 in Korean)
- Avoid idioms that don't translate well
- Keep sentences concise
- Use active voice when possible
      `.trim(),
    };
  },
};
~~~~


### Document metadata source

Include metadata about the document:

~~~~ typescript twoslash
import type { RequiredContextSource } from "@vertana/core/context";

interface DocumentMetadata {
  readonly title: string;
  readonly author: string;
  readonly date: string;
  readonly category: string;
  readonly [key: string]: unknown;
}

function createMetadataSource(metadata: DocumentMetadata): RequiredContextSource {
  return {
    name: "document-metadata",
    description: "Information about the document being translated",
    mode: "required",
    async gather() {
      return {
        content: `
Document: ${metadata.title}
Author: ${metadata.author}
Date: ${metadata.date}
Category: ${metadata.category}
        `.trim(),
        metadata,
      };
    },
  };
}
~~~~


### Terminology database lookup

Allow the LLM to look up terms on demand:

~~~~ typescript twoslash
import type { PassiveContextSource } from "@vertana/core/context";
import { z } from "zod";

interface TermEntry {
  term: string;
  definition: string;
  translation: string;
}

function createTermDatabaseSource(
  database: Map<string, TermEntry>,
): PassiveContextSource<{ term: string }> {
  return {
    name: "terminology-database",
    description: "Look up technical terms and their official translations",
    mode: "passive",
    parameters: z.object({
      term: z.string().describe("The term to look up"),
    }),
    async gather(params) {
      const entry = database.get(params.term.toLowerCase());
      if (entry == null) {
        return { content: `Term "${params.term}" not found in database.` };
      }
      return {
        content: `
Term: ${entry.term}
Definition: ${entry.definition}
Official translation: ${entry.translation}
        `.trim(),
        metadata: { found: true },
      };
    },
  };
}
~~~~


Built-in context sources
------------------------

Vertana provides ready-to-use context sources through separate packages.


### Web context (`@vertana/context-web`)

The `@vertana/context-web` package provides context sources for fetching
and extracting content from web pages.  This is useful when translating
documents that reference external articles or resources.  The recommended
default is the *passive* `fetchWebPage` source so the translator only
fetches when it decides it needs more context:

~~~~ typescript twoslash
import type { LanguageModel } from "ai";
declare const model: LanguageModel;
// ---cut-before---
import { translate } from "@vertana/facade";
import { fetchWebPage } from "@vertana/context-web";

const text = `
Read the introduction at https://example.com/intro.
`;

const result = await translate(model, "ko", text, {
  contextSources: [
    // The LLM may fetch a specific URL when it needs more context.
    fetchWebPage,
  ],
});
~~~~

See the [Web context](/manuals/context-web) guide for detailed documentation,
including the *required* `fetchLinkedPages` helper for short, trusted link
sets.


Best practices
--------------


### Keep context focused

Provide only relevant information.  Too much context can confuse the LLM:

~~~~ typescript twoslash
import type { RequiredContextSource } from "@vertana/core/context";

// Good: focused context
const focused: RequiredContextSource = {
  name: "domain-context",
  description: "Medical domain context",
  mode: "required",
  async gather() {
    return {
      content: "This is a medical case study. Use formal medical terminology.",
    };
  },
};
~~~~


### Use passive sources for optional lookups

Don't make every source required.  Use passive sources for information the LLM
might not always need:

~~~~ typescript twoslash
import type { PassiveContextSource } from "@vertana/core/context";
import { z } from "zod";

// Good: passive source for on-demand lookup
const referenceLookup: PassiveContextSource<{ url: string }> = {
  name: "reference-lookup",
  description: "Fetch content from a referenced URL for context",
  mode: "passive",
  parameters: z.object({
    url: z.string().url().describe("The URL to fetch"),
  }),
  async gather(params) {
    const content = await fetch(params.url).then((r) => r.text());
    return { content: content.slice(0, 1000) };  // Limit content size
  },
};
~~~~


### Include metadata for debugging

Add metadata to track which sources contributed to the translation:

~~~~ typescript twoslash
import type { RequiredContextSource } from "@vertana/core/context";

const source: RequiredContextSource = {
  name: "glossary",
  description: "Domain glossary",
  mode: "required",
  async gather() {
    const terms = await loadGlossary();
    return {
      content: formatGlossary(terms),
      metadata: {
        termCount: terms.length,
        lastUpdated: new Date().toISOString(),
      },
    };
  },
};

async function loadGlossary(): Promise<string[]> {
  return ["term1", "term2"];
}

function formatGlossary(terms: string[]): string {
  return terms.join("\n");
}
~~~~
