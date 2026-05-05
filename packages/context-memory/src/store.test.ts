import assert from "node:assert/strict";
import { describe, it } from "./test-compat.ts";
import { InMemoryTranslationMemoryStore } from "./in-memory.ts";
import type { TranslationMemoryEntry } from "./store.ts";

const MEMORY_ENTRIES: readonly TranslationMemoryEntry[] = [
  {
    source: "Save changes",
    target: "변경 사항 저장",
    sourceLanguage: "en",
    targetLanguage: "ko",
    domain: "ui",
    namespace: "product-docs",
    sourceId: "buttons",
    createdAt: "2026-01-01T00:00:00Z",
    notes: "Use this for primary action buttons.",
  },
  {
    source: "Discard changes",
    target: "변경 사항 버리기",
    sourceLanguage: "en",
    targetLanguage: "ko",
    domain: "ui",
    namespace: "product-docs",
    sourceId: "buttons",
  },
  {
    source: "Save the file before closing the editor",
    target: "편집기를 닫기 전에 파일을 저장하세요",
    sourceLanguage: "en",
    targetLanguage: "ko",
    domain: "docs",
    namespace: "product-docs",
  },
  {
    source: "Save changes",
    target: "変更を保存",
    sourceLanguage: "en",
    targetLanguage: "ja",
    domain: "ui",
    namespace: "product-docs",
  },
];

