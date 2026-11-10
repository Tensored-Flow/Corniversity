import { integer, jsonb, pgTable, real, text } from "drizzle-orm/pg-core";
import { tz, updatedAt } from "./_shared";

/**
 * A visual explanation seeded from `content/visuals`: its storyboard, the results of its numerical
 * checks, and, when one was recorded from this exact storyboard, a short film in the private blob
 * store. A film made from an older storyboard is not stored as current (`film_*` stay empty).
 */
export const visualExplanation = pgTable("visual_explanation", {
  slug: text("slug").primaryKey(),
  title: text("title").notNull(),
  origin: text("origin").$type<"original" | "external" | "ai_assisted_draft">().notNull(),
  status: text("status").$type<"draft" | "checked" | "published">().notNull(),
  /** The storyboard's own version number, as authored. */
  specVersion: integer("spec_version").notNull(),
  unitIds: jsonb("unit_ids").$type<string[]>().notNull(),
  revealsExerciseIds: jsonb("reveals_exercise_ids").$type<string[]>().notNull().default([]),
  /** The parsed storyboard (scenes, equations, plots, checks) with its render record, if any. */
  spec: jsonb("spec").$type<Record<string, unknown>>().notNull(),
  storyboardHash: text("storyboard_hash").notNull(),
  checkResults: jsonb("check_results").$type<{ id: string; passed: boolean; detail: string }[]>().notNull(),
  filmBlobKey: text("film_blob_key"),
  filmSha256: text("film_sha256"),
  filmBytes: integer("film_bytes"),
  filmDurationSeconds: real("film_duration_seconds"),
  filmRenderedAt: tz("film_rendered_at"),
  filmTool: text("film_tool"),
  /** Set when a film exists in content but was made from an older storyboard. */
  filmStale: text("film_stale"),
  contentHash: text("content_hash").notNull(),
  /** Bumped each time the seeded content changes. */
  version: integer("version").notNull().default(1),
  updatedAt: updatedAt(),
});
