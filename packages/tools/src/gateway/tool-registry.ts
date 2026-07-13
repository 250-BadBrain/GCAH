import type { SupportedToolName } from "@gcah/shared";
import type { Executor } from "../executor/executor.js";

export interface ToolDefinition extends Executor {
  tool: SupportedToolName;
}

export class ToolRegistry {
  private readonly definitions = new Map<SupportedToolName, ToolDefinition>();

  register(definition: ToolDefinition): void {
    if (this.definitions.has(definition.tool)) {
      throw new Error(`tool ${definition.tool} is already registered`);
    }
    this.definitions.set(definition.tool, definition);
  }

  get(tool: SupportedToolName): ToolDefinition | null {
    return this.definitions.get(tool) ?? null;
  }
}
