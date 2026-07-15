import { useState } from "react";
import type { ApprovalDecisionRequest } from "@gcah/shared";

export interface ApprovalPanelProps {
  runId: string;
  actionId: string;
  submitApproval(runId: string, actionId: string, request: ApprovalDecisionRequest): Promise<void>;
}

export function ApprovalPanel({ runId, actionId, submitApproval }: ApprovalPanelProps): React.JSX.Element {
  const [reason, setReason] = useState("");

  async function submit(decision: ApprovalDecisionRequest["decision"]): Promise<void> {
    await submitApproval(runId, actionId, { decision, reason });
  }

  return (
    <section aria-labelledby="approval-heading">
      <h2 id="approval-heading">Approval</h2>
      <label>
        Reason
        <textarea value={reason} onChange={(event) => setReason(event.currentTarget.value)} />
      </label>
      <div className="approval-actions">
        <button type="button" onClick={() => void submit("approve_once")}>Approve once</button>
        <button type="button" onClick={() => void submit("approve_session")}>Approve session</button>
        <button type="button" onClick={() => void submit("reject")}>Reject</button>
      </div>
    </section>
  );
}
