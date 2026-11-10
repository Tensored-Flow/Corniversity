import { listPersonas } from "@corniversity/db/services/catalogue";
import { listDiscussions, listPeers, listSocieties, releasedMaterial, socialLayerEnabled } from "@corniversity/db/services/community";
import { ensureProfile } from "@corniversity/db/services/onboarding";
import Link from "next/link";
import { AiLabel } from "@/components/AiLabel";
import { Badge, Button, Card, Field, Input, Notice, Select } from "@/components/ui";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { openDiscussionAction, setPeerMembershipAction } from "./actions";

export const metadata = { title: "Common Room" };

/**
 * The common room: societies chaired by faculty, optional labelled AI classmates, office hours,
 * and the learner's bounded discussions. Nothing happens here while the learner is away: a
 * discussion only advances when the learner writes a turn, stops at its round limit, and never
 * reaches beyond material the learner has opened.
 */
export default async function CommonRoomPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await requireSession("/common-room");
  const { error } = await searchParams;
  const database = db();
  const ownerId = session.user.id;
  const [profile, societies, peers, discussions, personas, released, social] = await Promise.all([
    ensureProfile(database, ownerId),
    listSocieties(database),
    listPeers(database, ownerId),
    listDiscussions(database, ownerId),
    listPersonas(database),
    releasedMaterial(database, ownerId),
    socialLayerEnabled(database, ownerId),
  ]);
  const faculty = personas.filter((p) => !p.isPeer && p.role !== "assessor" && p.role !== "librarian");
  const activePeers = peers.filter((p) => p.enabled && !p.muted);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-6">
        <p className="text-sm uppercase tracking-[0.18em] text-brass">Common Room</p>
        <h1 className="mt-1 text-3xl text-ink">Societies, classmates and office hours</h1>
        <p className="mt-2 max-w-prose text-sm text-ink-2">
          Every person here is an AI persona and is labelled so. Discussions are bounded: a few rounds, only material you have opened (
          {released.unitTitles.length} unit{released.unitTitles.length === 1 ? "" : "s"} so far), an explicit stop. Nothing is generated
          while you are away.
        </p>
      </header>
      {error ? (
        <div className="mb-4">
          <Notice tone="rust">{error}</Notice>
        </div>
      ) : null}
      {!social ? (
        <div className="mb-6">
          <Notice tone="neutral" title={profile.immersion === "quiet" ? "Quiet mode" : "Social layer off"}>
            AI classmates do not join discussions while{" "}
            {profile.immersion === "quiet" ? "you are in quiet mode" : "the social layer is off"}. Office hours with faculty remain
            available below, and every academic function is unchanged. Change this in{" "}
            <Link href="/settings" className="text-brass underline underline-offset-4">
              Settings
            </Link>
            .
          </Notice>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <section aria-labelledby="societies-heading">
            <h2 id="societies-heading" className="text-xl text-ink">
              Societies
            </h2>
            <ul className="mt-3 grid gap-4 md:grid-cols-2">
              {societies.map((s) => (
                <Card key={s.id} as="li">
                  <h3 className="text-lg text-ink">{s.title}</h3>
                  <p className="mt-1 text-sm text-ink-2">{s.description}</p>
                  <p className="mt-2 text-xs text-ink-3">{s.cadence}</p>
                  {s.chair ? (
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink">
                      Chair: {s.chair.name} <AiLabel kind={s.chair.title} />
                    </p>
                  ) : null}
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-brass">Open a discussion</summary>
                    <form action={openDiscussionAction} className="mt-2 flex flex-col gap-3">
                      <input type="hidden" name="kind" value="society" />
                      <input type="hidden" name="societyId" value={s.id} />
                      <input type="hidden" name="chairPersonaId" value={s.chairPersonaId ?? ""} />
                      <Field
                        label="What do you want to discuss?"
                        htmlFor={`title-${s.id}`}
                        hint="A question, a passage or a result from material you have opened."
                      >
                        <Input id={`title-${s.id}`} name="title" required maxLength={200} />
                      </Field>
                      <Field label="Rounds" htmlFor={`rounds-${s.id}`}>
                        <Select id={`rounds-${s.id}`} name="rounds" defaultValue="3">
                          {[1, 2, 3, 4, 5, 6].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      {social && activePeers.length ? (
                        <fieldset>
                          <legend className="text-sm font-medium text-ink">Classmates to invite (AI; at most two)</legend>
                          <div className="mt-1 flex flex-wrap gap-3">
                            {activePeers.map((p) => (
                              <label key={p.persona.id} className="flex items-center gap-2 text-sm text-ink">
                                <input type="checkbox" name="peers" value={p.persona.id} /> {p.persona.name}
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      ) : null}
                      <div>
                        <Button type="submit" variant="secondary">
                          Open
                        </Button>
                      </div>
                    </form>
                  </details>
                </Card>
              ))}
            </ul>
          </section>

          <section aria-labelledby="discussions-heading">
            <h2 id="discussions-heading" className="text-xl text-ink">
              Your discussions
            </h2>
            {discussions.length === 0 ? (
              <p className="mt-2 text-sm text-ink-3">None yet.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {discussions.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-panel)] border border-stone bg-paper-2 px-4 py-3 text-sm"
                  >
                    <div>
                      <Link href={`/common-room/${d.id}`} className="text-ink hover:underline">
                        {d.title}
                      </Link>
                      <p className="text-xs text-ink-3">
                        {d.kind.replace("_", " ")} · {d.participantPersonaIds.length} AI participant
                        {d.participantPersonaIds.length === 1 ? "" : "s"} · round {Math.min(d.roundsUsed, d.maxRounds)} of {d.maxRounds}
                      </p>
                    </div>
                    <Badge tone={d.status === "open" ? "moss" : d.status === "muted" ? "neutral" : "brass"}>{d.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <Card as="section" aria-labelledby="peers-heading">
            <h2 id="peers-heading" className="text-lg text-ink">
              Classmates
            </h2>
            <p className="mt-1 text-xs text-ink-3">
              Optional, labelled AI. Each has a distinct way of reasoning; none has access to solutions or to your record. Mute one and it
              never speaks again until you unmute it.
            </p>
            <ul className="mt-3 flex flex-col gap-3">
              {peers.map((p) => (
                <li key={p.persona.id} className="border-t border-stone pt-2 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">{p.persona.name}</span>
                    <AiLabel kind="classmate" />
                    {!p.enabled ? <Badge tone="neutral">off</Badge> : p.muted ? <Badge tone="neutral">muted</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-ink-2">{p.persona.style.approach}</p>
                  <div className="mt-2 flex gap-2">
                    <form action={setPeerMembershipAction}>
                      <input type="hidden" name="personaId" value={p.persona.id} />
                      <input type="hidden" name="field" value="enabled" />
                      <input type="hidden" name="value" value={p.enabled ? "0" : "1"} />
                      <Button type="submit" variant="quiet">
                        {p.enabled ? "Turn off" : "Turn on"}
                      </Button>
                    </form>
                    <form action={setPeerMembershipAction}>
                      <input type="hidden" name="personaId" value={p.persona.id} />
                      <input type="hidden" name="field" value="muted" />
                      <input type="hidden" name="value" value={p.muted ? "0" : "1"} />
                      <Button type="submit" variant="quiet">
                        {p.muted ? "Unmute" : "Mute"}
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card as="section" aria-labelledby="office-heading">
            <h2 id="office-heading" className="text-lg text-ink">
              Office hours
            </h2>
            <p className="mt-1 text-xs text-ink-3">
              A bounded conversation with one member of faculty about material you have opened. Available in every mode.
            </p>
            <form action={openDiscussionAction} className="mt-3 flex flex-col gap-3">
              <input type="hidden" name="kind" value="office_hours" />
              <Field label="With" htmlFor="office-persona">
                <Select id="office-persona" name="chairPersonaId" defaultValue={faculty[0]?.id ?? ""}>
                  {faculty.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="About" htmlFor="office-title">
                <Input id="office-title" name="title" required maxLength={200} />
              </Field>
              <input type="hidden" name="rounds" value="3" />
              <div>
                <Button type="submit" variant="secondary">
                  Open office hours
                </Button>
              </div>
            </form>
          </Card>
        </aside>
      </div>
    </div>
  );
}
