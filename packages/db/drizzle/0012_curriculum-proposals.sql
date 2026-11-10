CREATE TABLE "curriculum_proposal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"kind" text NOT NULL,
	"department_id" text NOT NULL,
	"title" text NOT NULL,
	"purpose" text NOT NULL,
	"scope" text NOT NULL,
	"depth" text NOT NULL,
	"concept_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reused_unit_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_candidates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"overlap_decisions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"decision_note" text,
	"version" integer DEFAULT 1 NOT NULL,
	"published_course_id" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "curriculum_proposal_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "curriculum_proposal" ADD CONSTRAINT "curriculum_proposal_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_proposal" ADD CONSTRAINT "curriculum_proposal_department_id_department_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."department"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_proposal" ADD CONSTRAINT "curriculum_proposal_published_course_id_course_id_fk" FOREIGN KEY ("published_course_id") REFERENCES "public"."course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_proposal_version" ADD CONSTRAINT "curriculum_proposal_version_proposal_id_curriculum_proposal_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."curriculum_proposal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "curriculum_proposal_owner_idx" ON "curriculum_proposal" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "curriculum_proposal_version_unique" ON "curriculum_proposal_version" USING btree ("proposal_id","version");