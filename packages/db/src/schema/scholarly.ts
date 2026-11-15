import type { IdentifierScheme, LicenceSource } from "@corniversity/core/scholarly/index";
import { type SQL, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgSchema,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { IntegrityNotice, ScholarlyAuthor, ScholarlyField, ScholarlySource, ScholarlySubject } from "../scholarly/types";
import { createdAt, tsvector, tz, updatedAt } from "./_shared";
import { user } from "./auth";

/**
 * The research library (contract docs/RESEARCH_LIBRARY.md §3). Works, their identifiers and
 * versions are owned by one account; parents carry UNIQUE (id, owner_id) and children reference
 * them with composite foreign keys, so a row can never point at another owner's row. Everything a
 * provider reported keeps its provider and retrieval time; nothing here is verified by opening.
 * Text columns carry TypeScript unions (and CHECK constraints) rather than new enums.
 */

export type AbstractSource = "openalex" | "arxiv" | "crossref" | "owner";
export type WorkMetadataStatus = "resolved" | "unidentified";
export type WorkFieldSource = ScholarlySource | "owner";
/** Per-field provenance of a work: who reported the value and when (`owner` for the owner's edits). */
export type WorkProvenance = Partial<Record<ScholarlyField, { source: WorkFieldSource; retrievedAt: string }>>;
export type IdentifierStatus = "current" | "superseded";
export type ScholarlyVersionKind = "preprint" | "accepted" | "published" | "unknown";
export type CollectionKind = "shelf" | "trail";

export const scholarlyWork = pgTable(
  "scholarly_work",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Null until a provider reports one (an arXiv import before its record arrives). */
    title: text("title"),
    authors: jsonb("authors").$type<ScholarlyAuthor[]>().notNull().default([]),
    abstract: text("abstract"),
    abstractSource: text("abstract_source").$type<AbstractSource>(),
    publicationYear: integer("publication_year"),
    /** Only a real day; OpenAlex's YYYY-01-01 placeholders are stored as a year alone. */
    publicationDate: date("publication_date", { mode: "string" }),
    publicationDatePrecision: text("publication_date_precision").$type<"day" | "year">(),
    venue: text("venue"),
    /** As the provider reported it. */
    workType: text("work_type"),
    /** As classified by OpenAlex. */
    subjects: jsonb("subjects").$type<ScholarlySubject[]>().notNull().default([]),
    provenance: jsonb("provenance").$type<WorkProvenance>().notNull().default({}),
    /** Fields the owner edited; a refresh never overwrites them. */
    ownerEditedFields: text("owner_edited_fields").array().$type<ScholarlyField[]>().notNull().default(sql`'{}'::text[]`),
    integrityNotices: jsonb("integrity_notices").$type<IntegrityNotice[]>().notNull().default([]),
    integrityCheckedAt: tz("integrity_checked_at"),
    /** OpenAlex ids (CC0) of the works this one references, as OpenAlex matched them. */
    referencedOpenalexIds: text("referenced_openalex_ids").array().notNull().default(sql`'{}'::text[]`),
    referencesRetrievedAt: tz("references_retrieved_at"),
    metadataStatus: text("metadata_status").$type<WorkMetadataStatus>().notNull().default("resolved"),
    /** Tombstone: the work this one was merged into by the owner. */
    mergedIntoId: uuid("merged_into_id"),
    savedAt: tz("saved_at"),
    favourite: boolean("favourite").notNull().default(false),
    readLater: boolean("read_later").notNull().default(false),
    readAt: tz("read_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    tsv: tsvector("tsv").generatedAlwaysAs(
      (): SQL =>
        sql`to_tsvector('english', coalesce(${scholarlyWork.title}, '') || ' ' || coalesce(${scholarlyWork.abstract}, '') || ' ' || coalesce(jsonb_path_query_array(${scholarlyWork.authors}, '$[*].name')::text, ''))`,
    ),
  },
  (t) => [
    unique("scholarly_work_id_owner_unique").on(t.id, t.ownerId),
    index("scholarly_work_owner_saved_idx").on(t.ownerId, t.savedAt),
    index("scholarly_work_merged_idx").on(t.ownerId, t.mergedIntoId),
    index("scholarly_work_tsv_idx").using("gin", t.tsv),
    foreignKey({
      name: "scholarly_work_merged_into_fk",
      columns: [t.mergedIntoId, t.ownerId],
      foreignColumns: [t.id, t.ownerId],
    }),
    check("scholarly_work_not_merged_into_self", sql`${t.mergedIntoId} is null or ${t.mergedIntoId} <> ${t.id}`),
    check(
      "scholarly_work_abstract_source_check",
      sql`${t.abstractSource} is null or ${t.abstractSource} in ('openalex', 'arxiv', 'crossref', 'owner')`,
    ),
    check(
      "scholarly_work_date_precision_check",
      sql`${t.publicationDatePrecision} is null or ${t.publicationDatePrecision} in ('day', 'year')`,
    ),
    check("scholarly_work_metadata_status_check", sql`${t.metadataStatus} in ('resolved', 'unidentified')`),
  ],
);

