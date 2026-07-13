import { describe, expect, it } from "vitest";

import { boundOutput } from "../src/index.js";

describe("LocalExecutor helpers", () => {
  it("bounds output deterministically without leaking the remainder", () => {
    expect(boundOutput("abcdef", 3)).toEqual({
      text: "abc\n[truncated]",
      truncated: true
    });
    expect(boundOutput("abc", 3)).toEqual({
      text: "abc",
      truncated: false
    });
  });
});
