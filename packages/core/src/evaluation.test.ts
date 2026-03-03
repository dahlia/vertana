import { describe, it } from "./test-compat.ts";
import assert from "node:assert/strict";
import type { LanguageModel } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { evaluate } from "./evaluation.ts";
import { getTestModel, hasTestModel } from "./testing.ts";

function createMockModel(score: number): MockLanguageModelV3 {
  return new MockLanguageModelV3({
    doGenerate: async () => {
      await Promise.resolve();
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ score, issues: [] }),
        }],
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

function getScoreSchemaFromModelCall(
  model: MockLanguageModelV3,
): Record<string, unknown> {
  const responseFormat = model.doGenerateCalls[0]?.responseFormat;
  assert.ok(responseFormat != null);
  assert.equal(responseFormat.type, "json");
  const schema = responseFormat.schema;
  assert.ok(schema != null);
  assert.equal(typeof schema, "object");

  const properties = (schema as { properties?: unknown }).properties;
  assert.ok(properties != null);
  assert.equal(typeof properties, "object");

  const scoreSchema = (properties as Record<string, unknown>).score;
  assert.ok(scoreSchema != null);
  assert.equal(typeof scoreSchema, "object");
  return scoreSchema as Record<string, unknown>;
}

describe("evaluate (schema compatibility and clamping)", () => {
  it("does not include minimum/maximum in score schema", async () => {
    const model = createMockModel(0.5);
    await evaluate(
      model,
      "Hello, world!",
      "안녕하세요, 세계!",
      { targetLanguage: "ko" },
    );

    const scoreSchema = getScoreSchemaFromModelCall(model);
    assert.equal(scoreSchema.type, "number");
    assert.ok(!("minimum" in scoreSchema));
    assert.ok(!("maximum" in scoreSchema));
  });

  it("clamps score above 1 to 1", async () => {
    const model = createMockModel(1.2);
    const result = await evaluate(
      model,
      "Hello, world!",
      "안녕하세요, 세계!",
      { targetLanguage: "ko" },
    );

    assert.equal(result.score, 1);
  });

  it("clamps score below 0 to 0", async () => {
    const model = createMockModel(-0.1);
    const result = await evaluate(
      model,
      "Hello, world!",
      "안녕하세요, 세계!",
      { targetLanguage: "ko" },
    );

    assert.equal(result.score, 0);
  });
});

// Lazy model initialization (cached)
let cachedModel: LanguageModel | undefined;
async function getModel(): Promise<LanguageModel> {
  if (cachedModel == null) {
    const m = await getTestModel();
    if (m == null) {
      throw new Error("TEST_MODEL not set");
    }
    cachedModel = m;
  }
  return cachedModel;
}

if (hasTestModel() || !("Bun" in globalThis)) {
  describe(
    "evaluate",
    { skip: !hasTestModel() && "TEST_MODEL not set" },
    () => {
      it("returns a score between 0 and 1", async () => {
        const model = await getModel();
        const result = await evaluate(
          model,
          "Hello, world!",
          "안녕하세요, 세계!",
          { targetLanguage: "ko" },
        );

        assert.ok(result.score >= 0 && result.score <= 1);
      });

      it("returns issues array", async () => {
        const model = await getModel();
        const result = await evaluate(
          model,
          "Hello, world!",
          "안녕하세요, 세계!",
          { targetLanguage: "ko" },
        );

        assert.ok(Array.isArray(result.issues));
      });

      it("detects accuracy issues in bad translations", async () => {
        const model = await getModel();
        // Intentionally wrong translation
        const result = await evaluate(
          model,
          "The quick brown fox jumps over the lazy dog.",
          "고양이가 빠르게 달린다.", // "A cat runs quickly" - wrong meaning
          { targetLanguage: "ko" },
        );

        // Should have a lower score due to accuracy issues
        assert.ok(
          result.score < 0.8,
          `Expected score < 0.8, got ${result.score}`,
        );
      });

      it("gives high score to good translations", async () => {
        const model = await getModel();
        const result = await evaluate(
          model,
          "Thank you very much.",
          "정말 감사합니다.",
          { targetLanguage: "ko" },
        );

        assert.ok(
          result.score >= 0.7,
          `Expected score >= 0.7, got ${result.score}`,
        );
      });

      it("respects abort signal", async () => {
        const model = await getModel();
        const controller = new AbortController();
        controller.abort();

        await assert.rejects(
          async () => {
            await evaluate(
              model,
              "Hello",
              "안녕",
              { targetLanguage: "ko", signal: controller.signal },
            );
          },
          (error: Error) => {
            return error.name === "AbortError" ||
              error.message.includes("abort");
          },
        );
      });

      it("includes source language in evaluation when provided", async () => {
        const model = await getModel();
        const result = await evaluate(
          model,
          "Hello, world!",
          "안녕하세요, 세계!",
          {
            targetLanguage: "ko",
            sourceLanguage: "en",
          },
        );

        assert.ok(result.score >= 0 && result.score <= 1);
      });

      it("considers glossary in evaluation", async () => {
        const model = await getModel();
        // Translation uses correct glossary term
        const result = await evaluate(
          model,
          "Machine learning is transforming industries.",
          "기계 학습이 산업을 변화시키고 있습니다.",
          {
            targetLanguage: "ko",
            glossary: [
              { original: "machine learning", translated: "기계 학습" },
            ],
          },
        );

        assert.ok(
          result.score >= 0.7,
          `Expected score >= 0.7, got ${result.score}`,
        );
      });

      it("penalizes glossary violations", async () => {
        const model = await getModel();
        // Translation uses wrong term (머신러닝 instead of 기계 학습)
        const result = await evaluate(
          model,
          "Machine learning is transforming industries.",
          "머신러닝이 산업을 변화시키고 있습니다.",
          {
            targetLanguage: "ko",
            glossary: [
              { original: "machine learning", translated: "기계 학습" },
            ],
          },
        );

        // Should have terminology issue
        const hasTerminologyIssue = result.issues.some(
          (issue) => issue.type === "terminology",
        );
        assert.ok(
          hasTerminologyIssue,
          "Should detect terminology violation",
        );
      });
    },
  );
}
