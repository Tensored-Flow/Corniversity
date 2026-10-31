CREATE TABLE "reading_progress" (
	"owner_id" text NOT NULL,
	"asset_id" uuid NOT NULL,
	"physical_index" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reading_progress_owner_id_asset_id_pk" PRIMARY KEY("owner_id","asset_id")
);
--> statement-breakpoint
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_asset_id_resource_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."resource_asset"("id") ON DELETE cascade ON UPDATE no action;