ALTER TABLE "provider_setting" ADD COLUMN "plan_model" text;--> statement-breakpoint
ALTER TABLE "provider_setting" ADD COLUMN "plan_daily_requests" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_setting" ADD COLUMN "plan_monthly_requests" integer DEFAULT 300 NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_setting" ADD COLUMN "plan_use_approval" jsonb;--> statement-breakpoint
ALTER TABLE "provider_setting" ADD COLUMN "plan_paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "provider_setting" ADD COLUMN "plan_pause_reason" text;