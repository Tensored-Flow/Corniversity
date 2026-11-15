"use client";
import { LINKED_SELECTION_LABEL, MAX_COMPANION_TEXT_CHARS } from "@corniversity/core/scholarly/companion";
import Link from "next/link";
import { type FormEvent, useActionState, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { RenderedHtml } from "@/components/RenderedHtml";
import {
  ACTION_CHOICES,
  type AskActions,
  type AskPanelData,
  type AskSelection,
  type AskStore,
  answerContext,
  answerNotes,
  type CompanionAnswerView,
  type PermissionFormState,
  parseEvidenceHeader,
  permissionScope,
  refusalFrom,
  sentDescription,
  textFieldFor,
} from "./ask";

const control =
  "inline-flex items-center justify-center rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-2.5 py-1 text-sm text-ink hover:bg-paper-3 disabled:cursor-not-allowed disabled:opacity-50";
const primary =
  "inline-flex items-center justify-center rounded-[var(--radius-control)] border border-transparent bg-brass px-3 py-1 text-sm font-medium text-paper-2 hover:bg-brass-strong disabled:cursor-not-allowed disabled:opacity-60";
const danger =
  "inline-flex items-center justify-center rounded-[var(--radius-control)] border border-rust bg-paper-2 px-2.5 py-1 text-sm text-rust hover:bg-rust-soft disabled:cursor-not-allowed disabled:opacity-50";
// At least 24 px high, so a finger can hit it on a phone (WCAG 2.5.8).
const quiet = "inline-flex min-h-6 items-center text-sm text-brass underline-offset-4 hover:underline";
const field = "w-full rounded-[var(--radius-control)] border border-stone-2 bg-paper px-2 py-1.5 text-sm text-ink";
const meta = "text-[0.7rem] uppercase tracking-wide text-ink-3";

export interface AskPanelProps {
  data: AskPanelData;
  store: AskStore;
  actions: AskActions;
  /** The 0-based page in view (the Text view's page). */
  pageIndex: number;
  /** The bytes the reader loaded (a linked Document's file), once known. */
  loadedSha256: string | null;
  /**
   * `captured`: the selection the selection bar's Ask handed over (Page view); `live`: the passage
   * currently selected in the page text (Text view), shown above the panel.
   */
  selectionSource: "captured" | "live";
  liveSelection?: AskSelection | null;
}

const pageName = (index: number) => `page ${index + 1}`;
/** The reader keeps at most this much of a selection (page-dom.ts readSelection). */
const SELECTION_QUOTE_LIMIT = 2000;

/**
 * The reading companion's Ask panel (contract §8): closed until the owner opens it, and nothing is
 * sent until they press Send. When external AI is not allowed for this Document it explains that and
 * offers the owner's own decision (licence shown, basis recorded). Otherwise: the selection, one
 * action, the owner's words, what will be sent, and the single streamed answer, labelled by what
 * produced it, with its checked citations and what was sent. Every refusal shows the server's
 * registered sentence, and a refused run its reason.
 */
export function AskPanel(props: AskPanelProps) {
  const { data, store } = props;
  const state = useSyncExternalStore(store.subscribe, store.get, store.get);
  const id = useId();
  const firstControl = useRef<HTMLInputElement>(null);
  const [announce, setAnnounce] = useState("");
  // Sending needs the page's script: until it runs (and without JavaScript) Send stays disabled, so the
  // form never submits itself as a page navigation.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  // A selection handed over by the selection bar moves keyboard focus into the panel, once.
  useEffect(() => {
    if (!state.focusRequested) return;
    store.set({ focusRequested: false });
    firstControl.current?.focus();
  }, [state.focusRequested, store]);

  const selection = props.selectionSource === "live" ? (props.liveSelection ?? null) : state.selection;
  const askPage = selection?.pageIndex ?? props.pageIndex;
  const fieldSpec = textFieldFor(state.action);
  const allowed = state.permission.status === "allowed";

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (store.get().pending) return;
    const current = store.get();
    const linked = data.kind === "linked";
    store.set({ pending: true, streamed: "", refusal: null });
    setAnnounce("Asking…");
    let response: Response;
    try {
      response = await fetch("/api/library/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          assetId: data.assetId,
          action: current.action,
          pageIndex: linked ? (selection?.pageIndex ?? null) : askPage,
          selection: selection?.text ?? "",
          text: current.text,
          loadedSha256: linked ? props.loadedSha256 : null,
        }),
      });
    } catch {
      store.set({
        pending: false,
        refusal: { message: "The server could not be reached, so nothing was sent. Try again.", reason: null, settings: false },
      });
      setAnnounce("Not sent.");
      return;
    }
    if (!response.ok || !response.body) {
      store.set({ pending: false, refusal: refusalFrom(response.status, await response.json().catch(() => null)) });
      setAnnounce("Refused.");
      return;
    }
    const evidence = parseEvidenceHeader(response.headers.get("x-companion-evidence"));
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let streamed = "";
    for (;;) {
      const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true as const }));
      if (done) break;
      streamed += decoder.decode(value, { stream: true });
      store.set({ streamed });
    }
    // The reply is stored before the stream ends; show the stored version, with its checked citations.
    const answer: CompanionAnswerView | null = await props.actions.latestAnswer(data.assetId).catch(() => null);
    store.set({
      pending: false,
      streamed: answer ? "" : streamed,
      answer: answer ?? current.answer,
      text: "",
      sent: { action: current.action, evidence, selection: selection?.text ?? null },
    });
    setAnnounce("Answer ready.");
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-col gap-1">
        <p>
          <span className="inline-flex items-center rounded-full border border-stone bg-paper-3 px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-wide text-ink-2">
            {data.aiLabel.text}
          </span>
        </p>
        {/* Shown, not left in a tooltip: who answers (and why a live model is blocked) must not need a pointer. */}
        <p className="text-xs text-ink-3">{data.aiLabel.title}</p>
        <p className="text-ink-3">Optional. Nothing is sent until you press Send.</p>
      </div>

      {data.stateRefusal ? (
        <p role="status" className="rounded-[var(--radius-control)] border border-stone bg-paper-3 px-2 py-1.5 text-ink-2">
          {data.stateRefusal}
        </p>
      ) : (
        <>
          <Permission data={data} store={store} actions={props.actions} status={state.permission} />

          {allowed ? (
            <form onSubmit={send} className="flex flex-col gap-3" aria-describedby={`${id}-sent`}>
              <section aria-labelledby={`${id}-selection`} className="flex flex-col gap-1">
                <h3 id={`${id}-selection`} className="text-sm font-medium text-ink">
                  Selection
                </h3>
                {props.selectionSource === "live" ? (
                  <p className="text-ink-2">
                    {selection
                      ? `Uses the selected passage above (${selection.text.length} characters).`
                      : "Nothing selected: select text in the page to ask about it, or ask about this page."}
                  </p>
                ) : selection ? (
                  <>
                    <p className="text-ink-3">On {pageName(selection.pageIndex)}:</p>
                    <blockquote className="max-h-32 overflow-y-auto border-l-2 border-brass pl-3 text-ink-2">{selection.text}</blockquote>
                    {selection.text.length >= SELECTION_QUOTE_LIMIT ? (
                      <p className="text-xs text-ink-3">The reader keeps the first 2,000 characters of a selection; only those are sent.</p>
                    ) : null}
                    {data.kind === "linked" ? <p className="text-xs text-ink-3">{LINKED_SELECTION_LABEL}.</p> : null}
                    <div>
                      <button type="button" className={quiet} onClick={() => store.set({ selection: null, refusal: null })}>
                        Clear selection
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-ink-2">
                    {data.kind === "linked"
                      ? "Nothing selected. For a paper read from arXiv the companion sees only text you select: select it in the pages, then choose Ask in the selection bar."
                      : "Nothing selected. Select text in the pages and choose Ask in the selection bar, or ask about the page in view."}
                  </p>
                )}
              </section>

              <fieldset className="flex flex-col gap-1">
                <legend className="text-sm font-medium text-ink">Action</legend>
                {ACTION_CHOICES.map((choice) => (
                  <label key={choice.action} className="flex min-h-6 items-center gap-2 text-ink">
                    <input
                      ref={state.action === choice.action ? firstControl : undefined}
                      type="radio"
                      name={`${id}-action`}
                      value={choice.action}
                      checked={state.action === choice.action}
                      onChange={() => store.set({ action: choice.action, refusal: null })}
                    />
                    {choice.label}
                  </label>
                ))}
              </fieldset>

              <div className="flex flex-col gap-1">
                <label htmlFor={`${id}-text`} className="text-sm font-medium text-ink">
                  {fieldSpec.label}
                </label>
                <textarea
                  id={`${id}-text`}
                  value={state.text}
                  onChange={(event) => store.set({ text: event.target.value })}
                  rows={3}
                  maxLength={MAX_COMPANION_TEXT_CHARS}
                  aria-describedby={fieldSpec.hint ? `${id}-hint` : undefined}
                  className={field}
                />
                {fieldSpec.hint ? (
                  <p id={`${id}-hint`} className="text-xs text-ink-3">
                    {fieldSpec.hint}
                  </p>
                ) : null}
              </div>

              <p id={`${id}-sent`} className="text-xs text-ink-3">
                {sentDescription({
                  kind: data.kind,
                  action: state.action,
                  hasSelection: Boolean(selection?.text.trim()),
                  pageLabel: pageName(askPage),
                })}
              </p>
              <div>
                {/* While sending, Send keeps keyboard focus: aria-disabled, not disabled (send() ignores a second press). */}
                <button
                  type="submit"
                  className={`${primary} aria-disabled:cursor-not-allowed aria-disabled:opacity-60`}
                  disabled={!ready}
                  aria-disabled={state.pending || undefined}
                >
                  {state.pending ? "Sending…" : "Send"}
                </button>
              </div>
              <noscript>
                <p className="text-xs text-ink-3">Asking needs JavaScript; the rest of the reader works without it.</p>
              </noscript>
            </form>
          ) : null}

          {state.refusal ? (
            <div role="alert" className="rounded-[var(--radius-control)] border border-rust/30 bg-rust-soft px-2 py-1.5 text-rust">
              <p>{state.refusal.message}</p>
              {state.refusal.reason ? <p className="mt-1">Reason: {state.refusal.reason}</p> : null}
              {state.refusal.settings ? (
                <p className="mt-1">
                  Limits and the model provider are in{" "}
                  <Link href="/settings#provider" className="underline underline-offset-4">
                    Settings
                  </Link>
                  .
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      {state.pending || state.streamed ? (
        <section aria-labelledby={`${id}-writing`} aria-busy={state.pending} className="flex flex-col gap-1 border-t border-stone pt-3">
          <h3 id={`${id}-writing`} className="text-sm font-medium text-ink">
            Answer
          </h3>
          <p className={meta}>
            {data.personaName}
            {state.pending ? " · writing" : ""}
          </p>
          <p className="whitespace-pre-wrap text-ink-2">{state.streamed || "…"}</p>
        </section>
      ) : state.answer ? (
        <LastAnswer data={data} answer={state.answer} sent={state.sent} />
      ) : null}
      <p role="status" className="sr-only">
        {announce}
      </p>
    </div>
  );
}

function Permission({
  data,
  store,
  actions,
  status,
}: {
  data: AskPanelData;
  store: AskStore;
  actions: AskActions;
  status: { status: PermissionFormState["status"]; basis: string | null };
}) {
  const id = useId();
  const allowed = status.status === "allowed";
  // A recorded decision replaces the form's buttons; keyboard focus moves to the heading that states it.
  const heading = useRef<HTMLHeadingElement>(null);
  const [decided, setDecided] = useState(0);
  useEffect(() => {
    if (decided) heading.current?.focus();
  }, [decided]);
  const onSaved = () => setDecided((n) => n + 1);
  const explanation = (
    <>
      <p className="text-ink-2">
        Asking sends {permissionScope(data.kind)} to the model provider set in Settings; in the scripted demo nothing leaves this server.
        Only you can allow it.
      </p>
      {/* The line names itself ("Licence …", "No licence reported by arXiv …", "No licence is recorded …"). */}
      <p className="text-ink-2">{data.licence}</p>
    </>
  );
  if (allowed)
    return (
      <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-1">
        <h3 id={`${id}-heading`} ref={heading} tabIndex={-1} className="text-sm font-medium text-ink">
          External AI: allowed
        </h3>
        {status.basis ? <p className="break-words text-xs text-ink-3">Basis: {status.basis}</p> : null}
        <details>
          <summary className={`${quiet} cursor-pointer`}>Change</summary>
          <div className="mt-2 flex flex-col gap-2">
            {explanation}
            <PermissionForm data={data} store={store} actions={actions} status={status} onSaved={onSaved} />
          </div>
        </details>
      </section>
    );
  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-2">
      <h3 id={`${id}-heading`} ref={heading} tabIndex={-1} className="text-sm font-medium text-ink">
        External AI: {status.status === "denied" ? "denied" : "not decided"}
      </h3>
      <p className="text-ink">
        {status.status === "denied"
          ? "You have not allowed external AI for this document, so nothing from it is sent to a model."
          : "External AI has not been allowed for this document, so nothing from it is sent to a model."}
      </p>
      {status.basis ? <p className="break-words text-xs text-ink-3">Basis recorded: {status.basis}</p> : null}
      {explanation}
      <PermissionForm data={data} store={store} actions={actions} status={status} onSaved={onSaved} />
    </section>
  );
}

function PermissionForm({
  data,
  store,
  actions,
  status,
  onSaved,
}: {
  data: AskPanelData;
  store: AskStore;
  actions: AskActions;
  status: { status: PermissionFormState["status"]; basis: string | null };
  onSaved: () => void;
}) {
  const id = useId();
  const [result, formAction, pending] = useActionState(actions.setPermission, {
    status: status.status,
    basis: status.basis,
    error: null,
    saved: false,
  });
  const basisRef = useRef<HTMLInputElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per answer from the server action
  useEffect(() => {
    if (result.saved) {
      store.set({ permission: { status: result.status, basis: result.basis }, refusal: null });
      onSaved();
    } else if (result.error) basisRef.current?.focus();
  }, [result, store]);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      {/* The form's default button, disabled: Enter in the basis field submits nothing. Only Allow or Deny records a decision. */}
      <button type="submit" disabled hidden tabIndex={-1} />
      <input type="hidden" name="assetId" value={data.assetId} />
      <label htmlFor={`${id}-basis`} className="text-sm font-medium text-ink">
        Basis
      </label>
      <input
        id={`${id}-basis`}
        ref={basisRef}
        name="basis"
        maxLength={300}
        placeholder="e.g. the licence above, or personal study"
        aria-describedby={result.error ? `${id}-error` : undefined}
        className={field}
      />
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="status" value="allowed" className={control} disabled={pending}>
          Allow external AI
        </button>
        <button type="submit" name="status" value="denied" className={danger} disabled={pending}>
          Deny
        </button>
      </div>
      {result.error ? (
        <p id={`${id}-error`} role="alert" className="text-rust">
          {result.error}
        </p>
      ) : null}
    </form>
  );
}

function LastAnswer({ data, answer, sent }: { data: AskPanelData; answer: CompanionAnswerView; sent: AskPanelState["sent"] }) {
  const id = useId();
  const shown = answerContext(answer, sent);
  const notes = answerNotes({ kind: data.kind, action: shown.action });
  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-2 border-t border-stone pt-3">
      <h3 id={`${id}-heading`} className="text-sm font-medium text-ink">
        Last answer
      </h3>
      {answer.request ? (
        <div className="rounded-[var(--radius-panel)] border border-stone bg-paper px-3 py-2">
          <p className={meta}>You</p>
          <RenderedHtml html={answer.request.html} className="text-sm" />
        </div>
      ) : null}
      {answer.answer ? (
        <div className="rounded-[var(--radius-panel)] border border-stone bg-paper-3/60 px-3 py-2">
          <p className={meta}>
            {data.personaName}
            {answer.answer.producedBy ? ` · ${answer.answer.producedBy}` : ""}
          </p>
          <RenderedHtml html={answer.answer.html} className="text-sm" />
          <div className="mt-1 flex flex-wrap gap-1">
            {answer.answer.labels.map((label) => (
              <span
                key={label}
                className={[
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-wide",
                  label === "source_backed"
                    ? "border-moss/30 bg-moss-soft text-moss"
                    : label === "needs_checking"
                      ? "border-rust/30 bg-rust-soft text-rust"
                      : "border-stone bg-paper-3 text-ink-2",
                ].join(" ")}
              >
                {label.replace("_", " ")}
              </span>
            ))}
          </div>
          {answer.answer.citations.length ? (
            <ul className="mt-1 flex flex-col gap-0.5 text-xs text-ink-3">
              {answer.answer.citations.map((c) => (
                <li key={c.tag}>
                  {c.tag}: {c.label}
                </li>
              ))}
            </ul>
          ) : null}
          {answer.answer.uncited > 0 ? (
            <p className="mt-1 text-xs text-rust">
              {answer.answer.uncited} unverifiable citation{answer.answer.uncited === 1 ? "" : "s"} removed
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-ink-3">No answer was stored for this request: it was refused or failed before a reply.</p>
      )}
      {notes.map((note) => (
        <p key={note} className="text-xs text-ink-2">
          {note}
        </p>
      ))}
      {shown.evidence.length ? (
        <div className="text-xs text-ink-3">
          <p>What was sent:</p>
          <ul className="flex flex-col gap-0.5">
            {shown.evidence.map((e) => (
              <li key={e.tag}>
                [{e.tag}] {e.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

type AskPanelState = ReturnType<AskStore["get"]>;
