import type { Executor, ExecutionRequest } from "./executor.js";
import type { ToolGatewayResult } from "@gcah/core";

export class FakeExecutor implements Executor {
  readonly requests: ExecutionRequest[] = [];

  constructor(private readonly result: ToolGatewayResult = { status: "OK", summary: "executed" }) {}

  async execute(request: ExecutionRequest): Promise<ToolGatewayResult> {
    this.requests.push(request);
    return this.result;
  }
}
