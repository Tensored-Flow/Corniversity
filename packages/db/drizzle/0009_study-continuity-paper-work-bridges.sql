CREATE TABLE "assistance_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"learning_session_id" uuid,
	"attempt_id" uuid,
	"exercise_id" text,
	"mode" text NOT NULL,
	"anchor" jsonb,
	"provider_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bridge_visit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"concept_id" text NOT NULL,
	"learning_session_id" uuid,
	"parent_visit_id" uuid,
	"depth" integer NOT NULL,
	"trail" jsonb NOT NULL,
	"return_to" jsonb NOT NULL,
	"check_answer" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"returned_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "concept_bridge" (
	"concept_id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"body_markdown" text NOT NULL,
	"check" jsonb,
	"assumes_concept_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"origin" text NOT NULL,
	"status" text NOT NULL,
	"checks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcription_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"text" text NOT NULL,
	"uncertain" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text NOT NULL,
	"provider_run_id" uuid,
	"based_on_version" integer,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_page" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"attempt_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"blob_key" text NOT NULL,
	"mime" text NOT NULL,
	"byte_size" integer NOT NULL,
	"sha256" text NOT NULL,
	"width" integer,
	"height" integer,
	"rotation" integer DEFAULT 0 NOT NULL,
	"original_filename" text,
	"metadata_stripped" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "notebook_entry" ADD COLUMN "learning_session_id" uuid;--> statement-breakpoint
ALTER TABLE "notebook_entry" ADD COLUMN "anchor" jsonb;--> statement-breakpoint
ALTER TABLE "submission_version" ADD COLUMN "transcription_version_id" uuid;--> statement-breakpoint
ALTER TABLE "submission_version" ADD COLUMN "page_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "assistance_event" ADD CONSTRAINT "assistance_event_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistance_event" ADD CONSTRAINT "assistance_event_learning_session_id_learning_session_id_fk" FOREIGN KEY ("learning_session_id") REFERENCES "public"."learning_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistance_event" ADD CONSTRAINT "assistance_event_attempt_id_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bridge_visit" ADD CONSTRAINT "bridge_visit_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bridge_visit" ADD CONSTRAINT "bridge_visit_concept_id_concept_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concept"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bridge_visit" ADD CONSTRAINT "bridge_visit_learning_session_id_learning_session_id_fk" FOREIGN KEY ("learning_session_id") REFERENCES "public"."learning_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_bridge" ADD CONSTRAINT "concept_bridge_concept_id_concept_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concept"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcription_version" ADD CONSTRAINT "transcription_version_attempt_id_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_page" ADD CONSTRAINT "work_page_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_page" ADD CONSTRAINT "work_page_attempt_id_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assistance_owner_idx" ON "assistance_event" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "assistance_attempt_idx" ON "assistance_event" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "bridge_visit_owner_idx" ON "bridge_visit" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "transcription_version_unique" ON "transcription_version" USING btree ("attempt_id","version");--> statement-breakpoint
CREATE INDEX "work_page_attempt_idx" ON "work_page" USING btree ("attempt_id","position");--> statement-breakpoint
ALTER TABLE "notebook_entry" ADD CONSTRAINT "notebook_entry_learning_session_id_learning_session_id_fk" FOREIGN KEY ("learning_session_id") REFERENCES "public"."learning_session"("id") ON DELETE set null ON UPDATE no action;