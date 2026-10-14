export interface HandoffInput { projectKey: string; fixVersionId: string; ticketKeys: string[]; selectedPullRequests: number[]; releaseBranch: string; commitSha: string; workflow: { runId: number; result: string }; exceptions: Array<{ ruleId: string; reason: string }>; actorId: string; handedOffAt: string }
export function generateHandoff(input: HandoffInput): string {
  const exceptions = input.exceptions.length ? input.exceptions.map((item) => `- ${item.ruleId}: ${item.reason}`).join("\n") : "- None";
  return [`QA handoff — ${input.projectKey} / Fix Version ${input.fixVersionId}`, `Release branch: ${input.releaseBranch}`, `Commit: ${input.commitSha}`, `Tickets: ${input.ticketKeys.join(", ")}`, `Pull requests: ${input.selectedPullRequests.map((number) => `#${number}`).join(", ")}`, `Workflow #${input.workflow.runId}: ${input.workflow.result}`, "Exceptions:", exceptions, `Prepared by ${input.actorId} at ${input.handedOffAt}`].join("\n");
}