describe("InMemoryTranslationMemoryStore", () => {
  it("ranks the closest source segments first", async () => {
    const store = new InMemoryTranslationMemoryStore(MEMORY_ENTRIES);

    const hits = await store.search("Save your changes", {
      targetLanguage: "ko",
      maxHits: 3,
      minScore: 0,
    });

    assert.equal(hits.length, 3);
    assert.equal(hits[0].entry.source, "Save changes");
    assert.equal(hits[0].entry.target, "변경 사항 저장");
    assert.ok(hits[0].score > hits[1].score);
  });

  it("filters by language, domain, and namespace", async () => {
    const store = new InMemoryTranslationMemoryStore(MEMORY_ENTRIES);

    const hits = await store.search("Save changes", {
      sourceLanguage: "EN",
      targetLanguage: "KO",
      domain: "ui",
      namespace: "product-docs",
      maxHits: 10,
      minScore: 0,
    });

    assert.deepEqual(
      hits.map((hit) => hit.entry.target),
      ["변경 사항 저장", "변경 사항 버리기"],
    );
  });

  it("respects maxHits and minScore", async () => {
    const store = new InMemoryTranslationMemoryStore(MEMORY_ENTRIES);

    const hits = await store.search("Save changes", {
      targetLanguage: "ko",
      maxHits: 1,
      minScore: 0.9,
    });

    assert.equal(hits.length, 1);
    assert.equal(hits[0].entry.source, "Save changes");
    assert.equal(hits[0].score, 1);
  });

  it("returns an empty list when no entries match the filters", async () => {
    const store = new InMemoryTranslationMemoryStore(MEMORY_ENTRIES);

    const hits = await store.search("Save changes", {
      targetLanguage: "fr",
      maxHits: 5,
    });

    assert.deepEqual(hits, []);
  });

  it("keeps insertion order for equal scores", async () => {
    const store = new InMemoryTranslationMemoryStore([
      { source: "Close", target: "닫기" },
      { source: "Close", target: "종료" },
    ]);

    const hits = await store.search("Close", {
      maxHits: 2,
      minScore: 0,
    });

    assert.deepEqual(
      hits.map((hit) => hit.entry.target),
      ["닫기", "종료"],
    );
  });

  it("does not use locale-sensitive case folding for scoring", async () => {
    const original = String.prototype.toLocaleLowerCase;
    String.prototype.toLocaleLowerCase = function toLocaleLowerCase() {
      throw new TypeError("Locale-sensitive case folding was used.");
    };
    try {
      const store = new InMemoryTranslationMemoryStore([
        { source: "SAVE CHANGES", target: "변경 사항 저장" },
      ]);

      const hits = await store.search("save changes", {
        maxHits: 1,
        minScore: 0,
      });

      assert.equal(hits[0].score, 1);
    } finally {
      String.prototype.toLocaleLowerCase = original;
    }
  });

  it("adds entries individually and in batches", async () => {
    const store = new InMemoryTranslationMemoryStore();

    await store.add({ source: "Open file", target: "파일 열기" });
    await store.addMany([
      { source: "Close file", target: "파일 닫기" },
      { source: "Delete file", target: "파일 삭제" },
    ]);

    const hits = await store.search("file", { maxHits: 10, minScore: 0 });

    assert.equal(hits.length, 3);
  });

  it("stores immutable snapshots of added entries", async () => {
    const initialEntry = { source: "Open file", target: "파일 열기" };
    const addedEntry = {
      source: "Close file",
      target: "파일 닫기",
      metadata: { approved: true },
    };
    const store = new InMemoryTranslationMemoryStore([initialEntry]);

    await store.add(addedEntry);
    initialEntry.target = "변경됨";
    addedEntry.target = "변경됨";
    addedEntry.metadata.approved = false;

    const hits = await store.search("file", { maxHits: 2, minScore: 0 });

    assert.deepEqual(
      hits.map((hit) => hit.entry.target),
      ["파일 열기", "파일 닫기"],
    );
    assert.deepEqual(hits[1].entry.metadata, { approved: true });
  });

  it("returns immutable snapshots from search results", async () => {
    const store = new InMemoryTranslationMemoryStore([
      {
        source: "Approve changes",
        target: "변경 사항 승인",
        metadata: { review: { approved: true } },
      },
    ]);

    const [hit] = await store.search("Approve changes", {
      maxHits: 1,
      minScore: 0,
    });

    Object.assign(hit.entry, { target: "변경됨" });
    const review = hit.entry.metadata?.review;
    assert.ok(isReviewMetadata(review));
    review.approved = false;

    const [nextHit] = await store.search("Approve changes", {
      maxHits: 1,
      minScore: 0,
    });

    assert.equal(nextHit.entry.target, "변경 사항 승인");
    assert.deepEqual(nextHit.entry.metadata, {
      review: { approved: true },
    });
  });

  it("does not partially add invalid batches", async () => {
    const store = new InMemoryTranslationMemoryStore([
      { source: "Existing entry", target: "기존 항목" },
    ]);

    await assert.rejects(
      () =>
        store.addMany([
          { source: "Valid entry", target: "유효한 항목" },
          { source: "", target: "비어 있음" },
        ]),
      TypeError,
    );

    const hits = await store.search("entry", { maxHits: 10, minScore: 0 });

    assert.deepEqual(
      hits.map((hit) => hit.entry.target),
      ["기존 항목"],
    );
  });

  it("rejects invalid entries and search options", async () => {
    const store = new InMemoryTranslationMemoryStore();

    await assert.rejects(
      () => store.add({ source: "", target: "비어 있음" }),
      TypeError,
    );
    await assert.rejects(
      () => store.search("  ", { minScore: 0 }),
      TypeError,
    );
    await assert.rejects(
      () => store.search("query", { maxHits: 0 }),
      RangeError,
    );
    await assert.rejects(
      () => store.search("query", { minScore: 2 }),
      RangeError,
    );
  });

  it("respects abort signals", async () => {
    const store = new InMemoryTranslationMemoryStore(MEMORY_ENTRIES);
    const controller = new AbortController();
    controller.abort();

    await assert.rejects(
      () => store.search("Save changes", { signal: controller.signal }),
      { name: "AbortError" },
    );
  });
});

function isReviewMetadata(
  value: unknown,
): value is { approved: boolean } {
  return typeof value === "object" && value != null &&
    "approved" in value &&
    typeof value.approved === "boolean";
}
