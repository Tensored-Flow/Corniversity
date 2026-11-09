import { getDepartment, listCatalogue, listPersonas } from "@corniversity/db/services/catalogue";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AiLabel } from "@/components/AiLabel";
import { ReadinessBadge } from "@/components/Readiness";
import { Card } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";

export default async function DepartmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSession(`/departments/${id}`);
  const dept = await getDepartment(db(), id);
  if (!dept) notFound();
  const [entries, personas] = await Promise.all([listCatalogue(db(), { departmentId: id }), listPersonas(db())]);
  const faculty = personas.filter((p) => dept.facultyPersonaIds.includes(p.id));
  const byId = new Map(entries.map((e) => [e.course.id, e]));

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-8">
        <p className="text-sm uppercase tracking-[0.18em] text-brass">Department</p>
        <h1 className="mt-1 text-3xl text-ink">{dept.title}</h1>
        <p className="prose-reading mt-4 text-ink-2">{dept.identity}</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <section aria-labelledby="paths">
          <h2 id="paths" className="text-xl text-ink">
            Paths
          </h2>
          <div className="mt-4 flex flex-col gap-5">
            {dept.paths.map((path) => (
              <Card key={path.title}>
                <h3 className="text-lg text-ink">{path.title}</h3>
                <ol className="mt-3 flex flex-col gap-2">
                  {path.courseIds.map((cid) => {
                    const e = byId.get(cid);
                    return (
                      <li key={cid} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-mono text-xs text-ink-3">{cid}</span>
                        {e ? (
                          <>
                            <Link href={`/courses/${cid}`} className="text-ink underline-offset-4 hover:underline">
                              {e.course.title}
                            </Link>
                            <ReadinessBadge readiness={e.version.readiness} />
                          </>
                        ) : (
                          <span className="text-ink-3">not in the catalogue</span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </Card>
            ))}
          </div>
        </section>

        <aside className="flex flex-col gap-6">
          <Card as="aside">
            <h2 className="text-lg text-ink">Faculty</h2>
            <ul className="mt-3 flex flex-col gap-4">
              {faculty.map((p) => (
                <li key={p.id}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{p.name}</span>
                    <AiLabel kind={p.title} />
                  </div>
                  <p className="mt-1 text-sm text-ink-2">{p.style.approach}</p>
                </li>
              ))}
              {faculty.length === 0 ? <li className="text-sm text-ink-3">No faculty assigned yet.</li> : null}
            </ul>
          </Card>
          <Card as="aside">
            <h2 className="text-lg text-ink">Conventions</h2>
            <ul className="mt-3 list-disc pl-5 text-sm text-ink-2">
              {dept.conventions.map((c) => (
                <li key={c} className="mb-1">
                  {c}
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
