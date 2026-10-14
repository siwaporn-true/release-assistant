CREATE TYPE "public"."assessment_status" AS ENUM('passed', 'needs_confirmation', 'blocked', 'checking', 'cannot_verify');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"release_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"outcome" text NOT NULL,
	"details" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"release_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_id" text NOT NULL,
	"source_url" text NOT NULL,
	"source_updated_at" timestamp with time zone NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"normalized_data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exceptions" (
	"id" text PRIMARY KEY NOT NULL,
	"release_id" text NOT NULL,
	"rule_id" text NOT NULL,
	"reason" text NOT NULL,
	"approver_id" text NOT NULL,
	"supporting_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "release_issues" (
	"id" text PRIMARY KEY NOT NULL,
	"release_id" text NOT NULL,
	"jira_issue_id" text NOT NULL,
	"jira_key" text NOT NULL,
	"classification" text NOT NULL,
	"source_updated_at" timestamp with time zone NOT NULL,
	"normalized_data" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "release_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"release_id" text NOT NULL,
	"revision" integer NOT NULL,
	"commit_sha" text NOT NULL,
	"actor_id" text NOT NULL,
	"handed_off_at" timestamp with time zone NOT NULL,
	"snapshot_data" jsonb NOT NULL,
	"handoff_text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "releases" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"jira_project_key" text NOT NULL,
	"jira_fix_version_id" text NOT NULL,
	"release_branch" text NOT NULL,
	"status" "assessment_status" DEFAULT 'needs_confirmation' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_issues" ADD CONSTRAINT "release_issues_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_snapshots" ADD CONSTRAINT "release_snapshots_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE no action ON UPDATE no action;