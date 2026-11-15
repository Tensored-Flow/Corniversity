import type { Anchor, Locator, ReadingPosition } from "@corniversity/core";
import { type SQL, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { bytea, createdAt, permissionStatusEnum, processingActionEnum, tsvector, tz, updatedAt } from "./_shared";
import { course } from "./academic";
import { user } from "./auth";
import { devicePairing } from "./learner";
import { notebookEntry } from "./learning";
import { scholarlyVersion } from "./scholarly";

export const source = pgTable("source", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  authors: jsonb("authors").$type<string[]>().notNull().default([]),
  institution: text("institution"),
  kind: text("kind").notNull(),
  canonicalUrl: text("canonical_url").notNull(),
  description: text("description"),
  isbn: text("isbn"),
  codeLicence: text("code_licence"),
  rightsNotes: jsonb("rights_notes").$type<string[]>().notNull().default([]),
  currentVersionId: text("current_version_id").notNull(),
});

export const sourceVersion = pgTable(
  "source_version",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id")
      .notNull()
      .references(() => source.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    url: text("url").notNull(),
    verifiedAt: date("verified_at", { mode: "string" }).notNull(),
    verifiedBy: text("verified_by").notNull(),
    componentsSeen: jsonb("components_seen").$type<string[]>().notNull().default([]),
    licence: text("licence").notNull(),
    licenceUrl: text("licence_url"),
    accessStatus: text("access_status").notNull(),
    importAllowed: boolean("import_allowed").notNull().default(false),
    importHosts: jsonb("import_hosts").$type<string[]>().notNull().default([]),
    limitations: jsonb("limitations").$type<string[]>().notNull().default([]),
    isCurrent: boolean("is_current").notNull().default(true),
  },
  (t) => [index("source_version_source_idx").on(t.sourceId)],
);

export const locator = pgTable(
  "locator",
  {
    id: text("id").primaryKey(),
    sourceVersionId: text("source_version_id")
      .notNull()
      .references(() => sourceVersion.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    payload: jsonb("payload").$type<Locator>().notNull(),
    label: text("label").notNull(),
    verifiedAt: date("verified_at", { mode: "string" }).notNull(),
    note: text("note"),
  },
  (t) => [index("locator_source_version_idx").on(t.sourceVersionId)],
);

export type AssetStatus =
  | "registered_local" // known to exist on the desktop; nothing but bibliographic metadata has left it
  | "upload_requested" // owner permitted cloud storage; waiting for the companion to send bytes
  | "quarantined" // bytes received, not yet validated
  | "validated"
  | "processing"
  | "processed"
  | "rejected"
  | "deleted"
  // A paper read by the owner's browser from arxiv.org: no bytes stored, sha256 holds arxiv:{id}v{n}.
  | "linked_remote";

export type AssetOrigin = "web_upload" | "companion" | "open_import" | "arxiv_link" | "scholarly_upload" | "scholarly_import";

export const resourceAsset = pgTable(
  "resource_asset",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sourceVersionId: text("source_version_id").references(() => sourceVersion.id),
    filename: text("filename").notNull(),
    mediaType: text("media_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    sha256: text("sha256").notNull(),
    storageKey: text("storage_key"),
    status: text("status").$type<AssetStatus>().notNull(),
    origin: text("origin").$type<AssetOrigin>().notNull(),
    candidateMetadata: jsonb("candidate_metadata")
      .$type<{ title?: string; author?: string; pageCount?: number; producer?: string }>()
      .notNull()
      .default({}),
    confirmedTitle: text("confirmed_title"),
    confirmedAuthors: jsonb("confirmed_authors").$type<string[]>(),
    confirmedEdition: text("confirmed_edition"),
    pageCount: integer("page_count"),
    printedLabelsPresent: boolean("printed_labels_present"),
    courseIds: jsonb("course_ids").$type<string[]>().notNull().default([]),
    localOnly: boolean("local_only").notNull().default(true),
    devicePairingId: uuid("device_pairing_id").references(() => devicePairing.id),
    localPathHint: text("local_path_hint"),
    rejectionReason: text("rejection_reason"),
    /** The scholarly version this Document is a file of (research library). */
    scholarlyVersionId: uuid("scholarly_version_id"),
    /** Linked Documents: the sha256 of the bytes the owner's browser last received (a drift detector, not an identity). */
    observedSha256: text("observed_sha256"),
    observedAt: tz("observed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: tz("deleted_at"),
  },
  (t) => [
    uniqueIndex("resource_asset_owner_sha_unique").on(t.ownerId, t.sha256),
    index("resource_asset_owner_idx").on(t.ownerId, t.status),
    index("resource_asset_scholarly_version_idx").on(t.ownerId, t.scholarlyVersionId),
    foreignKey({
      name: "resource_asset_scholarly_version_fk",
      columns: [t.scholarlyVersionId, t.ownerId],
      foreignColumns: [scholarlyVersion.id, scholarlyVersion.ownerId],
    }).onDelete("restrict"),
    check(
      "resource_asset_linked_remote_check",
      sql`${t.status} <> 'linked_remote' or (${t.storageKey} is null and ${t.localOnly} = false and ${t.scholarlyVersionId} is not null and ${t.sha256} like 'arxiv:%')`,
    ),
  ],
);

export const assetBlob = pgTable("asset_blob", {
  storageKey: text("storage_key").primaryKey(),
  data: bytea("data").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  createdAt: createdAt(),
});

export const processingPermission = pgTable(
  "processing_permission",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id").references(() => resourceAsset.id, { onDelete: "cascade" }),
    sourceVersionId: text("source_version_id").references(() => sourceVersion.id),
    action: processingActionEnum("action").notNull(),
    status: permissionStatusEnum("status").notNull(),
    basis: text("basis").notNull(),
    recordedAt: createdAt(),
    revokedAt: tz("revoked_at"),
  },
  (t) => [index("processing_permission_asset_idx").on(t.assetId, t.action)],
);

export const extractedPage = pgTable(
  "extracted_page",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => resourceAsset.id, { onDelete: "cascade" }),
    physicalIndex: integer("physical_index").notNull(),
    printedLabel: text("printed_label"),
    text: text("text").notNull(),
    charCount: integer("char_count").notNull(),
    quality: jsonb("quality")
      .$type<{ scannedSuspected: boolean; lowText: boolean; invisibleText: number; imageCoverage: number }>()
      .notNull(),
    tsv: tsvector("tsv").generatedAlwaysAs((): SQL => sql`to_tsvector('english', coalesce(${extractedPage.text}, ''))`),
  },
  (t) => [
    uniqueIndex("extracted_page_asset_index_unique").on(t.assetId, t.physicalIndex),
    index("extracted_page_tsv_idx").using("gin", t.tsv),
  ],
);

