import { getLogger } from "@logtape/logtape";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import type {
  ContextSourceGatherOptions,
  PassiveContextSource,
  RequiredContextSource,
} from "@vertana/core/context";
import { z } from "zod";
import { extractLinks, type MediaType } from "./extract-links.ts";

const logger = getLogger(["vertana", "context-web", "fetch"]);

/**
 * Result of extracting content from a web page.
 *
 * @since 0.1.0
 */
export interface ExtractedContent {
  /**
   * The title of the article.
   */
  readonly title: string;

  /**
   * The extracted main content as plain text.
   */
  readonly content: string;

  /**
   * The byline (author) if available.
   */
  readonly byline?: string;

  /**
   * The excerpt if available.
   */
  readonly excerpt?: string;
}

/**
 * Extracts the main content from an HTML page using Mozilla's Readability.
 *
 * @param html The HTML content to extract from.
 * @param url The URL of the page (used for resolving relative links).
 * @returns The extracted content, or null if extraction failed.
 * @since 0.1.0
 */
export function extractContent(
  html: string,
  url: string,
): ExtractedContent | null {
  // deno-lint-ignore no-explicit-any
  const window = parseHTML(html, "text/html") as any;
  const document = window.document;

  // Set the base URL for relative link resolution
  const baseElement = document.createElement("base");
  baseElement.href = url;
  document.head.appendChild(baseElement);

  const reader = new Readability(document);
  const article = reader.parse();

  if (article == null) {
    return null;
  }

  const title = article.title ?? "";
  const content = article.textContent ?? "";

  if (title.length === 0 && content.length === 0) {
    return null;
  }

  return {
    title,
    content,
    byline: article.byline ?? undefined,
    excerpt: article.excerpt ?? undefined,
  };
}

/**
 * Fetches a URL and extracts its main content.
 *
 * @param url The URL to fetch.
 * @param options Fetch options.
 * @returns The extracted content, or null if fetch or extraction failed.
 */
async function fetchAndExtract(
  url: string,
  options?: {
    readonly signal?: AbortSignal;
    readonly timeout?: number;
  },
): Promise<ExtractedContent | null> {
  const timeout = options?.timeout ?? 10000;

  logger.debug("Fetching URL: {url}...", { url });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Combine with external signal if provided
    if (options?.signal != null) {
      options.signal.addEventListener("abort", () => controller.abort());
    }

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Vertana/0.1; +https://vertana.org)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn("Failed to fetch URL: {url}, status: {status}", {
        url,
        status: response.status,
      });
      return null;
    }

    const contentType = response.headers.get("content-type");
    if (contentType != null && !contentType.includes("text/html")) {
      logger.debug("Skipping non-HTML content: {url}, type: {contentType}", {
        url,
        contentType,
      });
      return null;
    }

    const html = await response.text();
    const content = extractContent(html, url);

    if (content == null) {
      logger.debug("Failed to extract content from: {url}", { url });
      return null;
    }

    logger.debug("Extracted content from: {url}, title: {title}", {
      url,
      title: content.title,
    });

    return content;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      logger.debug("Fetch aborted for: {url}", { url });
    } else {
      logger.warn("Error fetching URL: {url}, error: {error}", {
        url,
        error: String(error),
      });
    }
    return null;
  }
}

/**
 * Parameters for the fetchWebPage context source.
 */
interface FetchWebPageParams {
  /**
   * The URL to fetch.
   */
  readonly url: string;
}

/**
 * A passive context source that fetches a single web page and extracts
 * its main content.
 *
 * This source is exposed as a tool that the LLM can call when it needs
 * to fetch additional context from a specific URL.
 *
 * @example
 * ```typescript
 * import { translate } from "@vertana/facade";
 * import { fetchWebPage } from "@vertana/context-web";
 *
 * const result = await translate(model, "ko", text, {
 *   contextSources: [fetchWebPage],
 * });
 * ```
 *
 * @since 0.1.0
 */
export const fetchWebPage: PassiveContextSource<FetchWebPageParams> = {
  name: "fetch-web-page",
  description: "Fetches a web page and extracts its main content. " +
    "Use this when you need additional context from a linked article or page.",
  mode: "passive",
  parameters: z.object({
    url: z.string().url().describe("The URL of the web page to fetch"),
  }),

  async gather(
    params: FetchWebPageParams,
    options?: ContextSourceGatherOptions,
  ) {
    const content = await fetchAndExtract(params.url, {
      signal: options?.signal,
    });

    if (content == null) {
      return {
        content: `Failed to fetch or extract content from: ${params.url}`,
        metadata: { url: params.url, success: false },
      };
    }

    const formatted = formatContent(content, params.url);
    return {
      content: formatted,
      metadata: {
        url: params.url,
        title: content.title,
        success: true,
      },
    };
  },
};

