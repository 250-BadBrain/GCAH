export interface CliHttpRequest {
  method: "GET" | "POST";
  url: string;
  body?: unknown;
}

export interface CliHttpResponse {
  status: number;
  body: unknown;
}

export type CliTransport = (request: CliHttpRequest) => Promise<CliHttpResponse>;

export function defaultTransport(): CliTransport {
  return async () => ({ status: 503, body: { error: "SERVER_UNAVAILABLE" } });
}
