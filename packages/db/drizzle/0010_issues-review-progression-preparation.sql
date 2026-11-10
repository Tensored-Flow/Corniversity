CREATE TABLE "preparation_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"course_id" text NOT NULL,
	"intake" jsonb NOT NULL,
	"budget_usd" numeric(12, 6) NOT NULL,
	"auto_prepare" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"status_note" text,
	"runs" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "preparation_stage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"stage_key" text NOT NULL,
	"unit_key" text DEFAULT '' NOT NULL,
	"sequence" integer NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"artifact" jsonb,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lease_until" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "unit_draft" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"unit_id" text NOT NULL,
	"version" integer NOT NULL,
	"draft" jsonb NOT NULL,
	"checks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text NOT NULL,
	"provider_run_id" uuid,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "unit_publication" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" text NOT NULL,
	"draft_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"version" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"previous" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "misconception_record" ALTER COLUMN "concept_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "misconception_record" ALTER COLUMN "status" SET DEFAULT 'proposed';--> statement-breakpoint
ALTER TABLE "unit_exercise" ADD COLUMN "progression" jsonb;--> statement-breakpoint
ALTER TABLE "learner_profile" ADD COLUMN "review_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "misconception_record" ADD COLUMN "origin" text DEFAULT 'learner' NOT NULL;--> statement-breakpoint
ALTER TABLE "misconception_record" ADD COLUMN "exercise_id" text;--> statement-breakpoint
ALTER TABLE "misconception_record" ADD COLUMN "submission_version_id" uuid;--> statement-breakpoint
ALTER TABLE "misconception_record" ADD COLUMN "assessment_run_id" uuid;--> statement-breakpoint
ALTER TABLE "misconception_record" ADD COLUMN "check_id" text;--> statement-breakpoint
ALTER TABLE "misconception_record" ADD COLUMN "interpretation" text;--> statement-breakpoint
ALTER TABLE "misconception_record" ADD COLUMN "learner_note" text;--> statement-breakpoint
ALTER TABLE "misconception_record" ADD COLUMN "follow_up" text;--> statement-breakpoint
ALTER TABLE "misconception_record" ADD COLUMN "resolved_by" jsonb;--> statement-breakpoint
ALTER TABLE "misconception_record" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "revision_item" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "revision_item" ADD COLUMN "snoozed_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "revision_item" ADD COLUMN "issue_id" uuid;--> statement-breakpoint
ALTER TABLE "revision_item" ADD COLUMN "exercise_id" text;--> statement-breakpoint
ALTER TABLE "preparation_request" ADD CONSTRAINT "preparation_request_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preparation_request" ADD CONSTRAINT "preparation_request_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preparation_stage" ADD CONSTRAINT "preparation_stage_request_id_preparation_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."preparation_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_draft" ADD CONSTRAINT "unit_draft_request_id_preparation_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."preparation_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_draft" ADD CONSTRAINT "unit_draft_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_draft" ADD CONSTRAINT "unit_draft_unit_id_teaching_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."teaching_unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_publication" ADD CONSTRAINT "unit_publication_unit_id_teaching_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."teaching_unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_publication" ADD CONSTRAINT "unit_publication_draft_id_unit_draft_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."unit_draft"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_publication" ADD CONSTRAINT "unit_publication_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "preparation_request_owner_idx" ON "preparation_request" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "preparation_stage_unique" ON "preparation_stage" USING btree ("request_id","stage_key","unit_key");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_draft_version_unique" ON "unit_draft" USING btree ("unit_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_publication_active_unique" ON "unit_publication" USING btree ("unit_id") WHERE "unit_publication"."active";--> statement-breakpoint
CREATE INDEX "misconception_exercise_idx" ON "misconception_record" USING btree ("owner_id","exercise_id");--> statement-breakpoint
UPDATE "misconception_record" SET "status" = 'proposed', "origin" = 'assessor', "interpretation" = 'Recorded before issues could be confirmed or disputed; who proposed it was not stored.' WHERE "status" = 'active';--> statement-breakpoint
UPDATE "misconception_record" SET "status" = 'resolved', "origin" = 'assessor', "interpretation" = 'Recorded and cleared before issues could be confirmed or disputed; who proposed it was not stored.' WHERE "status" = 'cleared';
