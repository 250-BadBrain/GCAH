import { describe, expect, it } from "vitest";

import { createServerApp, type AdminTokenStore } from "../src/index.js";
import { createInMemoryRepositories } from "@gcah/persistence";
import type { Clock } from "@gcah/core";

const timestamp = "2026-07-13T00:00:00.000Z";

class FakeClock implements Clock {
  now(): Date {
    return new Date(timestamp);
  }

  nowIso(): string {
    return timestamp;
  }
}

class FakeAdminTokenStore implements AdminTokenStore {
  async verify(token: string): Promise<boolean> {
    return token === "admin-secret";
  }
}

describe("server auth", () => {
  it("requires a session for REST reads without exposing admin tokens to the browser", async () => {
    const app = createServerApp({
      unitOfWork: createInMemoryRepositories(new FakeClock()),
      clock: new FakeClock(),
      auth: { enabled: true, adminTokenStore: new FakeAdminTokenStore(), allowedOrigin: "http://localhost:3000" }
    });

    await expect(app.inject({ method: "GET", url: "/api/config/status" })).resolves.toMatchObject({ statusCode: 401 });

    const session = await app.inject({ method: "POST", url: "/api/auth/session", headers: { "x-admin-token": "admin-secret" } });
    const response = await app.inject({
      method: "GET",
      url: "/api/config/status",
      headers: { cookie: String(session.headers["set-cookie"]) }
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain("admin-secret");
  });

  it("requires same-origin authenticated cookies and CSRF for mutations", async () => {
    const app = createServerApp({
      unitOfWork: createInMemoryRepositories(new FakeClock()),
      clock: new FakeClock(),
      auth: { enabled: true, adminTokenStore: new FakeAdminTokenStore(), allowedOrigin: "http://localhost:3000" }
    });

    await expect(app.inject({ method: "POST", url: "/api/runs", payload: { workspacePath: "E:/workspace", task: "x" } })).resolves.toMatchObject({ statusCode: 401 });
    await expect(app.inject({ method: "POST", url: "/api/auth/session", headers: { "x-admin-token": "wrong" } })).resolves.toMatchObject({ statusCode: 401 });

    const session = await app.inject({ method: "POST", url: "/api/auth/session", headers: { "x-admin-token": "admin-secret" } });
    expect(session.statusCode).toBe(204);
    const cookie = session.headers["set-cookie"];
    expect(String(cookie)).toContain("HttpOnly");
    expect(String(cookie)).toContain("SameSite=Strict");
    const csrf = session.headers["x-csrf-token"];
    expect(csrf).toBeTruthy();

    await expect(app.inject({
      method: "POST",
      url: "/api/runs",
      headers: { cookie: String(cookie), "x-csrf-token": String(csrf), origin: "http://evil.example" },
      payload: { workspacePath: "E:/workspace", task: "x" }
    })).resolves.toMatchObject({ statusCode: 403 });

    await expect(app.inject({
      method: "POST",
      url: "/api/runs",
      headers: { cookie: String(cookie), "x-csrf-token": String(csrf), origin: "http://localhost:3000" },
      payload: { workspacePath: "E:/workspace", task: "x" }
    })).resolves.toMatchObject({ statusCode: 201 });
  });

  it("can mark self-hosted cookies Secure", async () => {
    const app = createServerApp({
      unitOfWork: createInMemoryRepositories(new FakeClock()),
      clock: new FakeClock(),
      auth: { enabled: true, adminTokenStore: new FakeAdminTokenStore(), allowedOrigin: "https://gcah.example", secureCookies: true }
    });

    const session = await app.inject({ method: "POST", url: "/api/auth/session", headers: { "x-admin-token": "admin-secret" } });

    expect(String(session.headers["set-cookie"])).toContain("Secure");
  });
});
