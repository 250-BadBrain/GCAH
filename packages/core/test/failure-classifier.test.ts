import { describe, expect, it } from "vitest";

import { classifyFailure } from "../src/index.js";

describe("classifyFailure", () => {
  it("classifies repairable and non-repairable failures deterministically", () => {
    expect(classifyFailure("AssertionError: expected 1 to be 2")).toEqual({
      category: "test_assertion",
      repairable: true
    });
    expect(classifyFailure("eslint no-unused-vars")).toEqual({
      category: "lint",
      repairable: true
    });
    expect(classifyFailure("TS2322 type is not assignable")).toEqual({
      category: "typecheck",
      repairable: true
    });
    expect(classifyFailure("POLICY_DENIED path escape")).toMatchObject({ repairable: false });
    expect(classifyFailure("ETIMEDOUT while running validator")).toMatchObject({ category: "timeout", repairable: false });
    expect(classifyFailure("same fingerprint repeated")).toMatchObject({ category: "repeat", repairable: false });
  });
});
