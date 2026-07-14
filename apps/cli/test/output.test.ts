import { describe, expect, it } from "vitest";

import { sanitizeOutput } from "../src/main.js";

describe("CLI output", () => {
  it("redacts secret-shaped text", () => {
    expect(sanitizeOutput("token sk-test-sentinel and api_key=abc")).toBe("token <redacted> and <redacted>");
  });
});
