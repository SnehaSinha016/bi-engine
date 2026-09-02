// Shared enterprise UI primitives.
// Design language:
// - clean information hierarchy
// - subtle surfaces
// - strong typography
// - restrained borders
// - selective use of cards
// - compact enterprise density
// - no unnecessary gradients or decorative elements

/* =========================================================
   EDITORIAL SECTION
========================================================= */

export function EditorialSection({
  title,
  sub,
  right,
  children,
  className = "",
}) {
  return (
    <section
      className={`
        relative mb-8
        ${className}
      `}
    >
      {/* Section header */}

      <div className="mb-4 flex items-start justify-between gap-4">

        <div className="min-w-0">

          <div className="flex items-center gap-2">

            <span className="h-4 w-0.5 rounded-full bg-[var(--color-primary)]" />

            <h3 className="font-display text-[15px] font-bold tracking-tight text-[var(--color-heading)]">
              {title}
            </h3>

          </div>

          {sub && (
            <p className="mt-1 ml-2.5 max-w-3xl text-[11px] leading-5 text-[var(--color-body)]/55">
              {sub}
            </p>
          )}

        </div>

        {right && (
          <div className="shrink-0">
            {right}
          </div>
        )}

      </div>

      {/* Content */}

      <div className="ml-0">
        {children}
      </div>

    </section>
  );
}


/* =========================================================
   MINI STAT
========================================================= */

export function MiniStat({
  label,
  value,
  valueClassName = "",
  icon,
  helper,
}) {
  return (
    <div className="min-w-[120px]">

      <div className="flex items-center gap-1.5">

        {icon && (
          <span className="text-[var(--color-primary)]">
            {icon}
          </span>
        )}

        <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--color-body)]/40">
          {label}
        </div>

      </div>

      <div
        className={`
          mt-1
          font-mono-num
          text-[15px]
          font-bold
          tracking-tight
          text-[var(--color-heading)]
          ${valueClassName}
        `}
      >
        {value}
      </div>

      {helper && (
        <div className="mt-0.5 text-[9px] leading-4 text-[var(--color-body)]/40">
          {helper}
        </div>
      )}

    </div>
  );
}


/* =========================================================
   STAT ROW
========================================================= */

export function StatRow({
  children,
  className = "",
}) {
  return (
    <div
      className={`
        flex flex-wrap
        gap-x-8
        gap-y-4
        ${className}
      `}
    >
      {children}
    </div>
  );
}


/* =========================================================
   STAT CARD
========================================================= */

export function StatCard({
  children,
  className = "",
  hover = false,
  padding = "p-4",
}) {
  return (
    <div
      className={`
        rounded-md
        border border-[var(--color-line)]
        bg-white
        ${padding}

        ${
          hover
            ? `
              transition-all duration-200
              hover:-translate-y-[1px]
              hover:border-[var(--color-primary)]/20
              hover:shadow-sm
            `
            : `
              shadow-sm
            `
        }

        ${className}
      `}
    >
      {children}
    </div>
  );
}


/* =========================================================
   KPI CARD
   Useful for dashboard-style metrics.
========================================================= */

export function KpiCard({
  label,
  value,
  change,
  trend,
  description,
  icon,
  onClick,
}) {
  const positive = trend === "up";
  const negative = trend === "down";

  return (
    <div
      onClick={onClick}
      className={`
        group relative overflow-hidden
        rounded-md
        border border-[var(--color-line)]
        bg-white
        p-4
        shadow-sm
        transition-all duration-200

        ${
          onClick
            ? "cursor-pointer hover:-translate-y-[1px] hover:border-[var(--color-primary)]/25 hover:shadow-sm"
            : ""
        }
      `}
    >

      {/* top */}

      <div className="flex items-start justify-between gap-3">

        <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--color-body)]/45">
          {label}
        </div>

        {icon && (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-canvas)] text-[var(--color-primary)]">
            {icon}
          </div>
        )}

      </div>

      {/* value */}

      <div className="mt-3 font-mono-num text-2xl font-bold tracking-tight text-[var(--color-heading)]">
        {value}
      </div>

      {/* change */}

      {change !== undefined && (
        <div className="mt-1 flex items-center gap-1.5">

          <span
            className={`
              text-[10px] font-bold

              ${
                positive
                  ? "text-[var(--color-green)]"
                  : negative
                    ? "text-[var(--color-clay)]"
                    : "text-[var(--color-body)]/50"
              }
            `}
          >
            {positive
              ? "↗"
              : negative
                ? "↘"
                : "→"}

            {" "}

            {change}
          </span>

          <span className="text-[9px] text-[var(--color-body)]/35">
            vs baseline
          </span>

        </div>
      )}

      {description && (
        <p className="mt-3 border-t border-[var(--color-line)] pt-3 text-[9px] leading-4 text-[var(--color-body)]/45">
          {description}
        </p>
      )}

      {/* subtle hover indicator */}

      {onClick && (
        <div className="absolute bottom-0 left-0 h-0.5 w-0 bg-[var(--color-primary)] transition-all duration-200 group-hover:w-full" />
      )}

    </div>
  );
}


