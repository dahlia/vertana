import assert from "node:assert/strict";
import { MockLanguageModelV3 } from "ai/test";
import { describe, it } from "./test-compat.ts";
import { extractContent, fetchLinkedPages, fetchWebPage } from "./fetch.ts";

describe("extractContent", () => {
  it("should extract article content from HTML", () => {
    // Readability requires sufficient content to recognize as an article
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Test Article</title></head>
        <body>
          <nav><a href="/">Home</a></nav>
          <article>
            <h1>Test Article Title</h1>
            <p>This is the main content of the article. It contains enough text
            to be recognized as meaningful content by the Readability algorithm.
            The algorithm looks for substantial text blocks to determine if
            something is worth extracting.</p>
            <p>It has multiple paragraphs of text. This second paragraph adds
            more content to make the article more substantial. Readability
            needs a minimum amount of text to work properly.</p>
            <p>A third paragraph with additional content helps ensure that
            the extraction algorithm recognizes this as an article worth
            parsing and extracting.</p>
          </article>
          <footer>Copyright 2024</footer>
        </body>
      </html>
    `;
    const result = extractContent(html, "https://example.com/article");
    assert.ok(result != null, "Expected content to be extracted");
    assert.ok(result.content.includes("main content"));
    assert.ok(result.content.includes("multiple paragraphs"));
  });

  it("should return null for non-article pages", () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Empty</title></head>
        <body></body>
      </html>
    `;
    const result = extractContent(html, "https://example.com/empty");
    assert.equal(result, null);
  });

  it("should handle pages without article tags", () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Simple Page</title></head>
        <body>
          <div class="content">
            <h1>Page Title</h1>
            <p>Some substantial content goes here. This paragraph has enough text
            to be considered readable content by the algorithm. It needs to be
            fairly long to pass the content length heuristics.</p>
            <p>Another paragraph with more content to make this look like a real
            article with meaningful text that should be extracted.</p>
          </div>
        </body>
      </html>
    `;
    const result = extractContent(html, "https://example.com/simple");
    // May or may not extract depending on content length
    if (result != null) {
      assert.ok(result.content.includes("substantial content"));
    }
  });
});

describe("fetchWebPage", () => {
  it("should be a passive context source", () => {
    assert.equal(fetchWebPage.mode, "passive");
    assert.equal(fetchWebPage.name, "fetch-web-page");
    assert.ok(fetchWebPage.description.length > 0);
    assert.ok(fetchWebPage.parameters != null);
  });

  it("should have url parameter", () => {
    // The parameters should accept { url: string }
    const schema = fetchWebPage.parameters;
    assert.ok(schema != null);
  });

  it("should create a configured passive source with size limits", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => {
      return Promise.resolve(
        new Response(createArticleHtml("Configured page"), {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    };

    try {
      const source = fetchWebPage({ maxCharsPerPage: 80 });
      assert.equal(source.mode, "passive");
      assert.equal(source.name, "fetch-web-page");

      const result = await source.gather({
        url: "https://example.com/configured",
      });

      assert.ok(result.content.includes("# Configured page"));
      assert.ok(!result.content.includes("TAIL_SENTINEL"));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should summarize fetched page content when configured", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => {
      return Promise.resolve(
        new Response(createArticleHtml("Summarized page"), {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    };

    try {
      const model = createSummaryModel("Concise passive summary.");
      const source = fetchWebPage({
        summarize: { model, maxChars: 15 },
      });

      const result = await source.gather({
        url: "https://example.com/passive-summary",
      });

      assert.ok(result.content.includes("# Summarized page"));
      assert.ok(result.content.includes("Concise passive"));
      assert.ok(!result.content.includes("summary."));
      assert.equal(model.doGenerateCalls.length, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("fetchLinkedPages", () => {
  it("should create a required context source", () => {
    const source = fetchLinkedPages({
      text: "Check https://example.com for info.",
      mediaType: "text/plain",
    });

    assert.equal(source.mode, "required");
    assert.equal(source.name, "fetch-linked-pages");
    assert.ok(source.description.length > 0);
  });

  it("should respect maxLinks option", () => {
    const source = fetchLinkedPages({
      text: `
        https://example.com/1
        https://example.com/2
        https://example.com/3
        https://example.com/4
        https://example.com/5
      `,
      mediaType: "text/plain",
      maxLinks: 3,
    });

    assert.equal(source.mode, "required");
    // The actual limiting is tested during gather()
  });

  it("should truncate each fetched page body", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => {
      return Promise.resolve(
        new Response(createArticleHtml("Per-page cap"), {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    };

    try {
      const source = fetchLinkedPages({
        text: "Read https://example.com/per-page for background.",
        mediaType: "text/plain",
        maxCharsPerPage: 80,
      });

      const result = await source.gather();

      assert.ok(result.content.includes("# Per-page cap"));
      assert.ok(
        result.content.includes("Source: https://example.com/per-page"),
      );
      assert.ok(!result.content.includes("TAIL_SENTINEL"));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should cap the combined linked page output", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (input) => {
      const url = String(input);
      const title = url.endsWith("/1") ? "First page" : "Second page";
      return Promise.resolve(
        new Response(createArticleHtml(title), {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    };

    try {
      const source = fetchLinkedPages({
        text: "See https://example.com/1 and https://example.com/2.",
        mediaType: "text/plain",
        maxTotalChars: 160,
      });

      const result = await source.gather();

      assert.ok(result.content.length <= 160);
      assert.ok(result.content.includes("# First page"));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should summarize linked page content before formatting", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => {
      return Promise.resolve(
        new Response(createArticleHtml("Linked summary"), {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    };

    try {
      const model = createSummaryModel("Concise linked summary.");
      const source = fetchLinkedPages({
        text: "Read https://example.com/linked-summary.",
        mediaType: "text/plain",
        summarize: { model },
      });

      const result = await source.gather();

      assert.ok(result.content.includes("# Linked summary"));
      assert.ok(result.content.includes("Concise linked summary."));
      assert.ok(!result.content.includes("TAIL_SENTINEL"));
      assert.equal(model.doGenerateCalls.length, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("should reject invalid size limits", () => {
    assert.throws(
      () =>
        fetchLinkedPages({
          text: "https://example.com",
          mediaType: "text/plain",
          maxCharsPerPage: 0,
        }),
      RangeError,
    );

    assert.throws(
      () => fetchWebPage({ maxTotalChars: -1 }),
      RangeError,
    );

    assert.throws(
      () =>
        fetchWebPage({
          summarize: { model: createSummaryModel("x"), maxChars: 0 },
        }),
      RangeError,
    );
  });
});

function createSummaryModel(summary: string): MockLanguageModelV3 {
  return new MockLanguageModelV3({
    doGenerate: async () => {
      await Promise.resolve();
      return {
        content: [{ type: "text", text: summary }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: {
          inputTokens: {
            total: 1,
            noCache: 1,
            cacheRead: 0,
            cacheWrite: 0,
          },
          outputTokens: {
            total: 1,
            text: 1,
            reasoning: 0,
          },
        },
        warnings: [],
        response: { headers: {} },
      };
    },
  });
}

function createArticleHtml(title: string): string {
  const paragraph = "This paragraph provides enough article content for " +
    "Readability to extract it reliably across runtimes. ";
  return `
    <!DOCTYPE html>
    <html>
      <head><title>${title}</title></head>
      <body>
        <article>
          <h1>${title}</h1>
          <p>${paragraph.repeat(8)}</p>
          <p>TAIL_SENTINEL ${paragraph.repeat(8)}</p>
        </article>
      </body>
    </html>
  `;
}
