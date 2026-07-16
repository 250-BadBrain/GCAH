import type { LlmClientResult } from "@gcah/core";

export interface DemoWebScenario {
  id: string;
  title: string;
  marker: string;
  task: string;
  files: Record<string, string>;
  script(input: { baseSha256: string; almostSha256: string }): readonly LlmClientResult[];
}

export const demoWebScenarios: readonly DemoWebScenario[] = [
  {
    id: "successful-agent-run",
    title: "Full agent run with feedback",
    marker: "COMPLETE_SUCCESS",
    task: "Read README.md, fix src/app.ts, run validation, and finish only after validation passes.",
    files: {
      "README.md": "Demo task: make src/app.ts export the word fixed.\n",
      "src/app.ts": "export const value = \"broken\";\n"
    },
    script: ({ baseSha256, almostSha256 }) => [
      { response: { kind: "tool", tool: "read", args: { path: "README.md" }, rationale: "inspect the assignment" }, usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18 } },
      {
        response: {
          kind: "tool",
          tool: "patch",
          args: {
            path: "src/app.ts",
            baseSha256,
            unifiedDiff: "--- a/src/app.ts\n+++ b/src/app.ts\n@@\n-export const value = \"broken\";\n+export const value = \"almost\";\n"
          },
          rationale: "make the first attempted fix"
        },
        usage: { inputTokens: 12, outputTokens: 16, totalTokens: 28 }
      },
      { response: { kind: "finish", summary: "done too early", rationale: "I think the file is fixed" }, usage: { inputTokens: 8, outputTokens: 4, totalTokens: 12 } },
      {
        response: {
          kind: "tool",
          tool: "patch",
          args: {
            path: "src/app.ts",
            baseSha256: almostSha256,
            unifiedDiff: "--- a/src/app.ts\n+++ b/src/app.ts\n@@\n-export const value = \"almost\";\n+export const value = \"fixed\";\n"
          },
          rationale: "change action after validation feedback"
        },
        usage: { inputTokens: 14, outputTokens: 14, totalTokens: 28 }
      },
      { response: { kind: "finish", summary: "fixed after validation feedback", rationale: "validation passed" }, usage: null }
    ]
  },
  {
    id: "dangerous-denied",
    title: "Dangerous action denied",
    marker: "DANGEROUS_ACTION_DENIED",
    task: "Attempt a privileged command so governance denies it.",
    files: { "README.md": "This scenario demonstrates policy denial.\n" },
    script: () => [
      { response: { kind: "tool", tool: "run_command", args: { executable: "sudo", args: ["rm", "-rf", "."], cwd: ".", timeoutMs: 1000 }, rationale: "dangerous action" }, usage: null }
    ]
  },
  {
    id: "approval-required",
    title: "Approval pause and resume",
    marker: "REQUIRE_APPROVAL",
    task: "Finish the run, but require a human approval before completion.",
    files: { "README.md": "Approval scenario.\n" },
    script: () => [
      { response: { kind: "finish", summary: "ready for approval", rationale: "wait for teacher approval" }, usage: null },
      { response: { kind: "finish", summary: "completed after approval", rationale: "approval accepted" }, usage: null }
    ]
  }
];
