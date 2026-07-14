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

export interface CreateFetchTransportInput {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export function createFetchTransport(input: CreateFetchTransportInput = {}): CliTransport {
  const baseUrl = input.baseUrl ?? process.env.GCAH_SERVER_URL ?? "http://127.0.0.1:8787";
  const fetchImpl = input.fetchImpl ?? fetch;
  return async (request) => {
    const init: RequestInit = { method: request.method };
    if (request.body !== undefined) {
      init.headers = { "content-type": "application/json" };
      init.body = JSON.stringify(request.body);
    }
    const response = await fetchImpl(`${baseUrl.replace(/\/+$/u, "")}${request.url}`, init);
    const text = await response.text();
    return {
      status: response.status,
      body: text.length === 0 ? null : JSON.parse(text) as unknown
    };
  };
}

export function defaultTransport(): CliTransport {
  return createFetchTransport();
}
