ALTER TABLE "provider_setting" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "provider_setting" ADD COLUMN "refusal_fallback" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_setting" ADD COLUMN "paid_use_approval" jsonb;--> statement-breakpoint
ALTER TABLE "provider_run" ADD COLUMN "attempts" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "provider_run" ADD COLUMN "worst_case_usd" numeric(12, 6);