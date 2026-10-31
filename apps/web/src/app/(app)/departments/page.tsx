import { listCatalogue, listDepartments } from "@corniversity/db/services/catalogue";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

export const metadata = { title: "Departments" };

export default async function DepartmentsPage() {
  await requireSession("/departments");
  const [departments, entries] = await Promise.all([listDepartments(db()), listCatalogue(db())]);
  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-6">
        <p className="text-sm uppercase tracking-[0.18em] text-brass">Departments</p>
        <h1 className="mt-1 text-3xl text-ink">Six departments</h1>
      </header>
      <ul className="grid gap-4 md:grid-cols-2">
        {departments.map((d) => {
          const mine = entries.filter((e) => e.departments.includes(d.id));
          const ready = mine.filter((e) => e.version.readiness === "teaching_ready").length;
          return (
            <li key={d.id}>
              <Link
                href={`/departments/${d.id}`}
                className="block rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-5 hover:border-stone-2"
              >
                <h2 className="text-xl text-ink">{d.title}</h2>
                <p className="mt-2 line-clamp-3 text-sm text-ink-2">{d.identity}</p>
                <p className="mt-3 text-xs text-ink-3">
                  {mine.length} courses in the catalogue · {ready} with prepared teaching
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
