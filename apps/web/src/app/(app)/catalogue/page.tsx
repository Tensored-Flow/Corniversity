import { listCatalogue, listDepartments } from "@corniversity/db/services/catalogue";
import { listEnrolments } from "@corniversity/db/services/enrolment";
import Link from "next/link";
import { Badge, Button, Notice } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { takeCourseAction } from "../courses/[id]/actions";

export const metadata = { title: "Catalogue" };

const select = "rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2 py-1.5";

/** Every course, the ones with something to study first; take any number straight from the list. */
export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ department?: string; level?: string; all?: string }>;
}) {
  const session = await requireSession("/catalogue");
  const params = await searchParams;
  const departments = await listDepartments(db());
  const unknownDepartment = params.department && !departments.some((d) => d.id === params.department) ? params.department : null;
  const [entries, enrolments] = await Promise.all([
    listCatalogue(db(), { departmentId: unknownDepartment ? undefined : params.department }),
    listEnrolments(db(), session.user.id),
  ]);
  const taking = new Set(enrolments.filter((e) => e.enrolment.status !== "withdrawn").map((e) => e.course.id));
  const studyable = entries.filter((e) => e.readyUnitCount > 0).length;
  const shown = entries
    .filter((e) => (params.level ? e.course.level === params.level : true))
    .filter((e) => (params.all === "1" ? true : e.readyUnitCount > 0))
    .sort((a, b) => b.readyUnitCount - a.readyUnitCount || a.course.id.localeCompare(b.course.id));

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-5">
        <h1 className="text-3xl text-ink">Catalogue</h1>
        <p className="mt-1 text-sm text-ink-2">
          {studyable} of {entries.length} courses have units ready. Take as many as you like.
        </p>
      </header>
      {unknownDepartment ? (
        <div className="mb-4">
          <Notice tone="rust">No department “{unknownDepartment}”; showing all.</Notice>
        </div>
      ) : null}

      <form className="mb-5 flex flex-wrap items-end gap-3 text-sm" method="get">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink-3">Department</span>
          <select name="department" defaultValue={params.department ?? ""} className={select}>
            <option value="">All</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink-3">Level</span>
          <select name="level" defaultValue={params.level ?? ""} className={select}>
            <option value="">Any</option>
            <option value="bridge">Bridge</option>
            <option value="foundation">Foundation</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="graduate">Graduate</option>
          </select>
        </label>
        <label className="flex items-center gap-2 pb-1.5">
          <input type="checkbox" name="all" value="1" defaultChecked={params.all === "1"} className="accent-[var(--brass)]" />
          Include courses with nothing ready
        </label>
        <button type="submit" className="rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-3 py-1.5 hover:bg-paper-3">
          Filter
        </button>
      </form>

      <ul className="flex flex-col divide-y divide-stone rounded-[var(--radius-panel)] border border-stone bg-paper-2">
        {shown.map((e) => (
          <li key={e.course.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
            <div className="min-w-0 flex-1">
              <Link href={`/courses/${e.course.id}`} className="text-ink underline-offset-4 hover:underline">
                {e.course.title}
              </Link>
              <span className="ml-2 font-mono text-xs text-ink-3">{e.course.id}</span>
              <p className="line-clamp-1 text-sm text-ink-2">{e.version.purpose}</p>
            </div>
            <span className="text-xs text-ink-3">
              {e.unitCount > 0 ? `${e.readyUnitCount}/${e.unitCount} units ready` : "no units yet"}
            </span>
            {taking.has(e.course.id) ? (
              <Badge tone="moss">taking</Badge>
            ) : e.readyUnitCount > 0 ? (
              <form action={takeCourseAction}>
                <input type="hidden" name="courseId" value={e.course.id} />
                <input type="hidden" name="from" value="catalogue" />
                <Button type="submit" variant="secondary">
                  Take
                </Button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      {shown.length === 0 ? <p className="mt-3 text-sm text-ink-2">No courses match.</p> : null}
      <p className="mt-4 text-sm text-ink-3">
        Missing a subject?{" "}
        <Link href="/proposals" className="text-brass underline underline-offset-4">
          Propose one
        </Link>
      </p>
    </div>
  );
}
