CREATE SCHEMA "scholarly_cache";
--> statement-breakpoint
CREATE TABLE "library_collection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "library_collection_id_owner_unique" UNIQUE("id","owner_id"),
	CONSTRAINT "library_collection_kind_check" CHECK ("library_collection"."kind" in ('shelf', 'trail'))
);
--> statement-breakpoint
CREATE TABLE "library_collection_item" (
	"collection_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"work_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"reason" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "library_collection_item_collection_id_work_id_pk" PRIMARY KEY("collection_id","work_id")
);
--> statement-breakpoint
CREATE TABLE "library_preference" (
	"owner_id" text PRIMARY KEY NOT NULL,
	"subjects" text[] NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scholarly_cache"."provider_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"status" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "provider_cache_status_check" CHECK ("scholarly_cache"."provider_cache"."status" in (200, 404)),
	CONSTRAINT "provider_cache_provider_check" CHECK ("scholarly_cache"."provider_cache"."provider" in ('openalex', 'arxiv', 'crossref'))
);
--> statement-breakpoint
CREATE TABLE "scholarly_identifier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"work_id" uuid NOT NULL,
	"scheme" text NOT NULL,
	"value" text NOT NULL,
	"source" text NOT NULL,
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'current' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scholarly_identifier_scheme_check" CHECK ("scholarly_identifier"."scheme" in ('doi', 'arxiv', 'openalex', 'pmid', 'pmcid')),
	CONSTRAINT "scholarly_identifier_status_check" CHECK ("scholarly_identifier"."status" in ('current', 'superseded'))
);
--> statement-breakpoint
CREATE TABLE "scholarly_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"work_id" uuid NOT NULL,
	"kind" text DEFAULT 'unknown' NOT NULL,
	"label" text NOT NULL,
	"arxiv_id" text,
	"arxiv_version" integer,
	"doi" text,
	"version_date" timestamp with time zone,
	"landing_url" text,
	"licence" text,
	"licence_url" text,
	"licence_source" text,
	"licence_retrieved_at" timestamp with time zone,
	"withdrawn" boolean DEFAULT false NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scholarly_version_id_owner_unique" UNIQUE("id","owner_id"),
	CONSTRAINT "scholarly_version_arxiv_pair_check" CHECK (("scholarly_version"."arxiv_id" is null) = ("scholarly_version"."arxiv_version" is null)),
	CONSTRAINT "scholarly_version_arxiv_version_check" CHECK ("scholarly_version"."arxiv_version" is null or "scholarly_version"."arxiv_version" > 0),
	CONSTRAINT "scholarly_version_kind_check" CHECK ("scholarly_version"."kind" in ('preprint', 'accepted', 'published', 'unknown')),
	CONSTRAINT "scholarly_version_licence_source_check" CHECK ("scholarly_version"."licence_source" is null or "scholarly_version"."licence_source" in ('arxiv-oai', 'openalex', 'crossref', 'owner')),
	CONSTRAINT "scholarly_version_landing_https_check" CHECK ("scholarly_version"."landing_url" is null or "scholarly_version"."landing_url" like 'https://%')
);
--> statement-breakpoint
CREATE TABLE "scholarly_work" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"title" text,
	"authors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"abstract" text,
	"abstract_source" text,
	"publication_year" integer,
	"publication_date" date,
	"publication_date_precision" text,
	"venue" text,
	"work_type" text,
	"subjects" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provenance" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"owner_edited_fields" text[] DEFAULT '{}'::text[] NOT NULL,
	"integrity_notices" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"integrity_checked_at" timestamp with time zone,
	"referenced_openalex_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"references_retrieved_at" timestamp with time zone,
	"metadata_status" text DEFAULT 'resolved' NOT NULL,
	"merged_into_id" uuid,
	"saved_at" timestamp with time zone,
	"favourite" boolean DEFAULT false NOT NULL,
	"read_later" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce("scholarly_work"."title", '') || ' ' || coalesce("scholarly_work"."abstract", '') || ' ' || coalesce(jsonb_path_query_array("scholarly_work"."authors", '$[*].name')::text, ''))) STORED,
	CONSTRAINT "scholarly_work_id_owner_unique" UNIQUE("id","owner_id"),
	CONSTRAINT "scholarly_work_not_merged_into_self" CHECK ("scholarly_work"."merged_into_id" is null or "scholarly_work"."merged_into_id" <> "scholarly_work"."id"),
	CONSTRAINT "scholarly_work_abstract_source_check" CHECK ("scholarly_work"."abstract_source" is null or "scholarly_work"."abstract_source" in ('openalex', 'arxiv', 'crossref', 'owner')),
	CONSTRAINT "scholarly_work_date_precision_check" CHECK ("scholarly_work"."publication_date_precision" is null or "scholarly_work"."publication_date_precision" in ('day', 'year')),
	CONSTRAINT "scholarly_work_metadata_status_check" CHECK ("scholarly_work"."metadata_status" in ('resolved', 'unidentified'))
);
--> statement-breakpoint
ALTER TABLE "notebook_entry" ADD COLUMN "scholarly_work_id" uuid;--> statement-breakpoint
ALTER TABLE "annotation" ADD COLUMN "kind" text DEFAULT 'note' NOT NULL;--> statement-breakpoint
ALTER TABLE "annotation" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "annotation" ADD COLUMN "anchor" jsonb;--> statement-breakpoint
ALTER TABLE "annotation" ADD COLUMN "quote_matched" boolean;--> statement-breakpoint
ALTER TABLE "annotation" ADD COLUMN "tsv" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce("annotation"."note_markdown", '') || ' ' || coalesce("annotation"."selected_text", ''))) STORED;--> statement-breakpoint
ALTER TABLE "reading_progress" ADD COLUMN "position" jsonb;--> statement-breakpoint
ALTER TABLE "reading_progress" ADD COLUMN "last_opened_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reading_progress" ADD COLUMN "effective_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "resource_asset" ADD COLUMN "scholarly_version_id" uuid;--> statement-breakpoint
ALTER TABLE "resource_asset" ADD COLUMN "observed_sha256" text;--> statement-breakpoint
ALTER TABLE "resource_asset" ADD COLUMN "observed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "library_collection" ADD CONSTRAINT "library_collection_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_collection_item" ADD CONSTRAINT "library_collection_item_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_collection_item" ADD CONSTRAINT "library_collection_item_collection_fk" FOREIGN KEY ("collection_id","owner_id") REFERENCES "public"."library_collection"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_collection_item" ADD CONSTRAINT "library_collection_item_work_fk" FOREIGN KEY ("work_id","owner_id") REFERENCES "public"."scholarly_work"("id","owner_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_preference" ADD CONSTRAINT "library_preference_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarly_identifier" ADD CONSTRAINT "scholarly_identifier_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarly_identifier" ADD CONSTRAINT "scholarly_identifier_work_fk" FOREIGN KEY ("work_id","owner_id") REFERENCES "public"."scholarly_work"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarly_version" ADD CONSTRAINT "scholarly_version_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarly_version" ADD CONSTRAINT "scholarly_version_work_fk" FOREIGN KEY ("work_id","owner_id") REFERENCES "public"."scholarly_work"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarly_work" ADD CONSTRAINT "scholarly_work_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarly_work" ADD CONSTRAINT "scholarly_work_merged_into_fk" FOREIGN KEY ("merged_into_id","owner_id") REFERENCES "public"."scholarly_work"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "library_collection_owner_kind_name_unique" ON "library_collection" USING btree ("owner_id","kind",lower("name"));--> statement-breakpoint
CREATE INDEX "library_collection_item_work_idx" ON "library_collection_item" USING btree ("owner_id","work_id");--> statement-breakpoint
CREATE INDEX "provider_cache_expires_idx" ON "scholarly_cache"."provider_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "scholarly_identifier_owner_scheme_value_unique" ON "scholarly_identifier" USING btree ("owner_id","scheme","value");--> statement-breakpoint
CREATE INDEX "scholarly_identifier_work_idx" ON "scholarly_identifier" USING btree ("owner_id","work_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scholarly_version_arxiv_unique" ON "scholarly_version" USING btree ("owner_id","arxiv_id","arxiv_version") WHERE "scholarly_version"."arxiv_id" is not null;--> statement-breakpoint
CREATE INDEX "scholarly_version_work_idx" ON "scholarly_version" USING btree ("owner_id","work_id");--> statement-breakpoint
CREATE INDEX "scholarly_work_owner_saved_idx" ON "scholarly_work" USING btree ("owner_id","saved_at");--> statement-breakpoint
CREATE INDEX "scholarly_work_merged_idx" ON "scholarly_work" USING btree ("owner_id","merged_into_id");--> statement-breakpoint
CREATE INDEX "scholarly_work_tsv_idx" ON "scholarly_work" USING gin ("tsv");--> statement-breakpoint
ALTER TABLE "notebook_entry" ADD CONSTRAINT "notebook_entry_scholarly_work_id_scholarly_work_id_fk" FOREIGN KEY ("scholarly_work_id") REFERENCES "public"."scholarly_work"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notebook_entry" ADD CONSTRAINT "notebook_entry_scholarly_work_owner_fk" FOREIGN KEY ("scholarly_work_id","owner_id") REFERENCES "public"."scholarly_work"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annotation" ADD CONSTRAINT "annotation_notebook_entry_id_notebook_entry_id_fk" FOREIGN KEY ("notebook_entry_id") REFERENCES "public"."notebook_entry"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_asset" ADD CONSTRAINT "resource_asset_scholarly_version_fk" FOREIGN KEY ("scholarly_version_id","owner_id") REFERENCES "public"."scholarly_version"("id","owner_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notebook_owner_work_idx" ON "notebook_entry" USING btree ("owner_id","scholarly_work_id");--> statement-breakpoint
CREATE INDEX "annotation_owner_kind_idx" ON "annotation" USING btree ("owner_id","kind");--> statement-breakpoint
CREATE INDEX "annotation_tsv_idx" ON "annotation" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "resource_asset_scholarly_version_idx" ON "resource_asset" USING btree ("owner_id","scholarly_version_id");--> statement-breakpoint
ALTER TABLE "annotation" ADD CONSTRAINT "annotation_kind_check" CHECK ("annotation"."kind" in ('note', 'highlight', 'bookmark'));--> statement-breakpoint
ALTER TABLE "resource_asset" ADD CONSTRAINT "resource_asset_linked_remote_check" CHECK ("resource_asset"."status" <> 'linked_remote' or ("resource_asset"."storage_key" is null and "resource_asset"."local_only" = false and "resource_asset"."scholarly_version_id" is not null and "resource_asset"."sha256" like 'arxiv:%'));