export type OpenAiCompatibleErrorCode =
  | "NETWORK_ERROR"
  | "RATE_LIMIT"
  | "HTTP_ERROR"
  | "PROTOCOL_ERROR";

export class OpenAiCompatibleError extends Error {
  constructor(
    readonly code: OpenAiCompatibleErrorCode,
    readonly providerName: string
  ) {
    super(`${providerName} ${code}`);
    this.name = "OpenAiCompatibleError";
  }

  toJSON(): { name: string; code: OpenAiCompatibleErrorCode; providerName: string } {
    return {
      name: this.name,
      code: this.code,
      providerName: this.providerName
    };
  }
}
