import { describe, expect, it } from "vitest";

import { FailureWindow } from "../src/index.js";

describe("FailureWindow", () => {
  it("counts only consecutive identical fingerprints", () => {
    const window = new FailureWindow(2);
    expect(window.record("a")).toBe(false);
    expect(window.record("b")).toBe(false);
    expect(window.record("b")).toBe(true);
  });
});
