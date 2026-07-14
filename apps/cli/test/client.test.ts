import { describe, expect, it } from "vitest";

import { createFetchTransport } from "../src/main.js";

describe("CLI HTTP client", () => {
  it("uses fetch against the configured server origin by default", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const transport = createFetchTransport({
      baseUrl: "http://127.0.0.1:8787",
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
      }
    });

    await expect(transport({ method: "POST", url: "/api/runs", body: { task: "x" } })).resolves.toEqual({
      status: 200,
      body: { ok: true }
    });
    expect(calls).toEqual([{
      url: "http://127.0.0.1:8787/api/runs",
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task: "x" })
      }
    }]);
  });
});
