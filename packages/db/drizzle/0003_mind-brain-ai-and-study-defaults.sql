CREATE TABLE "academic_deadline" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"enrolment_id" uuid,
	"exercise_id" text,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"binding" boolean NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_by" text DEFAULT 'learner' NOT NULL,
	"met_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "programme_participation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"programme_id" text NOT NULL,
	"status" text DEFAULT 'following' NOT NULL,
	"source" text NOT NULL,
	"focus_block_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "learner_profile" ADD COLUMN "study_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "course_version" ADD COLUMN "catalogue_notes" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "programme" ADD COLUMN "reference_id" text;--> statement-breakpoint
ALTER TABLE "programme" ADD COLUMN "blocks" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "programme" ADD COLUMN "electives" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "programme" ADD COLUMN "methods" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "programme" ADD COLUMN "paper_seminar" jsonb;--> statement-breakpoint
ALTER TABLE "academic_deadline" ADD CONSTRAINT "academic_deadline_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_deadline" ADD CONSTRAINT "academic_deadline_enrolment_id_enrolment_id_fk" FOREIGN KEY ("enrolment_id") REFERENCES "public"."enrolment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academic_deadline" ADD CONSTRAINT "academic_deadline_exercise_id_unit_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."unit_exercise"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programme_participation" ADD CONSTRAINT "programme_participation_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programme_participation" ADD CONSTRAINT "programme_participation_programme_id_programme_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programme"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "academic_deadline_owner_idx" ON "academic_deadline" USING btree ("owner_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "programme_participation_owner_programme" ON "programme_participation" USING btree ("owner_id","programme_id");--> statement-breakpoint
ALTER TABLE "programme" ADD CONSTRAINT "programme_reference_id_unique" UNIQUE("reference_id");