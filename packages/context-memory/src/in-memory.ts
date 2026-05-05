import type {
  TranslationMemoryEntry,
  TranslationMemoryHit,
  TranslationMemoryOperationOptions,
  TranslationMemorySearchOptions,
  TranslationMemoryStore,
} from "./store.ts";

const DEFAULT_MAX_HITS = 5;
const DEFAULT_MIN_SCORE = 0.2;

interface StoredTranslationMemoryEntry {
  readonly entry: TranslationMemoryEntry;
  readonly index: number;
  readonly normalizedSource: string;
  readonly sourceTokens: readonly string[];
  readonly sourceNgrams: readonly string[];
}

interface PreparedText {
  readonly text: string;
  readonly tokens: readonly string[];
  readonly ngrams: readonly string[];
}

/**
 * In-memory translation memory store using deterministic lexical similarity.
 *
 * This backend is intended for tests, examples, and small local memories.
 * It clones entries when storing and returning them, so entry metadata must be
 * structured-cloneable.
 * Searches scan stored entries linearly, so larger or shared memories should
 * use a store with an index, database query, or vector search backend.
 * Persistent or vector-based stores can implement {@link TranslationMemoryStore}
 * with the same entry and hit shapes.
 *
 * @since 0.2.0
 */
export class InMemoryTranslationMemoryStore implements TranslationMemoryStore {
  private readonly entries: StoredTranslationMemoryEntry[] = [];
  private nextIndex = 0;

  /**
   * Creates an in-memory store.
   *
   * @param entries Optional initial entries.
   * @throws {TypeError} If any entry is invalid or contains metadata that
   *         cannot be structured-cloned.
   */
  constructor(entries: readonly TranslationMemoryEntry[] = []) {
    for (const entry of entries) {
      this.entries.push(createStoredEntry(entry, this.nextIndex));
      this.nextIndex++;
    }
  }

