# Manual Real LLM Integration

This check is manual only. It is excluded from default `pnpm test`, `pnpm verify`, and CI.

Required manual setup:

1. Store the provider key through the credential flow for `openai-compatible`.
2. Set `GCAH_RUN_REAL_LLM_INTEGRATION=1`.
3. Set `GCAH_LLM_BASE_URL` to an OpenAI-compatible `/v1` base URL.
4. Set `GCAH_LLM_MODEL` to the course gateway model name.
5. Run `tsx scripts/integration-real-llm.ts` from a development shell with `tsx` available.

The adapter sends the key only in the outbound `Authorization` header. It must not be committed, logged, persisted in SQLite, included in events, or returned in serialized errors.
