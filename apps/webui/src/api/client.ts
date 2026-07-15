import type { ApprovalDecisionRequest } from "@gcah/shared";

export interface ApiClient {
  submitApproval(runId: string, actionId: string, request: ApprovalDecisionRequest): Promise<void>;
}

export function createApiClient(fetchFn: typeof fetch = fetch): ApiClient {
  return {
    async submitApproval(runId, actionId, request) {
      const response = await fetchFn(`/api/runs/${encodeURIComponent(runId)}/approvals/${encodeURIComponent(actionId)}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request)
      });
      if (!response.ok) throw new Error("approval submit failed");
    }
  };
}