export const scholarlyIdentifier = pgTable(
  "scholarly_identifier",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workId: uuid("work_id").notNull(),
    scheme: text("scheme").$type<IdentifierScheme>().notNull(),
    /** Normalised: DOI lower-case without prefix; arXiv id without version; OpenAlex W…. */
    value: text("value").notNull(),
    /** Who reported it: a provider, `fixture`, or `owner`. */
    source: text("source").$type<WorkFieldSource>().notNull(),
    retrievedAt: tz("retrieved_at").notNull().defaultNow(),
    status: text("status").$type<IdentifierStatus>().notNull().default("current"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("scholarly_identifier_owner_scheme_value_unique").on(t.ownerId, t.scheme, t.value),
    index("scholarly_identifier_work_idx").on(t.ownerId, t.workId),
    foreignKey({
      name: "scholarly_identifier_work_fk",
      columns: [t.workId, t.ownerId],
      foreignColumns: [scholarlyWork.id, scholarlyWork.ownerId],
    }).onDelete("cascade"),
    check("scholarly_identifier_scheme_check", sql`${t.scheme} in ('doi', 'arxiv', 'openalex', 'pmid', 'pmcid')`),
    check("scholarly_identifier_status_check", sql`${t.status} in ('current', 'superseded')`),
  ],
);

export const scholarlyVersion = pgTable(
  "scholarly_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workId: uuid("work_id").notNull(),
    kind: text("kind").$type<ScholarlyVersionKind>().notNull().default("unknown"),
    /** "arXiv v7", "Published version", "Your copy". */
    label: text("label").notNull(),
    arxivId: text("arxiv_id"),
    arxivVersion: integer("arxiv_version"),
    doi: text("doi"),
    versionDate: tz("version_date"),
    landingUrl: text("landing_url"),
    /** Licence fields are written once, while this version is the current one in an arXivRaw record. */
    licence: text("licence"),
    licenceUrl: text("licence_url"),
    licenceSource: text("licence_source").$type<LicenceSource>(),
    licenceRetrievedAt: tz("licence_retrieved_at"),
    withdrawn: boolean("withdrawn").notNull().default(false),
    source: text("source").$type<WorkFieldSource>().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("scholarly_version_id_owner_unique").on(t.id, t.ownerId),
    uniqueIndex("scholarly_version_arxiv_unique").on(t.ownerId, t.arxivId, t.arxivVersion).where(sql`${t.arxivId} is not null`),
    index("scholarly_version_work_idx").on(t.ownerId, t.workId),
    foreignKey({
      name: "scholarly_version_work_fk",
      columns: [t.workId, t.ownerId],
      foreignColumns: [scholarlyWork.id, scholarlyWork.ownerId],
    }),
    check("scholarly_version_arxiv_pair_check", sql`(${t.arxivId} is null) = (${t.arxivVersion} is null)`),
    check("scholarly_version_arxiv_version_check", sql`${t.arxivVersion} is null or ${t.arxivVersion} > 0`),
    check("scholarly_version_kind_check", sql`${t.kind} in ('preprint', 'accepted', 'published', 'unknown')`),
    check(
      "scholarly_version_licence_source_check",
      sql`${t.licenceSource} is null or ${t.licenceSource} in ('arxiv-oai', 'openalex', 'crossref', 'owner')`,
    ),
    check("scholarly_version_landing_https_check", sql`${t.landingUrl} is null or ${t.landingUrl} like 'https://%'`),
  ],
);

/** Shelves and trails: one table, two kinds (a trail is an ordered shelf with a reason per step). */
export const libraryCollection = pgTable(
  "library_collection",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").$type<CollectionKind>().notNull(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("library_collection_id_owner_unique").on(t.id, t.ownerId),
    uniqueIndex("library_collection_owner_kind_name_unique").on(t.ownerId, t.kind, sql`lower(${t.name})`),
    check("library_collection_kind_check", sql`${t.kind} in ('shelf', 'trail')`),
  ],
);

export const libraryCollectionItem = pgTable(
  "library_collection_item",
  {
    collectionId: uuid("collection_id").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workId: uuid("work_id").notNull(),
    position: integer("position").notNull(),
    /** A trail step's "why"; a shelf's optional note. */
    reason: text("reason"),
    addedAt: timestamp("added_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.collectionId, t.workId] }),
    index("library_collection_item_work_idx").on(t.ownerId, t.workId),
    foreignKey({
      name: "library_collection_item_collection_fk",
      columns: [t.collectionId, t.ownerId],
      foreignColumns: [libraryCollection.id, libraryCollection.ownerId],
    }).onDelete("cascade"),
    foreignKey({
      name: "library_collection_item_work_fk",
      columns: [t.workId, t.ownerId],
      foreignColumns: [scholarlyWork.id, scholarlyWork.ownerId],
    }).onDelete("restrict"),
  ],
);

/** The owner's subjects for Discover (no row: the default four). */
export const libraryPreference = pgTable("library_preference", {
  ownerId: text("owner_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  subjects: text("subjects").array().notNull(),
  updatedAt: updatedAt(),
});

/**
 * Provider responses (contract §3, §5). Kept in their own schema, which backups never read: the
 * cache is rebuilt from the providers, holds no owner id and no raw query (the key is the sha256 of
 * the canonical request without credentials). Only 200 and 404 responses are written.
 */
export const scholarlyCacheSchema = pgSchema("scholarly_cache");

export const providerCache = scholarlyCacheSchema.table(
  "provider_cache",
  {
    key: text("key").primaryKey(),
    provider: text("provider").$type<"openalex" | "arxiv" | "crossref">().notNull(),
    status: integer("status").notNull(),
    payload: jsonb("payload").$type<{ contentType: string | null; body: string }>().notNull(),
    fetchedAt: tz("fetched_at").notNull(),
    expiresAt: tz("expires_at").notNull(),
  },
  (t) => [
    index("provider_cache_expires_idx").on(t.expiresAt),
    check("provider_cache_status_check", sql`${t.status} in (200, 404)`),
    check("provider_cache_provider_check", sql`${t.provider} in ('openalex', 'arxiv', 'crossref')`),
  ],
);
