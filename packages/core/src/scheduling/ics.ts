import { DateTime } from "luxon";
import type { ScheduledSessionPlan } from "./types";

/**
 * RFC 5545 export. Times are emitted in UTC (the Z form), which every calendar client handles
 * without a VTIMEZONE block and which is unambiguous across daylight-saving changes. UIDs are the
 * stable session uids, so re-importing an updated file updates events instead of duplicating.
 * A static file is a snapshot; only a subscription URL keeps updating, and we say so in the UI.
 */
export interface IcsOptions {
  calendarName: string;
  productId?: string;
  baseUrl?: string; // for URL properties
  detail: "minimal" | "full";
  dtstamp?: string; // ISO; defaults to now (tests pass a fixed value)
}

export function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds a content line at 75 octets with CRLF + space continuation. */
export function foldIcsLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const ch of line) {
    const len = Buffer.byteLength(ch, "utf8");
    const limit = out.length === 0 ? 75 : 74;
    if (currentBytes + len > limit) {
      out.push(current);
      current = ch;
      currentBytes = len;
    } else {
      current += ch;
      currentBytes += len;
    }
  }
  if (current) out.push(current);
  return out.join("\r\n ");
}

function utc(iso: string): string {
  return DateTime.fromISO(iso, { zone: "utc" }).toFormat("yyyyLLdd'T'HHmmss'Z'");
}

export function buildIcs(sessions: ScheduledSessionPlan[], options: IcsOptions): string {
  const stamp = utc(options.dtstamp ?? new Date().toISOString());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${options.productId ?? "-//Corniversity//Timetable//EN"}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(options.calendarName)}`,
  ];
  const sorted = [...sessions].sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.uid.localeCompare(b.uid));
  for (const s of sorted) {
    const summary = options.detail === "full" ? `${s.courseId} · ${s.title}` : `Corniversity study session`;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${escapeIcsText(s.uid)}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART:${utc(s.startsAt)}`);
    lines.push(`DTEND:${utc(s.endsAt)}`);
    lines.push(`SUMMARY:${escapeIcsText(summary)}`);
    if (options.detail === "full") {
      lines.push(`DESCRIPTION:${escapeIcsText(`${s.sessionKind.replace("_", " ")} for unit ${s.unitId}`)}`);
      if (options.baseUrl) lines.push(`URL:${options.baseUrl}/courses/${s.courseId}/units/${s.unitId}`);
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}
