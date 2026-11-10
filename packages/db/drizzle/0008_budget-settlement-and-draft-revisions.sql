ALTER TABLE "attempt" ADD COLUMN "draft_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "attempt" ADD COLUMN "draft_saved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "provider_run" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "provider_run" ADD COLUMN "parent_run_id" uuid;--> statement-breakpoint
ALTER TABLE "provider_run" ADD COLUMN "settlement" jsonb;--> statement-breakpoint
CREATE INDEX "provider_run_status_idx" ON "provider_run" USING btree ("status");--> statement-breakpoint
ALTER TABLE "provider_run" ADD CONSTRAINT "provider_run_idempotency_key_unique" UNIQUE("idempotency_key");