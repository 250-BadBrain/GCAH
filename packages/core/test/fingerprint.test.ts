import { describe, expect, it } from "vitest";

import { fingerprintFailure } from "../src/index.js";

describe("fingerprintFailure", () => {
  it("normalizes timestamps, workspace paths, line numbers, and durations", () => {
    const first = "2026-07-13T01:02:03.000Z E:/Desktop/GCAH/src/app.ts:12:9 failed in 123ms";
    const second = "2026-07-14T02:03:04.000Z C:/tmp/work/src/app.ts:99:1 failed in 999ms";
    expect(fingerprintFailure(first)).toEqual(fingerprintFailure(second));
    expect(fingerprintFailure(first)).toMatch(/^[a-f0-9]{64}$/u);
  });
});
