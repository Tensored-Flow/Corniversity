CREATE TYPE "public"."course_readiness" AS ENUM('proposed', 'source_verified', 'syllabus_ready', 'teaching_ready', 'resource_blocked');--> statement-breakpoint
CREATE TYPE "public"."evidence_state" AS ENUM('unassessed', 'introduced', 'practised', 'demonstrated', 'revisit');--> statement-breakpoint
CREATE TYPE "public"."immersion" AS ENUM('quiet', 'collegiate', 'full');--> statement-breakpoint
CREATE TYPE "public"."learning_mode" AS ENUM('enrolled', 'audit', 'reading_seminar');--> statement-breakpoint
CREATE TYPE "public"."permission_status" AS ENUM('unknown', 'allowed', 'denied');--> statement-breakpoint
CREATE TYPE "public"."processing_action" AS ENUM('local_read', 'local_extract', 'private_cloud_store', 'external_ai', 'external_embedding', 'share');--> statement-breakpoint
CREATE TYPE "public"."submission_state" AS ENUM('draft', 'submitted', 'reviewing', 'feedback_ready', 'revision_requested', 'needs_review', 'revised', 'accepted');--> statement-breakpoint
CREATE TYPE "public"."unit_status" AS ENUM('draft', 'checking', 'ready', 'blocked');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'learner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_setting" (
	"user_id" text PRIMARY KEY NOT NULL,
	"per_run_usd" numeric(10, 4) DEFAULT '0.50' NOT NULL,
	"daily_usd" numeric(10, 4) DEFAULT '3.00' NOT NULL,
	"monthly_usd" numeric(10, 4) DEFAULT '40.00' NOT NULL,
	"hard_stop" boolean DEFAULT true NOT NULL,
	"warn_fraction" real DEFAULT 0.8 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"granted" boolean NOT NULL,
	"basis" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "device_pairing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"roots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_status" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "device_pairing_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "learner_concept_override" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"concept_id" text NOT NULL,
	"claim" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learner_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"timezone" text DEFAULT 'Europe/London' NOT NULL,
	"immersion" "immersion" DEFAULT 'collegiate' NOT NULL,
	"accessibility" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"learning_styles" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"weekly_hours_ceiling" integer,
	"study_rhythm" text,
	"goals_text" text,
	"social_layer_enabled" boolean DEFAULT true NOT NULL,
	"notifications" jsonb DEFAULT '{"inApp":true,"email":false}'::jsonb NOT NULL,
	"onboarding_step" integer DEFAULT 1 NOT NULL,
	"onboarding_answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"theme" text DEFAULT 'light' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pairing_code" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pairing_code_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
