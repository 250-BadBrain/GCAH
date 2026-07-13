import type { LlmClientPort, LlmClientResult } from "@gcah/core";

import { MockLlmScriptExhaustedError } from "./errors.js";

export class MockLlmClient implements LlmClientPort {
  readonly requests: unknown[][] = [];
  private cursor = 0;

  constructor(private readonly script: readonly LlmClientResult[]) {}

  async complete(messages: readonly unknown[]): Promise<LlmClientResult> {
    this.requests.push(structuredClone([...messages]));
    const next = this.script[this.cursor];
    this.cursor += 1;
    if (next === undefined) throw new MockLlmScriptExhaustedError();
    return structuredClone(next);
  }
}
