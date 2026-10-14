"use client";

import { EvidenceTable } from "../../../src/components/release/evidence-table";
import { GateTimeline } from "../../../src/components/release/gate-timeline";
import { NextAction } from "../../../src/components/release/next-action";
import { ReleaseHeader } from "../../../src/components/release/release-header";
import { ReleaseHealth } from "../../../src/components/release/release-health";
import type { AssessmentStatus } from "../../../src/domain/release/types";

interface WorkspaceData {
  lastRefreshedAt?: string | null;
  config: { jiraProjectKey: string; jiraFixVersionId: string; releaseBranch: string };
  assessment: {
    readyForQa: boolean;
    status: AssessmentStatus;
    gates: Record<"scope" | "code" | "build", { status: AssessmentStatus; findings: Array<{ ruleId: string; subject?: string }> }>;
  };
  actions?: Array<{ ruleId: string; subject?: string }>;
  evidence: {
    jiraIssues?: Array<{ key: string; summary: string; sourceUrl: string; classification?: string }>;
    pullRequests?: Array<{ number: number; title: string; sourceUrl: string }>;
    workflow?: { runId: number; sourceUrl: string; result: string; freshness?: string };
  };
  connectorErrors?: Record<string, string>;
}

export function ReleaseWorkspace({ workspace, state = "ready", error }: { workspace?: WorkspaceData; state?: "ready" | "loading" | "empty" | "error"; error?: string }) {
  if (state === "loading") return <main><p role="status">Checking release evidence…</p></main>;
  if (state === "error") return <main><p role="alert">{error ?? "Could not load release"}</p></main>;
  if (state === "empty" || !workspace) return <main><h1>No release selected</h1><p>Choose a Jira Project and Fix Version to begin.</p></main>;
  const ambiguous = workspace.assessment?.gates?.code?.findings?.find((finding: { ruleId: string }) => finding.ruleId === "ambiguous_pr");
  return <main className="workspace"><ReleaseHeader project={workspace.config.jiraProjectKey} version={workspace.config.jiraFixVersionId} branch={workspace.config.releaseBranch} refreshedAt={workspace.lastRefreshedAt} />{Object.entries(workspace.connectorErrors ?? {}).map(([provider, message]) => <p role="alert" className="connector-warning" key={provider}>Cannot verify {provider === "github" ? "GitHub" : provider}: {String(message)}</p>)}<ReleaseHealth ready={workspace.assessment.readyForQa} status={workspace.assessment.status} /><NextAction action={workspace.actions?.[0]} /><GateTimeline gates={workspace.assessment.gates} /><EvidenceTable issues={workspace.evidence.jiraIssues} pullRequests={workspace.evidence.pullRequests} workflow={workspace.evidence.workflow} ambiguousKey={ambiguous?.subject} /></main>;
}
export default function ReleasePage() { return <ReleaseWorkspace state="loading" />; }
