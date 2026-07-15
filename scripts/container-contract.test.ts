import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("container delivery contract", () => {
  it("defines a Linux amd64 self-hosted image without baked secrets", async () => {
    const dockerfile = await readFile("Dockerfile", "utf8");
    const ignore = await readFile(".dockerignore", "utf8");
    const imageWorkflow = await readFile(".github/workflows/image.yml", "utf8");
    const gitlab = await readFile(".gitlab-ci.yml", "utf8");

    expect(dockerfile).toContain("FROM --platform=$BUILDPLATFORM");
    expect(dockerfile).toContain("USER gcah");
    expect(dockerfile).toContain("HEALTHCHECK");
    expect(dockerfile).toContain("/data");
    expect(dockerfile).toContain("public-demo");
    expect(dockerfile).not.toContain("sk-container-sentinel");
    expect(ignore).toContain(".env");
    expect(ignore).toContain("node_modules");
    expect(imageWorkflow).toContain("linux/amd64");
    expect(imageWorkflow).toContain("digest");
    expect(gitlab).toContain("image-build:");
    expect(gitlab).toContain("docker build");
  });
});