/* =========================================================
   INFO PANEL
========================================================= */

export function InfoPanel({
  title,
  children,
  icon,
  tone = "neutral",
  className = "",
}) {
  const tones = {
    neutral: {
      bg: "bg-[var(--color-canvas)]",
      text: "text-[var(--color-body)]",
      accent: "bg-[var(--color-primary)]",
    },

    positive: {
      bg: "bg-[var(--color-green-soft)]/50",
      text: "text-[var(--color-green)]",
      accent: "bg-[var(--color-green)]",
    },

    warning: {
      bg: "bg-[var(--color-amber-soft)]/60",
      text: "text-[var(--color-amber)]",
      accent: "bg-[var(--color-amber)]",
    },

    negative: {
      bg: "bg-[var(--color-clay-soft)]/60",
      text: "text-[var(--color-clay)]",
      accent: "bg-[var(--color-clay)]",
    },
  };

  const config =
    tones[tone] || tones.neutral;

  return (
    <div
      className={`
        relative overflow-hidden
        rounded-md
        border border-[var(--color-line)]
        ${config.bg}
        p-4
        ${className}
      `}
    >

      <div
        className={`
          absolute left-0 top-0 h-full w-0.5
          ${config.accent}
        `}
      />

      <div className="flex gap-3">

        {icon && (
          <div className={`mt-0.5 shrink-0 ${config.text}`}>
            {icon}
          </div>
        )}

        <div className="min-w-0">

          {title && (
            <div className="text-[11px] font-bold text-[var(--color-heading)]">
              {title}
            </div>
          )}

          <div
            className={`
              ${title ? "mt-1" : ""}
              text-[11px]
              leading-5
              ${config.text}
            `}
          >
            {children}
          </div>

        </div>

      </div>

    </div>
  );
}


/* =========================================================
   DIVIDER
========================================================= */

export function SectionDivider({
  className = "",
}) {
  return (
    <div
      className={`
        h-px
        bg-[var(--color-line)]
        ${className}
      `}
    />
  );
}


/* =========================================================
   DATA ROW
   Useful for enterprise tables/lists.
========================================================= */

export function DataRow({
  label,
  value,
  secondary,
  icon,
  right,
  onClick,
}) {
  return (
    <div
      onClick={onClick}
      className={`
        flex items-center gap-3
        border-b border-[var(--color-line)]
        py-3
        last:border-0

        ${
          onClick
            ? "cursor-pointer transition-colors hover:bg-[var(--color-canvas)]"
            : ""
        }
      `}
    >

      {icon && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-canvas)] text-[var(--color-primary)]">
          {icon}
        </div>
      )}

      <div className="min-w-0 flex-1">

        <div className="truncate text-[11px] font-semibold text-[var(--color-heading)]">
          {label}
        </div>

        {secondary && (
          <div className="mt-0.5 truncate text-[9px] text-[var(--color-body)]/45">
            {secondary}
          </div>
        )}

      </div>

      {value !== undefined && (
        <div className="shrink-0 font-mono-num text-[11px] font-bold text-[var(--color-heading)]">
          {value}
        </div>
      )}

      {right && (
        <div className="shrink-0">
          {right}
        </div>
      )}

    </div>
  );
}


/* =========================================================
   NARRATIVE SOURCE
========================================================= */

const NARRATIVE_SOURCE_LABEL = {
  gemini: {
    text: "Generated with Gemini",
    tone: "positive",
  },

  anthropic: {
    text: "Generated with Claude",
    tone: "positive",
  },

  "mock-fallback": {
    text: "Deterministic fallback",
    tone: "warn",
  },

  mock: {
    text: "Demo / Mock provider",
    tone: "neutral",
  },

  "error-fallback": {
    text: "Deterministic fallback",
    tone: "warn",
  },
};


export function NarrativeSourceBadge({
  aiProvider,
}) {
  if (!aiProvider) return null;

  const info =
    NARRATIVE_SOURCE_LABEL[
      aiProvider.narrativeSource
    ] ||
    NARRATIVE_SOURCE_LABEL.mock;

  const toneClass = {
    positive:
      "bg-[var(--color-green-soft)] text-[var(--color-green)]",

    warn:
      "bg-[var(--color-amber-soft)] text-[var(--color-amber)]",

    neutral:
      "bg-[var(--color-canvas)] text-[var(--color-body)]",
  }[info.tone];

  return (
    <span
      className={`
        inline-flex
        items-center
        gap-1.5
        rounded-full
        px-2.5
        py-1
        text-[9px]
        font-bold
        uppercase
        tracking-[0.08em]
        ${toneClass}
      `}
      title={
        aiProvider.fallbackReason ||
        undefined
      }
    >

      <span
        className={`
          h-1.5
          w-1.5
          rounded-full

          ${
            info.tone === "positive"
              ? "bg-[var(--color-green)]"
              : info.tone === "warn"
                ? "bg-[var(--color-amber)]"
                : "bg-[var(--color-body)]/40"
          }
        `}
      />

      {info.text}

    </span>
  );
}