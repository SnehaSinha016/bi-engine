const TIER_CONFIG = {
  HIGH: {
    color: "var(--color-green)",
    bg: "var(--color-green-soft)",
    label: "High confidence",
  },
  MEDIUM: {
    color: "var(--color-amber)",
    bg: "var(--color-amber-soft)",
    label: "Moderate confidence",
  },
  LOW: {
    color: "var(--color-clay)",
    bg: "var(--color-clay-soft)",
    label: "Low confidence",
  },
};

export default function ConfidenceRing({
  value = 0,
  tier = "LOW",
  size = 64,
  label,
}) {
  const safeValue = Math.min(
    Math.max(Number(value) || 0, 0),
    100
  );

  const config =
    TIER_CONFIG[tier] || TIER_CONFIG.LOW;

  const strokeWidth = 5;

  const radius =
    (size - strokeWidth * 2 - 4) / 2;

  const circumference =
    2 * Math.PI * radius;

  const progress =
    circumference -
    (safeValue / 100) * circumference;

  return (
    <div className="flex items-center gap-3">

      {/* =========================
          RING
      ========================= */}

      <div
        className="relative shrink-0"
        style={{
          width: size,
          height: size,
        }}
      >

        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >

          {/* Background */}

          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-line)"
            strokeWidth={strokeWidth}
          />

          {/* Progress */}

          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={config.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={progress}
            style={{
              transition:
                "stroke-dashoffset 700ms cubic-bezier(.4,0,.2,1)",
            }}
          />

        </svg>

        {/* Center */}

        <div className="absolute inset-0 flex flex-col items-center justify-center">

          <span
            className="font-mono-num text-sm font-bold leading-none"
            style={{
              color: config.color,
            }}
          >
            {Math.round(safeValue)}
          </span>

          <span className="mt-0.5 text-[7px] font-semibold uppercase tracking-wide text-[var(--color-body)]/35">
            score
          </span>

        </div>

      </div>

      {/* =========================
          LABEL
      ========================= */}

      {label && (
        <div className="min-w-0">

          <div
            className="mb-1 inline-flex rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em]"
            style={{
              color: config.color,
              backgroundColor: config.bg,
            }}
          >
            {tier}
          </div>

          <div className="max-w-[150px] text-[10px] leading-4 text-[var(--color-body)]/60">
            {label}
          </div>

        </div>
      )}

    </div>
  );
}