  /**
   * Adds a single translation memory entry.
   *
   * @param entry The entry to add.
   * @param options Optional operation settings.
   * @returns A promise that resolves when the entry has been stored.
   * @throws {TypeError} If the entry is invalid or contains metadata that
   *         cannot be structured-cloned.
   */
  add(
    entry: TranslationMemoryEntry,
    options?: TranslationMemoryOperationOptions,
  ): Promise<void> {
    try {
      options?.signal?.throwIfAborted();
      this.entries.push(createStoredEntry(entry, this.nextIndex));
      this.nextIndex++;
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * Adds multiple translation memory entries.
   *
   * @param entries The entries to add.
   * @param options Optional operation settings.
   * @returns A promise that resolves when all entries have been stored.
   * @throws {TypeError} If any entry is invalid or contains metadata that
   *         cannot be structured-cloned.
   */
  addMany(
    entries: readonly TranslationMemoryEntry[],
    options?: TranslationMemoryOperationOptions,
  ): Promise<void> {
    try {
      const validatedEntries: StoredTranslationMemoryEntry[] = [];
      for (const entry of entries) {
        options?.signal?.throwIfAborted();
        validatedEntries.push(
          createStoredEntry(entry, this.nextIndex + validatedEntries.length),
        );
      }

      for (const stored of validatedEntries) {
        this.entries.push(stored);
        this.nextIndex++;
      }
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * Searches for memory entries related to a query segment.
   *
   * @param query The source-language segment to search for.
   * @param options Optional search settings.
   * @returns Ranked hits ordered from best to worst.
   * @throws {RangeError} If a numeric search option is out of range.
   */
  search(
    query: string,
    options: TranslationMemorySearchOptions = {},
  ): Promise<readonly TranslationMemoryHit[]> {
    try {
      options.signal?.throwIfAborted();
      const maxHits = validateMaxHits(options.maxHits);
      const minScore = validateMinScore(options.minScore);
      const normalizedQuery = normalizeText(query);
      if (normalizedQuery.length === 0) {
        throw new TypeError("query must not be empty.");
      }
      const preparedQuery = prepareText(normalizedQuery);
      const hits: Array<TranslationMemoryHit & { readonly index: number }> = [];

      for (const stored of this.entries) {
        options.signal?.throwIfAborted();
        if (!matchesFilters(stored.entry, options)) {
          continue;
        }

        const score = scoreSimilarity(preparedQuery, stored);
        if (score >= minScore) {
          hits.push({ entry: stored.entry, score, index: stored.index });
        }
      }

      hits.sort((a, b) => b.score - a.score || a.index - b.index);
      return Promise.resolve(
        hits.slice(0, maxHits).map(({ entry, score }) => ({
          entry: cloneEntry(entry),
          score,
        })),
      );
    } catch (error) {
      return Promise.reject(error);
    }
  }
}

function createStoredEntry(
  entry: TranslationMemoryEntry,
  index: number,
): StoredTranslationMemoryEntry {
  const validatedEntry = validateEntry(entry);
  const normalizedSource = normalizeText(validatedEntry.source);
  return {
    entry: validatedEntry,
    index,
    normalizedSource,
    sourceTokens: tokenize(normalizedSource),
    sourceNgrams: ngrams(normalizedSource, 3),
  };
}

function validateEntry(entry: TranslationMemoryEntry): TranslationMemoryEntry {
  if (entry.source.trim().length === 0) {
    throw new TypeError("source must not be empty.");
  }
  if (entry.target.trim().length === 0) {
    throw new TypeError("target must not be empty.");
  }
  return cloneEntry(entry);
}

function cloneEntry(entry: TranslationMemoryEntry): TranslationMemoryEntry {
  return {
    ...entry,
    metadata: entry.metadata == null
      ? undefined
      : cloneMetadata(entry.metadata),
  };
}

function cloneMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  try {
    return structuredClone(metadata);
  } catch (error) {
    throw new TypeError("metadata must be structured-cloneable.", {
      cause: error,
    });
  }
}

function validateMaxHits(value: number | undefined): number {
  const maxHits = value ?? DEFAULT_MAX_HITS;
  if (!Number.isInteger(maxHits) || maxHits <= 0) {
    throw new RangeError("maxHits must be a positive integer.");
  }
  return maxHits;
}

function validateMinScore(value: number | undefined): number {
  const minScore = value ?? DEFAULT_MIN_SCORE;
  if (!Number.isFinite(minScore) || minScore < 0 || minScore > 1) {
    throw new RangeError("minScore must be between 0 and 1.");
  }
  return minScore;
}

function matchesFilters(
  entry: TranslationMemoryEntry,
  options: TranslationMemorySearchOptions,
): boolean {
  return matchesLanguage(entry.sourceLanguage, options.sourceLanguage) &&
    matchesLanguage(entry.targetLanguage, options.targetLanguage) &&
    matchesExact(entry.domain, options.domain) &&
    matchesExact(entry.namespace, options.namespace);
}

function matchesLanguage(
  entryValue: string | undefined,
  filterValue: string | undefined,
): boolean {
  if (filterValue == null) {
    return true;
  }
  return entryValue?.toLowerCase() === filterValue.toLowerCase();
}

function matchesExact(
  entryValue: string | undefined,
  filterValue: string | undefined,
): boolean {
  return filterValue == null || entryValue === filterValue;
}

function prepareText(text: string): PreparedText {
  return {
    text,
    tokens: tokenize(text),
    ngrams: ngrams(text, 3),
  };
}

function scoreSimilarity(
  query: PreparedText,
  source: StoredTranslationMemoryEntry,
): number {
  if (query.text.length === 0 || source.normalizedSource.length === 0) {
    return 0;
  }
  if (query.text === source.normalizedSource) {
    return 1;
  }
  return Math.max(
    diceCoefficient(query.tokens, source.sourceTokens),
    diceCoefficient(query.ngrams, source.sourceNgrams),
  );
}

function normalizeText(text: string): string {
  return text.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");
}

function tokenize(text: string): readonly string[] {
  return text.split(/[^\p{L}\p{N}]+/u).filter((token) => token.length > 0);
}

function ngrams(text: string, size: number): readonly string[] {
  const codePoints = Array.from(text);
  if (codePoints.length <= size) {
    return [text];
  }

  const grams: string[] = [];
  for (let i = 0; i <= codePoints.length - size; i++) {
    grams.push(codePoints.slice(i, i + size).join(""));
  }
  return grams;
}

function diceCoefficient(
  leftValues: readonly string[],
  rightValues: readonly string[],
): number {
  if (leftValues.length === 0 || rightValues.length === 0) {
    return 0;
  }

  const rightCounts = countValues(rightValues);
  let intersection = 0;
  for (const value of leftValues) {
    const count = rightCounts.get(value) ?? 0;
    if (count > 0) {
      intersection++;
      rightCounts.set(value, count - 1);
    }
  }

  return (2 * intersection) / (leftValues.length + rightValues.length);
}

function countValues(values: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}
