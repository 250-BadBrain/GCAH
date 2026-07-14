import { createCredentialResolver, createCredentialStore, createOsKeychainBackend } from "@gcah/credentials";
import { OpenAiCompatibleLlmClient } from "@gcah/llm";

if (process.env.GCAH_RUN_REAL_LLM_INTEGRATION !== "1") {
  console.error("Set GCAH_RUN_REAL_LLM_INTEGRATION=1 to run this manual integration.");
  process.exit(1);
}

const baseUrl = process.env.GCAH_LLM_BASE_URL;
const model = process.env.GCAH_LLM_MODEL;
if (baseUrl === undefined || model === undefined) {
  console.error("GCAH_LLM_BASE_URL and GCAH_LLM_MODEL are required.");
  process.exit(1);
}

const store = createCredentialStore({ backend: createOsKeychainBackend() });
const resolver = createCredentialResolver({
  osStore: store,
  environment: { enabled: false, values: process.env },
  dotenv: { enabled: false, values: {} }
});

const client = new OpenAiCompatibleLlmClient({
  baseUrl,
  model,
  providerName: "manual",
  credentialResolver: resolver,
  transport: async (request) => {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(request.timeoutMs)
    });
    return { status: response.status, body: await response.json() };
  }
});

const result = await client.complete([{ role: "user", content: "Return JSON: {\"kind\":\"finish\",\"summary\":\"ok\",\"rationale\":\"manual check\"}" }]);
console.log(JSON.stringify({ response: result.response, usage: result.usage }, null, 2));
