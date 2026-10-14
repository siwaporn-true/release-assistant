CREATE TABLE "pull_request_selections" (
	"id" text PRIMARY KEY NOT NULL,
	"release_id" text NOT NULL,
	"jira_issue_key" text NOT NULL,
	"pull_request_number" integer NOT NULL,
	"selected_by" text NOT NULL,
	"selected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pull_request_selections" ADD CONSTRAINT "pull_request_selections_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE no action ON UPDATE no action;