CREATE TABLE "provider_setting" (
	"user_id" text PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'fixture' NOT NULL,
	"api_key_encrypted" text,
	"api_key_hint" text,
	"model_map" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concept" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"department_id" text NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"primary_department_id" text NOT NULL,
	"level" text NOT NULL,
	"position" text NOT NULL,
	"launch" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_department" (
	"course_id" text NOT NULL,
	"department_id" text NOT NULL,
	CONSTRAINT "course_department_course_id_department_id_pk" PRIMARY KEY("course_id","department_id")
);
--> statement-breakpoint
CREATE TABLE "course_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" text NOT NULL,
	"version" integer NOT NULL,
	"content_hash" text NOT NULL,
	"readiness" "course_readiness" NOT NULL,
	"purpose" text NOT NULL,
	"description" text NOT NULL,
	"workload" jsonb NOT NULL,
	"outcomes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assessment_specs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"blockers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provenance" jsonb NOT NULL,
	"primary_source_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"supplemental_source_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"modes_offered" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recommended_concept_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"teaches_concept_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"prerequisite_rule_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"convenor_persona_id" text,
	"tutor_persona_id" text,
	"external_syllabus_note" text,
	"is_current" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "department" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"short_title" text NOT NULL,
	"identity" text NOT NULL,
	"emblem" text NOT NULL,
	"paths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"faculty_persona_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"conventions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instructor_artifact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" text NOT NULL,
	"exercise_id" text,
	"kind" text NOT NULL,
	"markdown" text NOT NULL,
	"release_policy" text DEFAULT 'never' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prerequisite_rule" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"strength" text NOT NULL,
	"description" text NOT NULL,
	"alternatives" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "programme" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"department_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"stages" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teaching_unit" (
	"id" text PRIMARY KEY NOT NULL,
	"course_version_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"objectives" jsonb NOT NULL,
	"prerequisite_concept_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"teaches_concept_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preparation" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"activities" jsonb NOT NULL,
	"exit_check" jsonb NOT NULL,
	"misconceptions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"estimated_minutes" integer NOT NULL,
	"status" "unit_status" NOT NULL,
	"checks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"lesson_markdown" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unit_exercise" (
	"id" text PRIMARY KEY NOT NULL,
	"unit_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"prompt_markdown" text NOT NULL,
	"concept_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hint_ladder" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deterministic_checks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rubric" jsonb NOT NULL,
	"rubric_version" integer NOT NULL,
	"origin" text NOT NULL,
	"attribution" text,
	"external_locator_id" text,
	"estimated_minutes" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "annotation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"asset_id" uuid,
	"source_version_id" text,
	"locator" jsonb NOT NULL,
	"selected_text" text,
	"note_markdown" text DEFAULT '' NOT NULL,
	"mapping_status" text DEFAULT 'resolved' NOT NULL,
	"notebook_entry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_blob" (
	"storage_key" text PRIMARY KEY NOT NULL,
	"data" "bytea" NOT NULL,
	"size_bytes" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extracted_page" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"physical_index" integer NOT NULL,
	"printed_label" text,
	"text" text NOT NULL,
	"char_count" integer NOT NULL,
	"quality" jsonb NOT NULL,
	"tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce("extracted_page"."text", ''))) STORED
);
--> statement-breakpoint
CREATE TABLE "locator" (
	"id" text PRIMARY KEY NOT NULL,
	"source_version_id" text NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"label" text NOT NULL,
	"verified_at" date NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "passage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"heading" text,
	"kind" text DEFAULT 'paragraph' NOT NULL,
	"text" text NOT NULL,
	"tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce("passage"."text", ''))) STORED
);
--> statement-breakpoint
CREATE TABLE "processing_permission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"asset_id" uuid,
	"source_version_id" text,
	"action" "processing_action" NOT NULL,
	"status" "permission_status" NOT NULL,
	"basis" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "resource_asset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"source_version_id" text,
	"filename" text NOT NULL,
	"media_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"sha256" text NOT NULL,
	"storage_key" text,
	"status" text NOT NULL,
	"origin" text NOT NULL,
	"candidate_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confirmed_title" text,
	"confirmed_authors" jsonb,
	"confirmed_edition" text,
	"page_count" integer,
	"printed_labels_present" boolean,
	"course_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"local_only" boolean DEFAULT true NOT NULL,
	"device_pairing_id" uuid,
	"local_path_hint" text,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "resource_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"course_id" text,
	"unit_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"title" text NOT NULL,
	"authors" text,
	"edition" text,
	"isbn" text,
	"why" text NOT NULL,
	"essential" boolean DEFAULT false NOT NULL,
	"chapters_needed" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"open_alternative" text,
	"accepted_formats" jsonb DEFAULT '["pdf"]'::jsonb NOT NULL,
	"destination_folder" text NOT NULL,
	"caveats" text,
	"min_permission" text DEFAULT 'local_read' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"authors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"institution" text,
	"kind" text NOT NULL,
	"canonical_url" text NOT NULL,
	"description" text,
	"isbn" text,
	"code_licence" text,
	"rights_notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_version_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_version" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"verified_at" date NOT NULL,
	"verified_by" text NOT NULL,
	"components_seen" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"licence" text NOT NULL,
	"licence_url" text,
	"access_status" text NOT NULL,
	"import_allowed" boolean DEFAULT false NOT NULL,
	"import_hosts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"limitations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_window" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"weekday" integer NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"detail_level" text DEFAULT 'minimal' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "calendar_token_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "change_proposal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"kind" text NOT NULL,
	"proposed_by" text NOT NULL,
	"title" text NOT NULL,
	"rationale" text NOT NULL,
	"diff" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "commitment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"weekday" integer,
	"date" date,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	"protected" boolean DEFAULT true NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "day_off" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"date" date NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "enrolment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"term_id" uuid,
	"course_version_id" uuid NOT NULL,
	"mode" "learning_mode" NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "enrolment_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "plan_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"term_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" text NOT NULL,
	"inputs_snapshot" jsonb NOT NULL,
	"summary" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "scheduled_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_version_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"enrolment_id" uuid NOT NULL,
	"unit_id" text,
	"activity_id" text NOT NULL,
	"session_kind" text NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"uid" text NOT NULL,
	"moved_from_session_id" uuid,
	"learning_session_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "term" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"teaching_weeks" integer DEFAULT 10 NOT NULL,
	"reading_week" boolean DEFAULT true NOT NULL,
	"synthesis_week" boolean DEFAULT true NOT NULL,
	"mode" text DEFAULT 'term' NOT NULL,
	"timezone" text DEFAULT 'Europe/London' NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_version_id" uuid NOT NULL,
	"rubric_version" integer NOT NULL,
	"grader_config" jsonb NOT NULL,
	"provider_run_id" uuid,
	"status" text DEFAULT 'queued' NOT NULL,
	"deterministic_results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"feedback" jsonb,
	"verdict" text,
	"confidence" real,
	"error" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "assessment_run_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"learning_session_id" uuid,
	"mode" text DEFAULT 'practice' NOT NULL,
	"state" "submission_state" DEFAULT 'draft' NOT NULL,
	"hints_used" integer DEFAULT 0 NOT NULL,
	"solution_revealed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concept_state" (
	"owner_id" text NOT NULL,
	"concept_id" text NOT NULL,
	"state" "evidence_state" DEFAULT 'unassessed' NOT NULL,
	"self_confidence" integer,
	"evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "concept_state_owner_id_concept_id_pk" PRIMARY KEY("owner_id","concept_id")
);
--> statement-breakpoint
CREATE TABLE "conversation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"learning_session_id" uuid,
	"role" text NOT NULL,
	"persona_id" text,
	"purpose" text NOT NULL,
	"context" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "evidence_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"concept_id" text NOT NULL,
	"activity_ref" text NOT NULL,
	"submission_version_id" uuid,
	"evidence_type" text NOT NULL,
	"source" text NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assistance" text DEFAULT 'none' NOT NULL,
	"review_status" text DEFAULT 'provisional' NOT NULL,
	"interpretation" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_run_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"learner_note" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "learning_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"enrolment_id" uuid NOT NULL,
	"unit_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"session_kind" text NOT NULL,
	"scheduled_session_id" uuid,
	"status" text DEFAULT 'open' NOT NULL,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"sender" text NOT NULL,
	"persona_id" text,
	"content_markdown" text NOT NULL,
	"citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"uncited_claims" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "misconception_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"concept_id" text NOT NULL,
	"claim" text NOT NULL,
	"evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cleared_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notebook_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"body_markdown" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT 'note' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"course_id" text,
	"unit_id" text,
	"resolved" boolean DEFAULT false NOT NULL,
	"tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce("notebook_entry"."title", '') || ' ' || coalesce("notebook_entry"."body_markdown", ''))) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_artifact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"description" text NOT NULL,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revision_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"concept_id" text NOT NULL,
	"kind" text NOT NULL,
	"prompt" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"interval_days" integer DEFAULT 2 NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content_markdown" text NOT NULL,
	"content_kind" text DEFAULT 'text' NOT NULL,
	"transcription" jsonb,
	"assistance_disclosed" jsonb DEFAULT '{"hintsUsed":0,"peersConsulted":false,"externalSources":[]}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discussion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"society_id" text,
	"learning_session_id" uuid,
	"participant_persona_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"max_rounds" integer DEFAULT 3 NOT NULL,
	"rounds_used" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"released_material" jsonb DEFAULT '{"unitIds":[],"locatorIds":[],"exerciseIds":[]}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "discussion_turn" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discussion_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"speaker" text NOT NULL,
	"content_markdown" text NOT NULL,
	"labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "peer_membership" (
	"owner_id" text NOT NULL,
	"persona_id" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"muted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "peer_membership_owner_id_persona_id_pk" PRIMARY KEY("owner_id","persona_id")
);
--> statement-breakpoint
CREATE TABLE "persona" (
	"id" text PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"title" text NOT NULL,
	"department_id" text,
	"style" jsonb NOT NULL,
	"introduction" text NOT NULL,
	"avatar_key" text NOT NULL,
	"prompt_key" text NOT NULL,
	"is_peer" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persona_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"persona_id" text NOT NULL,
	"kind" text NOT NULL,
	"content" text NOT NULL,
	"provenance" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "society" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"department_id" text,
	"cadence" text NOT NULL,
	"chair_persona_id" text
);
--> statement-breakpoint
CREATE TABLE "app_setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "export_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"storage_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "job_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text,
	"kind" text NOT NULL,
	"queue" text NOT NULL,
	"pgboss_job_id" text,
	"idempotency_key" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"progress" jsonb DEFAULT '{"stage":"queued"}'::jsonb NOT NULL,
	"payload" jsonb NOT NULL,
	"result" jsonb,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "job_record_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "provider_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text,
	"role" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"purpose" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cache_read_tokens" integer DEFAULT 0 NOT NULL,
	"cache_write_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"pricing_version" text NOT NULL,
	"prompt_version" text NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_setting" ADD CONSTRAINT "budget_setting_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_record" ADD CONSTRAINT "consent_record_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_pairing" ADD CONSTRAINT "device_pairing_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_concept_override" ADD CONSTRAINT "learner_concept_override_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_profile" ADD CONSTRAINT "learner_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairing_code" ADD CONSTRAINT "pairing_code_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_setting" ADD CONSTRAINT "provider_setting_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept" ADD CONSTRAINT "concept_department_id_department_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."department"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course" ADD CONSTRAINT "course_primary_department_id_department_id_fk" FOREIGN KEY ("primary_department_id") REFERENCES "public"."department"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_department" ADD CONSTRAINT "course_department_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_department" ADD CONSTRAINT "course_department_department_id_department_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."department"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_version" ADD CONSTRAINT "course_version_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructor_artifact" ADD CONSTRAINT "instructor_artifact_unit_id_teaching_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."teaching_unit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructor_artifact" ADD CONSTRAINT "instructor_artifact_exercise_id_unit_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."unit_exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prerequisite_rule" ADD CONSTRAINT "prerequisite_rule_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaching_unit" ADD CONSTRAINT "teaching_unit_course_version_id_course_version_id_fk" FOREIGN KEY ("course_version_id") REFERENCES "public"."course_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_exercise" ADD CONSTRAINT "unit_exercise_unit_id_teaching_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."teaching_unit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annotation" ADD CONSTRAINT "annotation_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annotation" ADD CONSTRAINT "annotation_asset_id_resource_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."resource_asset"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annotation" ADD CONSTRAINT "annotation_source_version_id_source_version_id_fk" FOREIGN KEY ("source_version_id") REFERENCES "public"."source_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_page" ADD CONSTRAINT "extracted_page_asset_id_resource_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."resource_asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locator" ADD CONSTRAINT "locator_source_version_id_source_version_id_fk" FOREIGN KEY ("source_version_id") REFERENCES "public"."source_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passage" ADD CONSTRAINT "passage_asset_id_resource_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."resource_asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passage" ADD CONSTRAINT "passage_page_id_extracted_page_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."extracted_page"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_permission" ADD CONSTRAINT "processing_permission_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_permission" ADD CONSTRAINT "processing_permission_asset_id_resource_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."resource_asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_permission" ADD CONSTRAINT "processing_permission_source_version_id_source_version_id_fk" FOREIGN KEY ("source_version_id") REFERENCES "public"."source_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_asset" ADD CONSTRAINT "resource_asset_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_asset" ADD CONSTRAINT "resource_asset_source_version_id_source_version_id_fk" FOREIGN KEY ("source_version_id") REFERENCES "public"."source_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_asset" ADD CONSTRAINT "resource_asset_device_pairing_id_device_pairing_id_fk" FOREIGN KEY ("device_pairing_id") REFERENCES "public"."device_pairing"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_request" ADD CONSTRAINT "resource_request_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_request" ADD CONSTRAINT "resource_request_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_version" ADD CONSTRAINT "source_version_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_window" ADD CONSTRAINT "availability_window_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_token" ADD CONSTRAINT "calendar_token_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_proposal" ADD CONSTRAINT "change_proposal_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commitment" ADD CONSTRAINT "commitment_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_off" ADD CONSTRAINT "day_off_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrolment" ADD CONSTRAINT "enrolment_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrolment" ADD CONSTRAINT "enrolment_term_id_term_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."term"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrolment" ADD CONSTRAINT "enrolment_course_version_id_course_version_id_fk" FOREIGN KEY ("course_version_id") REFERENCES "public"."course_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_version" ADD CONSTRAINT "plan_version_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_version" ADD CONSTRAINT "plan_version_term_id_term_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."term"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_session" ADD CONSTRAINT "scheduled_session_plan_version_id_plan_version_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "public"."plan_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_session" ADD CONSTRAINT "scheduled_session_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_session" ADD CONSTRAINT "scheduled_session_enrolment_id_enrolment_id_fk" FOREIGN KEY ("enrolment_id") REFERENCES "public"."enrolment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_session" ADD CONSTRAINT "scheduled_session_unit_id_teaching_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."teaching_unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "term" ADD CONSTRAINT "term_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_run" ADD CONSTRAINT "assessment_run_submission_version_id_submission_version_id_fk" FOREIGN KEY ("submission_version_id") REFERENCES "public"."submission_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt" ADD CONSTRAINT "attempt_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt" ADD CONSTRAINT "attempt_exercise_id_unit_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."unit_exercise"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt" ADD CONSTRAINT "attempt_learning_session_id_learning_session_id_fk" FOREIGN KEY ("learning_session_id") REFERENCES "public"."learning_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_state" ADD CONSTRAINT "concept_state_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_state" ADD CONSTRAINT "concept_state_concept_id_concept_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concept"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_learning_session_id_learning_session_id_fk" FOREIGN KEY ("learning_session_id") REFERENCES "public"."learning_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_event" ADD CONSTRAINT "evidence_event_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_event" ADD CONSTRAINT "evidence_event_concept_id_concept_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concept"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_event" ADD CONSTRAINT "evidence_event_submission_version_id_submission_version_id_fk" FOREIGN KEY ("submission_version_id") REFERENCES "public"."submission_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_review" ADD CONSTRAINT "feedback_review_assessment_run_id_assessment_run_id_fk" FOREIGN KEY ("assessment_run_id") REFERENCES "public"."assessment_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_session" ADD CONSTRAINT "learning_session_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_session" ADD CONSTRAINT "learning_session_enrolment_id_enrolment_id_fk" FOREIGN KEY ("enrolment_id") REFERENCES "public"."enrolment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_session" ADD CONSTRAINT "learning_session_unit_id_teaching_unit_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."teaching_unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_session" ADD CONSTRAINT "learning_session_scheduled_session_id_scheduled_session_id_fk" FOREIGN KEY ("scheduled_session_id") REFERENCES "public"."scheduled_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "misconception_record" ADD CONSTRAINT "misconception_record_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "misconception_record" ADD CONSTRAINT "misconception_record_concept_id_concept_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concept"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notebook_entry" ADD CONSTRAINT "notebook_entry_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notebook_entry" ADD CONSTRAINT "notebook_entry_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_artifact" ADD CONSTRAINT "portfolio_artifact_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_item" ADD CONSTRAINT "revision_item_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_item" ADD CONSTRAINT "revision_item_concept_id_concept_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concept"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_version" ADD CONSTRAINT "submission_version_attempt_id_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion" ADD CONSTRAINT "discussion_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion" ADD CONSTRAINT "discussion_society_id_society_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."society"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion" ADD CONSTRAINT "discussion_learning_session_id_learning_session_id_fk" FOREIGN KEY ("learning_session_id") REFERENCES "public"."learning_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_turn" ADD CONSTRAINT "discussion_turn_discussion_id_discussion_id_fk" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussion"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peer_membership" ADD CONSTRAINT "peer_membership_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peer_membership" ADD CONSTRAINT "peer_membership_persona_id_persona_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."persona"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona" ADD CONSTRAINT "persona_department_id_department_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."department"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona_memory" ADD CONSTRAINT "persona_memory_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona_memory" ADD CONSTRAINT "persona_memory_persona_id_persona_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."persona"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "society" ADD CONSTRAINT "society_department_id_department_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."department"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "society" ADD CONSTRAINT "society_chair_persona_id_persona_id_fk" FOREIGN KEY ("chair_persona_id") REFERENCES "public"."persona"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_record" ADD CONSTRAINT "export_record_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_record" ADD CONSTRAINT "job_record_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_run" ADD CONSTRAINT "provider_run_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "consent_user_kind_idx" ON "consent_record" USING btree ("user_id","kind");--> statement-breakpoint
CREATE INDEX "device_pairing_user_idx" ON "device_pairing" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "concept_override_user_idx" ON "learner_concept_override" USING btree ("user_id","concept_id");--> statement-breakpoint
CREATE INDEX "concept_department_idx" ON "concept" USING btree ("department_id");--> statement-breakpoint
CREATE UNIQUE INDEX "course_version_unique" ON "course_version" USING btree ("course_id","version");--> statement-breakpoint
CREATE INDEX "course_version_current_idx" ON "course_version" USING btree ("course_id","is_current");--> statement-breakpoint
CREATE INDEX "instructor_artifact_unit_idx" ON "instructor_artifact" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "prereq_course_idx" ON "prerequisite_rule" USING btree ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teaching_unit_sequence_unique" ON "teaching_unit" USING btree ("course_version_id","sequence");--> statement-breakpoint
CREATE INDEX "unit_exercise_unit_idx" ON "unit_exercise" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "annotation_owner_asset_idx" ON "annotation" USING btree ("owner_id","asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "extracted_page_asset_index_unique" ON "extracted_page" USING btree ("asset_id","physical_index");--> statement-breakpoint
CREATE INDEX "extracted_page_tsv_idx" ON "extracted_page" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "locator_source_version_idx" ON "locator" USING btree ("source_version_id");--> statement-breakpoint
CREATE INDEX "passage_asset_idx" ON "passage" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "passage_tsv_idx" ON "passage" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "processing_permission_asset_idx" ON "processing_permission" USING btree ("asset_id","action");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_asset_owner_sha_unique" ON "resource_asset" USING btree ("owner_id","sha256");--> statement-breakpoint
CREATE INDEX "resource_asset_owner_idx" ON "resource_asset" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "resource_request_owner_idx" ON "resource_request" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "source_version_source_idx" ON "source_version" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "availability_owner_idx" ON "availability_window" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "calendar_token_owner_idx" ON "calendar_token" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "change_proposal_owner_idx" ON "change_proposal" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "commitment_owner_idx" ON "commitment" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "day_off_owner_date_unique" ON "day_off" USING btree ("owner_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "enrolment_owner_course_version_unique" ON "enrolment" USING btree ("owner_id","course_version_id");--> statement-breakpoint
CREATE INDEX "enrolment_owner_status_idx" ON "enrolment" USING btree ("owner_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_version_unique" ON "plan_version" USING btree ("term_id","version");--> statement-breakpoint
CREATE INDEX "scheduled_session_owner_time_idx" ON "scheduled_session" USING btree ("owner_id","starts_at");--> statement-breakpoint
CREATE INDEX "scheduled_session_plan_idx" ON "scheduled_session" USING btree ("plan_version_id");--> statement-breakpoint
CREATE INDEX "term_owner_idx" ON "term" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "assessment_run_submission_idx" ON "assessment_run" USING btree ("submission_version_id");--> statement-breakpoint
CREATE INDEX "attempt_owner_exercise_idx" ON "attempt" USING btree ("owner_id","exercise_id");--> statement-breakpoint
CREATE INDEX "conversation_owner_idx" ON "conversation" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "conversation_session_idx" ON "conversation" USING btree ("learning_session_id");--> statement-breakpoint
CREATE INDEX "evidence_owner_concept_idx" ON "evidence_event" USING btree ("owner_id","concept_id");--> statement-breakpoint
CREATE INDEX "feedback_review_run_idx" ON "feedback_review" USING btree ("assessment_run_id");--> statement-breakpoint
CREATE INDEX "learning_session_owner_idx" ON "learning_session" USING btree ("owner_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "message_conversation_sequence_unique" ON "message" USING btree ("conversation_id","sequence");--> statement-breakpoint
CREATE INDEX "misconception_owner_idx" ON "misconception_record" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "notebook_owner_idx" ON "notebook_entry" USING btree ("owner_id","kind");--> statement-breakpoint
CREATE INDEX "notebook_tsv_idx" ON "notebook_entry" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "portfolio_owner_idx" ON "portfolio_artifact" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "revision_owner_due_idx" ON "revision_item" USING btree ("owner_id","due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_version_unique" ON "submission_version" USING btree ("attempt_id","version");--> statement-breakpoint
CREATE INDEX "discussion_owner_idx" ON "discussion" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "discussion_turn_discussion_idx" ON "discussion_turn" USING btree ("discussion_id","sequence");--> statement-breakpoint
CREATE INDEX "persona_memory_owner_idx" ON "persona_memory" USING btree ("owner_id","persona_id");--> statement-breakpoint
CREATE INDEX "audit_owner_time_idx" ON "audit_event" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "export_owner_idx" ON "export_record" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "job_record_owner_idx" ON "job_record" USING btree ("owner_id","status");--> statement-breakpoint
CREATE INDEX "job_record_kind_idx" ON "job_record" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "provider_run_owner_time_idx" ON "provider_run" USING btree ("owner_id","created_at");