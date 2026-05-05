import assert from "node:assert/strict";
import { createToolSet } from "@vertana/core/tools";
import { generateText, type LanguageModel, stepCountIs } from "ai";
import { describe, it } from "./test-compat.ts";
import { InMemoryTranslationMemoryStore } from "./in-memory.ts";
import { lookupMemory } from "./lookup.ts";
import { getTestModel, hasTestModel } from "./testing.ts";

let cachedModel: LanguageModel | undefined;

async function getModel(signal?: AbortSignal): Promise<LanguageModel> {
  signal?.throwIfAborted();
  if (cachedModel == null) {
    const model = await getTestModel(signal);
    if (model == null) {
      throw new TypeError("TEST_MODEL not set.");
    }
    cachedModel = model;
  }
  signal?.throwIfAborted();
  return cachedModel;
}

if (hasTestModel() || !("Bun" in globalThis)) {
  describe(
    "lookupMemory integration",
    { skip: !hasTestModel() && "TEST_MODEL not set" },
    () => {
      it("can be exposed as an AI SDK tool", async () => {
        const model = await getModel();
        const store = new InMemoryTranslationMemoryStore([
          {
            source: "Save changes",
            target: "변경 사항 저장",
            sourceLanguage: "en",
            targetLanguage: "ko",
            domain: "ui",
          },
        ]);
        const tools = await createToolSet([lookupMemory(store)]);

        const result = await generateText({
          model,
          tools,
          toolChoice: { type: "tool", toolName: "lookup-memory" },
          stopWhen: stepCountIs(2),
          maxOutputTokens: 300,
          prompt: 'Call the lookup-memory tool for query "Save changes" with ' +
            'sourceLanguage "en", targetLanguage "ko", and domain "ui". ' +
            "Then briefly state the target translation from the tool result.",
        });

        const serializedToolResults = JSON.stringify(
          result.steps.map((step) => step.toolResults),
        );

        assert.ok(
          serializedToolResults.includes("변경 사항 저장"),
          `Expected lookup-memory tool result to include translation, got: ${serializedToolResults}`,
        );
      });
    },
  );
}
