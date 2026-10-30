import Link from "next/link";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "quiet" | "danger";

const variantClass: Record<Variant, string> = {
  primary:
    "bg-brass text-paper-2 hover:bg-brass-strong border border-transparent disabled:opacity-60 disabled:cursor-not-allowed",
  secondary: "bg-paper-2 text-ink border border-stone-2 hover:bg-paper-3 disabled:opacity-60",
  quiet: "bg-transparent text-brass hover:underline underline-offset-4 border border-transparent px-1",
  danger: "bg-paper-2 text-rust border border-rust hover:bg-rust-soft disabled:opacity-60",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-focus";

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={[base, variantClass[variant], className].filter(Boolean).join(" ")} {...props} />;
}

export function LinkButton({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={[base, variantClass[variant], className].filter(Boolean).join(" ")}>
      {children}
    </Link>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-ink-3">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-xs text-rust">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const inputClass =
  "w-full rounded-[var(--radius-control)] border border-stone-2 bg-paper-2 px-3 py-2 text-base text-ink placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-focus";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={inputClass} {...props} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={[inputClass, "min-h-32 font-mono text-sm leading-relaxed"].join(" ")} {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={inputClass} {...props} />;
}

export function Card({
  children,
  className,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "article" | "div" | "aside";
}) {
  return (
    <Tag
      className={[
        "rounded-[var(--radius-panel)] border border-stone bg-paper-2 p-5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Tag>
  );
}

type Tone = "neutral" | "brass" | "moss" | "rust" | "slate";
const toneClass: Record<Tone, string> = {
  neutral: "bg-paper-3 text-ink-2 border-stone",
  brass: "bg-brass-soft text-brass-strong border-brass/30",
  moss: "bg-moss-soft text-moss border-moss/30",
  rust: "bg-rust-soft text-rust border-rust/30",
  slate: "bg-slate-soft text-slate border-slate/30",
};

export function Badge({ children, tone = "neutral", title }: { children: ReactNode; tone?: Tone; title?: string }) {
  return (
    <span
      title={title}
      className={[
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-wide",
        toneClass[tone],
      ].join(" ")}
    >
      {children}
    </span>
  );
}

/** Every AI participant carries this label wherever they appear. */
export function AiLabel({ role }: { role: string }) {
  return (
    <Badge tone="slate" title="This is an AI persona, not a person.">
      AI {role}
    </Badge>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-dashed border-stone-2 bg-paper-2 p-8 text-center">
      <h3 className="display text-xl text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-prose text-sm text-ink-2">{body}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Notice({
  tone = "neutral",
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div role={tone === "rust" ? "alert" : "status"} className={["rounded-[var(--radius-panel)] border px-4 py-3 text-sm", toneClass[tone]].join(" ")}>
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={title ? "mt-1" : ""}>{children}</div>
    </div>
  );
}
