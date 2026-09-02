const VARIANTS = {
  HIGH: { text: "text-[var(--color-clay)]", dot: "bg-[var(--color-clay)]", border: "border-[var(--color-clay)]/25" },
  MEDIUM: { text: "text-[var(--color-amber)]", dot: "bg-[var(--color-amber)]", border: "border-[var(--color-amber)]/25" },
  LOW: { text: "text-[var(--color-body)]", dot: "bg-[var(--color-body)]/40", border: "border-[var(--color-line)]" },
  positive: { text: "text-[var(--color-green)]", dot: "bg-[var(--color-green)]", border: "border-[var(--color-green)]/25" },
  negative: { text: "text-[var(--color-clay)]", dot: "bg-[var(--color-clay)]", border: "border-[var(--color-clay)]/25" },
  neutral: { text: "text-[var(--color-body)]", dot: "bg-[var(--color-body)]/40", border: "border-[var(--color-line)]" },
  primary: { text: "text-[var(--color-primary)]", dot: "bg-[var(--color-primary)]", border: "border-[var(--color-primary)]/25" },
};

// Enterprise status tag: a colored indicator dot + thin tinted border,
// not a solid-fill pill, reads as a data label, not a decorative chip.
export default function Badge({ variant = "neutral", children }) {
  const v = VARIANTS[variant] || VARIANTS.neutral;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm border bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${v.text} ${v.border}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${v.dot}`} />
      {children}
    </span>
  );
}