export const passage = pgTable(
  "passage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => resourceAsset.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => extractedPage.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    heading: text("heading"),
    kind: text("kind").$type<"paragraph" | "theorem" | "definition" | "exercise" | "proof" | "other">().notNull().default("paragraph"),
    text: text("text").notNull(),
    tsv: tsvector("tsv").generatedAlwaysAs((): SQL => sql`to_tsvector('english', coalesce(${passage.text}, ''))`),
  },
  (t) => [index("passage_asset_idx").on(t.assetId), index("passage_tsv_idx").using("gin", t.tsv)],
);

export const annotation = pgTable(
  "annotation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id").references(() => resourceAsset.id, { onDelete: "set null" }),
    sourceVersionId: text("source_version_id").references(() => sourceVersion.id),
    locator: jsonb("locator").$type<Locator>().notNull(),
    selectedText: text("selected_text"),
    noteMarkdown: text("note_markdown").notNull().default(""),
    mappingStatus: text("mapping_status").$type<"resolved" | "needs_repair">().notNull().default("resolved"),
    notebookEntryId: uuid("notebook_entry_id").references(() => notebookEntry.id, { onDelete: "set null" }),
    kind: text("kind").$type<AnnotationKind>().notNull().default("note"),
    /** A colour-role name (brass, moss, rust, slate, neutral). */
    color: text("color"),
    /** Rects in PDF user space; the server fills documentSha256 and engine. */
    anchor: jsonb("anchor").$type<Anchor>(),
    /** Whether the kept quote was found on the extracted page; null when nothing was compared. */
    quoteMatched: boolean("quote_matched"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    tsv: tsvector("tsv").generatedAlwaysAs(
      (): SQL => sql`to_tsvector('english', coalesce(${annotation.noteMarkdown}, '') || ' ' || coalesce(${annotation.selectedText}, ''))`,
    ),
  },
  (t) => [
    index("annotation_owner_asset_idx").on(t.ownerId, t.assetId),
    index("annotation_owner_kind_idx").on(t.ownerId, t.kind),
    index("annotation_tsv_idx").using("gin", t.tsv),
    check("annotation_kind_check", sql`${t.kind} in ('note', 'highlight', 'bookmark')`),
  ],
);

export type AnnotationKind = "note" | "highlight" | "bookmark";

/** Where the learner last was in each library item; one row per owner and asset. */
export const readingProgress = pgTable(
  "reading_progress",
  {
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => resourceAsset.id, { onDelete: "cascade" }),
    physicalIndex: integer("physical_index").notNull().default(0),
    /** Position inside the page in PDF user space; pageIndex always equals physical_index. */
    position: jsonb("position").$type<ReadingPosition>(),
    lastOpenedAt: tz("last_opened_at"),
    /** Server-clock time the saved position stands for (now − how long ago the reader last moved). */
    effectiveAt: tz("effective_at"),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.ownerId, t.assetId] })],
);

export const resourceRequest = pgTable(
  "resource_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    courseId: text("course_id").references(() => course.id),
    unitIds: jsonb("unit_ids").$type<string[]>().notNull().default([]),
    title: text("title").notNull(),
    authors: text("authors"),
    edition: text("edition"),
    isbn: text("isbn"),
    why: text("why").notNull(),
    essential: boolean("essential").notNull().default(false),
    chaptersNeeded: jsonb("chapters_needed").$type<string[]>().notNull().default([]),
    links: jsonb("links").$type<{ label: string; url: string }[]>().notNull().default([]),
    openAlternative: text("open_alternative"),
    acceptedFormats: jsonb("accepted_formats").$type<string[]>().notNull().default(["pdf"]),
    destinationFolder: text("destination_folder").notNull(),
    caveats: text("caveats"),
    minPermission: text("min_permission").notNull().default("local_read"),
    status: text("status").$type<"open" | "obtained" | "declined">().notNull().default("open"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("resource_request_owner_idx").on(t.ownerId, t.status)],
);
