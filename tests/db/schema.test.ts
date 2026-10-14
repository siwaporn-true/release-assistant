import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  auditEvents,
  evidence,
  exceptions,
  releaseIssues,
  releases,
  releaseSnapshots,
} from "../../src/db/schema";

describe("persistent release model", () => {
  it("requires Jira scope and a release branch", () => {
    const columns = getTableColumns(releases);

    expect(columns.jiraProjectKey.notNull).toBe(true);
    expect(columns.jiraFixVersionId.notNull).toBe(true);
    expect(columns.releaseBranch.notNull).toBe(true);
  });

  it("keeps normalized evidence traceable to its provider", () => {
    const columns = getTableColumns(evidence);

    expect(columns.provider.notNull).toBe(true);
    expect(columns.providerId.notNull).toBe(true);
    expect(columns.sourceUrl.notNull).toBe(true);
    expect(columns.normalizedData.notNull).toBe(true);
  });

  it("defines all records required for an auditable handoff", () => {
    expect(getTableColumns(releaseIssues).releaseId.notNull).toBe(true);
    expect(getTableColumns(exceptions).approverId.notNull).toBe(true);
    expect(getTableColumns(auditEvents).actorId.notNull).toBe(true);

    const snapshotColumns = getTableColumns(releaseSnapshots);
    expect(snapshotColumns.commitSha.notNull).toBe(true);
    expect(snapshotColumns.actorId.notNull).toBe(true);
    expect(snapshotColumns.handedOffAt.notNull).toBe(true);
  });
});
