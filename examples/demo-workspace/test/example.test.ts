import { describe, expect, it } from "vitest";

import { demoExample } from "../src/example.js";

describe("fixed demo example", () => {
  it("is deterministic", () => {
    expect(demoExample).toBe("fixed");
  });
});
