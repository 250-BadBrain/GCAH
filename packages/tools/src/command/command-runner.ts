import type { ToolGatewayRequest, ToolGatewayResult } from "@gcah/core";

import { ToolRegistry } from "../gateway/tool-registry.js";

export interface SpawnRequest {
  executable: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  shell: false;
}

export class CommandRunner {
  readonly registry = new ToolRegistry();

  constructor(private readonly spawn: (request: SpawnRequest) => Promise<ToolGatewayResult>) {}

  async run(request: Omit<SpawnRequest, "shell">): Promise<ToolGatewayResult> {
    return this.spawn({ ...request, shell: false });
  }

  async execute(request: ToolGatewayRequest): Promise<ToolGatewayResult> {
    const definition = this.registry.get(request.tool);
    if (definition === null) return { status: "ERROR", summary: `UNKNOWN_TOOL:${request.tool}` };
    return definition.execute(request);
  }
}
