CREATE TABLE "research_artifact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"notebook_entry_id" uuid,
	"blob_key" text,
	"filename" text,
	"content_type" text,
	"size_bytes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"draft_markdown" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"status" text NOT NULL,
	"checks" jsonb NOT NULL,
	"feedback" jsonb,
	"error" text,
	"provider_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_oral_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"focus" text NOT NULL,
	"preferred_times" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"discussion_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"question" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'formulating' NOT NULL,
	"programme_id" text,
	"block_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_leads" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_provenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"origin" text NOT NULL,
	"version_or_date" text DEFAULT '' NOT NULL,
	"licence" text DEFAULT '' NOT NULL,
	"human_participants" text DEFAULT 'none' NOT NULL,
	"seed" text,
	"generator" text,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"body_markdown" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "research_artifact" ADD CONSTRAINT "research_artifact_project_id_research_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."research_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_document" ADD CONSTRAINT "research_document_project_id_research_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."research_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_feedback" ADD CONSTRAINT "research_feedback_project_id_research_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."research_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_feedback" ADD CONSTRAINT "research_feedback_version_id_research_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."research_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_oral_request" ADD CONSTRAINT "research_oral_request_project_id_research_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."research_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_project" ADD CONSTRAINT "research_project_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_provenance" ADD CONSTRAINT "research_provenance_project_id_research_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."research_project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_version" ADD CONSTRAINT "research_version_document_id_research_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."research_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "research_artifact_project_idx" ON "research_artifact" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "research_document_kind_idx" ON "research_document" USING btree ("project_id","kind");--> statement-breakpoint
CREATE INDEX "research_feedback_project_idx" ON "research_feedback" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "research_oral_project_idx" ON "research_oral_request" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "research_project_owner_idx" ON "research_project" USING btree ("owner_id","updated_at");--> statement-breakpoint
CREATE INDEX "research_provenance_project_idx" ON "research_provenance" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "research_version_number_idx" ON "research_version" USING btree ("document_id","version");