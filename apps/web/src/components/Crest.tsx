interface Props {
  size?: number;
  className?: string;
  title?: string;
}

/**
 * Original Corniversity crest: an open book under a small eight-point star inside a brass
 * ring. Drawn in the current text colour so it works in both registers.
 */
export function Crest({ size = 40, className, title = "Corniversity crest" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="32" cy="32" r="29" />
      <circle cx="32" cy="32" r="25" strokeWidth="0.75" opacity="0.6" />
      {/* star */}
      <path d="M32 11.5v7M28.5 15h7M29.6 12.6l4.8 4.8M34.4 12.6l-4.8 4.8" strokeWidth="1.5" />
      {/* open book */}
      <path d="M32 27.5c-4.5-3.3-10-3.6-15-2.2v20.2c5-1.4 10.5-1.1 15 2.2 4.5-3.3 10-3.6 15-2.2V25.3c-5-1.4-10.5-1.1-15 2.2z" />
      <path d="M32 27.5v20.2" />
      <path d="M21 31.5c3.4-.6 6.9-.3 10 1M21 36.5c3.4-.6 6.9-.3 10 1M21 41.5c3.4-.6 6.9-.3 10 1" strokeWidth="1.25" opacity="0.8" />
      <path d="M43 31.5c-3.4-.6-6.9-.3-10 1M43 36.5c-3.4-.6-6.9-.3-10 1M43 41.5c-3.4-.6-6.9-.3-10 1" strokeWidth="1.25" opacity="0.8" />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3 text-ink">
      <Crest size={compact ? 28 : 36} className="text-brass" />
      <span
        className="display"
        style={{ fontSize: compact ? "1.25rem" : "1.6rem", letterSpacing: "0.005em" }}
      >
        Corniversity
      </span>
    </span>
  );
}
