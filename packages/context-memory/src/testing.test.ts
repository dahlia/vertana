import assert from "node:assert/strict";
import process from "node:process";
import { describe, it } from "./test-compat.ts";
import { createModelFromString, getTestModel } from "./testing.ts";

describe("testing helpers", () => {
  it("respects abort signals when creating a model", async () => {
    const controller = new AbortController();
    controller.abort();

    await assert.rejects(
      () => createModelFromString("openai:gpt-4o-mini", controller.signal),
      { name: "AbortError" },
    );
  });

  it("respects abort signals when reading TEST_MODEL", async () => {
    const previousModel = process.env.TEST_MODEL;
    process.env.TEST_MODEL = "openai:gpt-4o-mini";
    const controller = new AbortController();
    controller.abort();

    try {
      await assert.rejects(
        () => getTestModel(controller.signal),
        { name: "AbortError" },
      );
    } finally {
      if (previousModel == null) {
        delete process.env.TEST_MODEL;
      } else {
        process.env.TEST_MODEL = previousModel;
      }
    }
  });
});
