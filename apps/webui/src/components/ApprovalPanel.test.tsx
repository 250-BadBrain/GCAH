// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApprovalPanel } from "./ApprovalPanel.js";

describe("ApprovalPanel", () => {
  it("submits one-time and session approval decisions without local policy calculation", async () => {
    const user = userEvent.setup();
    const submitApproval = vi.fn(async () => undefined);
    render(<ApprovalPanel runId="run-1" actionId="action-1" submitApproval={submitApproval} />);

    await user.type(screen.getByLabelText("Reason"), "Reviewed");
    await user.click(screen.getByRole("button", { name: "Approve once" }));
    await user.click(screen.getByRole("button", { name: "Approve session" }));

    expect(submitApproval).toHaveBeenNthCalledWith(1, "run-1", "action-1", {
      decision: "approve_once",
      reason: "Reviewed"
    });
    expect(submitApproval).toHaveBeenNthCalledWith(2, "run-1", "action-1", {
      decision: "approve_session",
      reason: "Reviewed"
    });
  });
});
