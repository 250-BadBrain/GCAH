export class MockLlmScriptExhaustedError extends Error {
  constructor() {
    super("Mock LLM script exhausted");
    this.name = "MockLlmScriptExhaustedError";
  }
}
