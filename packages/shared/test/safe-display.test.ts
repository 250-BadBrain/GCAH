import { describe, expect, it } from "vitest";

import { sanitizeRationale } from "../src/safe-display.js";

describe("safe display", () => {
  it("escapes markup, redacts secret/path sentinels, and truncates deterministically", () => {
    const result = sanitizeRationale(
      "<script>API_KEY=sk-test-secret</script> C:/Users/Alice/.ssh/id_rsa " + "x".repeat(80),
      { maxLength: 72 }
    );

    expect(result).not.toContain("<script>");
    expect(result).not.toContain("sk-test-secret");
    expect(result).not.toContain("C:/Users/Alice");
    expect(result).toContain("&lt;script&gt;API_KEY=[REDACTED]");
    expect(result.endsWith("...")).toBe(true);
    expect(result.length).toBeLessThanOrEqual(72);
  });
});
