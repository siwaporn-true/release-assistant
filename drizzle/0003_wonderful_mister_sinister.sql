ALTER TABLE "releases" ADD COLUMN "github_owner" text NOT NULL;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "github_repo" text NOT NULL;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "workflow_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "baseline_keys" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "assessment_data" jsonb;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "action_data" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "connector_errors" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "evidence_fingerprint" text;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "last_refreshed_at" timestamp with time zone;