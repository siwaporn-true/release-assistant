import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const assessmentStatus = pgEnum("assessment_status", [
  "passed",
  "needs_confirmation",
  "blocked",
  "checking",
  "cannot_verify",
]);

export const releases = pgTable("releases", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  jiraProjectKey: text("jira_project_key").notNull(),
  jiraFixVersionId: text("jira_fix_version_id").notNull(),
  releaseBranch: text("release_branch").notNull(),
  status: assessmentStatus("status").notNull().default("needs_confirmation"),
  revision: integer("revision").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const releaseIssues = pgTable("release_issues", {
  id: text("id").primaryKey(),
  releaseId: text("release_id").notNull().references(() => releases.id),
  jiraIssueId: text("jira_issue_id").notNull(),
  jiraKey: text("jira_key").notNull(),
  classification: text("classification").notNull(),
  sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }).notNull(),
  normalizedData: jsonb("normalized_data").notNull(),
});

export const evidence = pgTable("evidence", {
  id: text("id").primaryKey(),
  releaseId: text("release_id").notNull().references(() => releases.id),
  provider: text("provider").notNull(),
  providerId: text("provider_id").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }).notNull(),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
  normalizedData: jsonb("normalized_data").notNull(),
});

export const exceptions = pgTable("exceptions", {
  id: text("id").primaryKey(),
  releaseId: text("release_id").notNull().references(() => releases.id),
  ruleId: text("rule_id").notNull(),
  reason: text("reason").notNull(),
  approverId: text("approver_id").notNull(),
  supportingUrl: text("supporting_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  releaseId: text("release_id").notNull().references(() => releases.id),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  outcome: text("outcome").notNull(),
  details: jsonb("details").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const releaseSnapshots = pgTable("release_snapshots", {
  id: text("id").primaryKey(),
  releaseId: text("release_id").notNull().references(() => releases.id),
  revision: integer("revision").notNull(),
  commitSha: text("commit_sha").notNull(),
  actorId: text("actor_id").notNull(),
  handedOffAt: timestamp("handed_off_at", { withTimezone: true }).notNull(),
  snapshotData: jsonb("snapshot_data").notNull(),
  handoffText: text("handoff_text").notNull(),
});
