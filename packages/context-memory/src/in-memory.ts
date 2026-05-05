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
}

/**
 * In-memory translation memory store using deterministic lexical similarity.
 *
 * This backend is intended for tests, examples, and small local memories.
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
   * @throws {TypeError} If any entry is invalid.
   */
  constructor(entries: readonly TranslationMemoryEntry[] = []) {
    for (const entry of entries) {
      this.entries.push({
        entry: validateEntry(entry),
        index: this.nextIndex,
      });
      this.nextIndex++;
    }
  }

  /**
   * Adds a single translation memory entry.
   *
   * @param entry The entry to add.
   * @param options Optional operation settings.
   * @returns A promise that resolves when the entry has been stored.
   * @throws {TypeError} If the entry is invalid.
   */
  add(
    entry: TranslationMemoryEntry,
    options?: TranslationMemoryOperationOptions,
  ): Promise<void> {
    try {
      options?.signal?.throwIfAborted();
      this.entries.push({
        entry: validateEntry(entry),
        index: this.nextIndex,
      });
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
   * @throws {TypeError} If any entry is invalid.
   */
  addMany(
    entries: readonly TranslationMemoryEntry[],
    options?: TranslationMemoryOperationOptions,
  ): Promise<void> {
    try {
      const validatedEntries: TranslationMemoryEntry[] = [];
      for (const entry of entries) {
        options?.signal?.throwIfAborted();
        validatedEntries.push(validateEntry(entry));
      }

      for (const entry of validatedEntries) {
        options?.signal?.throwIfAborted();
        this.entries.push({
          entry,
          index: this.nextIndex,
        });
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
      const hits: Array<TranslationMemoryHit & { readonly index: number }> = [];

      for (const stored of this.entries) {
        options.signal?.throwIfAborted();
        if (!matchesFilters(stored.entry, options)) {
          continue;
        }

        const score = scoreSimilarity(normalizedQuery, stored.entry.source);
        if (score >= minScore) {
          hits.push({ entry: stored.entry, score, index: stored.index });
        }
      }

      hits.sort((a, b) => b.score - a.score || a.index - b.index);
      return Promise.resolve(
        hits.slice(0, maxHits).map(({ entry, score }) => ({ entry, score })),
      );
    } catch (error) {
      return Promise.reject(error);
    }
  }
}

function validateEntry(entry: TranslationMemoryEntry): TranslationMemoryEntry {
  if (entry.source.trim().length === 0) {
    throw new TypeError("source must not be empty.");
  }
  if (entry.target.trim().length === 0) {
    throw new TypeError("target must not be empty.");
  }
  return {
    ...entry,
    metadata: entry.metadata == null ? undefined : { ...entry.metadata },
  };
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

function scoreSimilarity(normalizedQuery: string, source: string): number {
  const normalizedSource = normalizeText(source);
  if (normalizedQuery.length === 0 || normalizedSource.length === 0) {
    return 0;
  }
  if (normalizedQuery === normalizedSource) {
    return 1;
  }
  return Math.max(
    diceCoefficient(tokenize(normalizedQuery), tokenize(normalizedSource)),
    diceCoefficient(ngrams(normalizedQuery, 3), ngrams(normalizedSource, 3)),
  );
}

function normalizeText(text: string): string {
  return text.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");
}

function tokenize(text: string): readonly string[] {
  return text.split(/[^\p{L}\p{N}]+/u).filter((token) => token.length > 0);
}

function ngrams(text: string, size: number): readonly string[] {
  if (text.length <= size) {
    return [text];
  }

  const grams: string[] = [];
  for (let i = 0; i <= text.length - size; i++) {
    grams.push(text.slice(i, i + size));
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