/**
 * Options for creating a fetchLinkedPages context source.
 *
 * @since 0.1.0
 */
export interface FetchLinkedPagesOptions {
  /**
   * The text to extract links from.
   */
  readonly text: string;

  /**
   * The media type of the text.
   */
  readonly mediaType: MediaType;

  /**
   * Maximum number of links to fetch.
   *
   * @default 10
   */
  readonly maxLinks?: number;

  /**
   * Timeout for each fetch request in milliseconds.
   *
   * @default 10000
   */
  readonly timeout?: number;
}

/**
 * Creates a required context source that extracts links from the given text
 * and fetches their content.
 *
 * This source is invoked automatically before translation begins, providing
 * context from the linked pages.  By default it fetches up to ten links;
 * raise or lower the cap via {@link FetchLinkedPagesOptions.maxLinks}.
 *
 * Intended for short, trusted link sets.  Pulling many large pages into
 * required context can cause the translator to echo a fetched page back as
 * the translation, especially when the combined reference material is much
 * larger than the source text or is in the target language.  For large or
 * untrusted link sets, prefer the passive {@link fetchWebPage} source so
 * the model only fetches specific URLs on demand.
 *
 * @param options Options for the context source.
 * @returns A required context source.
 *
 * @example
 * ```typescript
 * import { translate } from "@vertana/facade";
 * import { fetchLinkedPages } from "@vertana/context-web";
 *
 * const text = "Check out https://example.com for details.";
 * const result = await translate(model, "ko", text, {
 *   contextSources: [
 *     fetchLinkedPages({ text, mediaType: "text/plain" }),
 *   ],
 * });
 * ```
 *
 * @since 0.1.0
 */
export function fetchLinkedPages(
  options: FetchLinkedPagesOptions,
): RequiredContextSource {
  const maxLinks = options.maxLinks ?? 10;
  const timeout = options.timeout ?? 10000;
  const links = extractLinks(options.text, options.mediaType);
  const linksToFetch = links.slice(0, maxLinks);

  return {
    name: "fetch-linked-pages",
    description: `Fetches content from ${linksToFetch.length} linked page(s) ` +
      "to provide additional context for translation.",
    mode: "required",

    async gather(gatherOptions?: ContextSourceGatherOptions) {
      if (linksToFetch.length === 0) {
        logger.debug("No links to fetch.");
        return {
          content: "",
          metadata: { linkCount: 0, fetchedCount: 0 },
        };
      }

      logger.info("Fetching {count} linked page(s)...", {
        count: linksToFetch.length,
      });

      const results: { url: string; content: ExtractedContent }[] = [];

      for (const url of linksToFetch) {
        gatherOptions?.signal?.throwIfAborted();

        const content = await fetchAndExtract(url, {
          signal: gatherOptions?.signal,
          timeout,
        });

        if (content != null) {
          results.push({ url, content });
        }
      }

      if (results.length === 0) {
        logger.debug("No content could be extracted from any linked pages.");
        return {
          content: "",
          metadata: {
            linkCount: linksToFetch.length,
            fetchedCount: 0,
          },
        };
      }

      logger.info(
        "Successfully extracted content from {count} of {total} page(s).",
        { count: results.length, total: linksToFetch.length },
      );

      const formatted = results
        .map(({ url, content }) => formatContent(content, url))
        .join("\n\n---\n\n");

      return {
        content: formatted,
        metadata: {
          linkCount: linksToFetch.length,
          fetchedCount: results.length,
          urls: results.map((r) => r.url),
        },
      };
    },
  };
}

/**
 * Formats extracted content for inclusion in the translation context.
 */
function formatContent(content: ExtractedContent, url: string): string {
  const parts: string[] = [];

  parts.push(`# ${content.title}`);
  parts.push(`Source: ${url}`);

  if (content.byline != null) {
    parts.push(`Author: ${content.byline}`);
  }

  parts.push("");
  parts.push(content.content);

  return parts.join("\n");
}
