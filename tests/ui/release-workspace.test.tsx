// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NewReleaseForm } from "../../src/components/release/new-release-form";
import { ReleaseWorkspace } from "../../src/components/release/release-workspace";

afterEach(cleanup);

const workspace = {
  id: "release-1",
  revision: 3,
  lastRefreshedAt: "2026-10-14T05:00:00.000Z",
  config: {
    jiraProjectKey: "SUN",
    jiraFixVersionId: "21221",
    releaseBranch: "release/12.3.0",
    githubOwner: "true",
    githubRepo: "app",
    workflowId: "preprod.yml",
  },
  assessment: {
    status: "blocked" as const,
    readyForQa: false,
    gates: {
      scope: { status: "passed" as const, findings: [] },
      code: { status: "needs_confirmation" as const, findings: [{ ruleId: "ambiguous_pr", status: "needs_confirmation" as const, subject: "SUN-2" }] },
      build: { status: "blocked" as const, findings: [{ ruleId: "workflow_failed", status: "blocked" as const, subject: "abc1234" }] },
    },
    findings: [{ ruleId: "workflow_failed", status: "blocked" as const, subject: "abc1234" }],
    appliedExceptions: [],
  },
  actions: [{ ruleId: "workflow_failed", subject: "abc1234", priority: 0 }],
  evidence: {
    jiraIssues: [{ key: "SUN-2", summary: "Checkout", sourceUrl: "https://jira.example/browse/SUN-2", classification: "code_bearing" }],
    pullRequests: [
      { number: 21, title: "SUN-2 first", sourceUrl: "https://github.example/pull/21", targetBranch: "release/12.3.0" },
      { number: 22, title: "SUN-2 second", sourceUrl: "https://github.example/pull/22", targetBranch: "release/12.3.0" },
    ],
    branchHead: { sha: "abc1234", sourceUrl: "https://github.example/commit/abc1234" },
    workflow: { runId: 88, result: "failed", sha: "abc1234", sourceUrl: "https://github.example/actions/88", freshness: "fresh" },
  },
  connectorErrors: {},
};

describe("release workspace", () => {
  it("creates a release from Project and Fix Version selections", () => {
    const onSubmit = vi.fn();
    render(<NewReleaseForm projects={[{ key: "SUN", name: "Sun" }]} versions={[{ id: "21221", name: "12.3.0" }]} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Project"), { target: { value: "SUN" } });
    fireEvent.change(screen.getByLabelText("Fix Version"), { target: { value: "21221" } });
    fireEvent.change(screen.getByLabelText("Release branch"), { target: { value: "release/12.3.0" } });
    fireEvent.click(screen.getByRole("button", { name: "Check release" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ jiraProjectKey: "SUN", jiraFixVersionId: "21221" }));
  });

  it("puts the readiness answer and highest-priority action first", () => {
    render(<ReleaseWorkspace workspace={workspace} />);

    expect(screen.getByRole("heading", { level: 1, name: "Not ready for QA" })).toBeTruthy();
    expect(screen.getByText("Fix failed workflow")).toBeTruthy();
    expect(screen.getByText("Fix failed workflow").compareDocumentPosition(screen.getByText("Ticket evidence")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("expands the active gate, collapses passed gates, and exposes source links", () => {
    render(<ReleaseWorkspace workspace={workspace} />);

    expect(screen.getByText("Build Ready").closest("details")?.open).toBe(true);
    expect(screen.getByText("Scope Ready").closest("details")?.open).toBe(false);
    expect(screen.getByRole("link", { name: "SUN-2" }).getAttribute("href")).toBe("https://jira.example/browse/SUN-2");
    expect(screen.getByRole("link", { name: "Workflow run 88" }).getAttribute("href")).toBe("https://github.example/actions/88");
  });

  it("shows ambiguous PR selection without silently choosing", () => {
    render(<ReleaseWorkspace workspace={workspace} />);
    expect(screen.getByRole("group", { name: "Choose pull request for SUN-2" })).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect((screen.getAllByRole("radio")[0] as HTMLInputElement).checked).toBe(false);
  });

  it("labels stale and unavailable evidence, plus loading, empty, and error states", () => {
    const { rerender } = render(<ReleaseWorkspace workspace={{ ...workspace, evidence: { ...workspace.evidence, workflow: { ...workspace.evidence.workflow, freshness: "stale" } }, connectorErrors: { github: "Unavailable" } }} />);
    expect(screen.getByText("Stale evidence")).toBeTruthy();
    expect(screen.getByText("Cannot verify GitHub: Unavailable")).toBeTruthy();

    rerender(<ReleaseWorkspace state="loading" />);
    expect(screen.getByText("Checking release evidence…")).toBeTruthy();
    rerender(<ReleaseWorkspace state="empty" />);
    expect(screen.getByText("No release selected")).toBeTruthy();
    rerender(<ReleaseWorkspace state="error" error="Could not load release" />);
    expect(screen.getByRole("alert").textContent).toContain("Could not load release");
  });
});
