import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  Database,
  History,
  Info,
  Search,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  UserCheck,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { PageHeader, Loading, ErrorPanel, cap } from "./Dashboard";
import Badge from "../components/Badge";

const TIER_CONFIG = {
  HIGH: {
    label: "High confidence",
    color: "var(--color-green)",
    bg: "var(--color-green-soft)",
  },
  MEDIUM: {
    label: "Medium confidence",
    color: "var(--color-amber)",
    bg: "var(--color-amber-soft)",
  },
  LOW: {
    label: "Low confidence",
    color: "var(--color-clay)",
    bg: "var(--color-clay-soft)",
  },
};

export default function HistoricalMemory() {
  const { token, region } = useAuth();

  const [data, setData] = useState(null);
  const [pending, setPending] = useState(null);
  const [calibration, setCalibration] = useState(null);
  const [error, setError] = useState(null);

  function refresh() {
    setError(null);
    setData(null);

    api
      .memory(token, region)
      .then(setData)
      .catch((e) => setError(e.message));

    api
      .pendingScenarios(token)
      .then(setPending)
      .catch(() => {});

    api
      .confidenceCalibration(token)
      .then(setCalibration)
      .catch(() => {});
  }

  useEffect(refresh, [token, region]);

  if (error) return <ErrorPanel message={error} />;
  if (!data) return <Loading />;

  const bestMatch = data.ranked?.[0];
  const strongMatches =
    data.ranked?.filter((s) => s.similarity >= data.threshold) || [];

  return (
    <div className="mx-auto max-w-[1250px] pb-16">

      {/* ============================================================
          HEADER
      ============================================================ */}

      <PageHeader
        title="Business Memory"
        subtitle={
          data.region === "all"
            ? "Historical scenarios across all regions"
            : `Historical scenarios for ${cap(data.region)}`
        }
        right={
          <div className="flex items-center gap-2 rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-xs shadow-sm">
            <Database
              size={14}
              className="text-[var(--color-primary)]"
            />

            <span className="text-[var(--color-body)]/60">
              Similarity threshold
            </span>

            <span className="font-mono-num font-semibold text-[var(--color-heading)]">
              {data.threshold}%
            </span>
          </div>
        }
      />

      {/* ============================================================
          TOP SUMMARY
      ============================================================ */}

      <section className="mb-8 grid gap-px overflow-hidden border border-[var(--color-line)] bg-[var(--color-line)] md:grid-cols-3">

        <SummaryMetric
          icon={History}
          label="Historical matches"
          value={data.ranked?.length ?? 0}
          description="Scenarios currently available"
        />

        <SummaryMetric
          icon={Target}
          label="Above threshold"
          value={strongMatches.length}
          description={`Matches at or above ${data.threshold}%`}
        />

        <SummaryMetric
          icon={data.isNovel ? AlertCircle : ShieldCheck}
          label="Scenario status"
          value={data.isNovel ? "Novel" : "Recognized"}
          description={
            data.isNovel
              ? "No sufficiently similar precedent"
              : "Historical precedent identified"
          }
          danger={data.isNovel}
        />

      </section>

      {/* ============================================================
          CURRENT SCENARIO
      ============================================================ */}

      <section className="mb-8">

        <SectionHeading
          icon={Target}
          title="Current scenario"
          subtitle="The fingerprint currently being compared against historical business events."
        />

        <div className="grid gap-6 border border-[var(--color-line)] bg-white p-5 shadow-sm lg:grid-cols-[1fr_300px]">

          <div>
            <div className="mb-4 flex items-center gap-2">
              {data.isNovel ? (
                <span className="inline-flex items-center gap-1.5 bg-[var(--color-clay-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--color-clay)]">
                  <AlertCircle size={13} />
                  Novel pattern
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 bg-[var(--color-green-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--color-green)]">
                  <Check size={13} />
                  Historical precedent found
                </span>
              )}
            </div>

            <p className="max-w-3xl text-sm leading-6 text-[var(--color-heading)]">
              {data.message}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-3 lg:grid-cols-4">
              {Object.entries(data.currentFingerprint).map(
                ([key, value]) => (
                  <FingerprintMetric
                    key={key}
                    label={formatLabel(key)}
                    value={value}
                  />
                )
              )}
            </div>
          </div>

          {/* Best match */}

          <div className="border-l border-[var(--color-line)] pl-6">

            <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-body)]/45">
              Best historical match
            </div>

            {bestMatch ? (
              <>
                <div className="mt-3 text-lg font-bold text-[var(--color-heading)]">
                  {bestMatch.title}
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <SimilarityScore
                    value={bestMatch.similarity}
                    threshold={data.threshold}
                  />

                  {bestMatch.source === "confirmed" && (
                    <Badge variant="primary">
                      analyst confirmed
                    </Badge>
                  )}
                </div>

                <div className="mt-4 text-xs leading-5 text-[var(--color-body)]/60">
                  {bestMatch.whatHappened}
                </div>

                <div className="mt-5 flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary)]">
                  View historical evidence
                  <ArrowRight size={13} />
                </div>
              </>
            ) : (
              <div className="mt-3 text-sm text-[var(--color-body)]/50">
                No historical scenarios available.
              </div>
            )}

          </div>

        </div>
      </section>

      {/* ============================================================
          PENDING CONFIRMATION
      ============================================================ */}

      {pending?.length > 0 && (
        <section className="mb-8">

          <SectionHeading
            icon={UserCheck}
            title={`Pending analyst confirmation (${pending.length})`}
            subtitle="Resolved investigations awaiting confirmation before entering the searchable historical memory."
          />

          <div className="space-y-2">
            {pending.map((scenario) => (
              <PendingScenario
                key={scenario.id}
                scenario={scenario}
                token={token}
                onConfirmed={refresh}
              />
            ))}
          </div>

        </section>
      )}

      {/* ============================================================
          HISTORICAL SCENARIOS
      ============================================================ */}

      <section className="mb-10">

        <SectionHeading
          icon={History}
          title="Historical scenarios"
          subtitle="Ranked by similarity to the current business situation."
        />

        <div className="overflow-hidden border border-[var(--color-line)] bg-white shadow-sm">

          <div className="hidden grid-cols-[1.6fr_120px_120px_1fr] border-b border-[var(--color-line)] bg-[var(--color-canvas)]/60 px-5 py-3 text-[10px] font-bold uppercase tracking-wide text-[var(--color-body)]/45 md:grid">
            <div>Scenario</div>
            <div>Similarity</div>
            <div>Status</div>
            <div>Historical outcome</div>
          </div>

          <div className="divide-y divide-[var(--color-line)]">

            {data.ranked?.length ? (
              data.ranked.map((scenario, index) => (
                <HistoricalScenario
                  key={scenario.id}
                  scenario={scenario}
                  index={index}
                  threshold={data.threshold}
                />
              ))
            ) : (
              <div className="p-8 text-center text-sm text-[var(--color-body)]/50">
                No historical scenarios available.
              </div>
            )}

          </div>
        </div>

      </section>

      {/* ============================================================
          CALIBRATION
      ============================================================ */}

      {calibration && (
        <ConfidenceCalibration data={calibration} />
      )}

      {/* ============================================================
          METHODOLOGY
      ============================================================ */}

      <Methodology />

    </div>
  );
}

/* ================================================================
   SUMMARY METRIC
================================================================ */

function SummaryMetric({
  icon: Icon,
  label,
  value,
  description,
  danger = false,
}) {
  return (
    <div className="bg-white p-5">

      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-[var(--color-body)]/45">
        <Icon size={14} />
        {label}
      </div>

      <div
        className={`mt-3 font-mono-num text-2xl font-bold ${
          danger
            ? "text-[var(--color-clay)]"
            : "text-[var(--color-heading)]"
        }`}
      >
        {value}
      </div>

      <div className="mt-1 text-[10px] text-[var(--color-body)]/45">
        {description}
      </div>

    </div>
  );
}

/* ================================================================
   FINGERPRINT
================================================================ */

function FingerprintMetric({ label, value }) {
  const numericValue = Number(value);

  const positive = numericValue >= 0;

  return (
    <div className="bg-white p-3">

      <div className="truncate text-[9px] font-bold uppercase tracking-wide text-[var(--color-body)]/40">
        {label}
      </div>

      <div
        className={`mt-1.5 font-mono-num text-sm font-semibold ${
          positive
            ? "text-[var(--color-green)]"
            : "text-[var(--color-clay)]"
        }`}
      >
        {numericValue >= 0 ? "+" : ""}
        {(numericValue * 100).toFixed(1)}%
      </div>

    </div>
  );
}

/* ================================================================
   SIMILARITY SCORE
================================================================ */

function SimilarityScore({ value, threshold }) {
  const strong = value >= threshold;

  return (
    <div
      className={`flex items-center gap-2 ${
        strong
          ? "text-[var(--color-green)]"
          : "text-[var(--color-body)]"
      }`}
    >

      <div className="relative h-1.5 w-20 overflow-hidden bg-[var(--color-canvas)]">

        <div
          className={`absolute inset-y-0 left-0 ${
            strong
              ? "bg-[var(--color-green)]"
              : "bg-[var(--color-body)]/40"
          }`}
          style={{
            width: `${Math.min(value, 100)}%`,
          }}
        />

      </div>

      <span className="font-mono-num text-xs font-bold">
        {value}%
      </span>

    </div>
  );
}

/* ================================================================
   HISTORICAL SCENARIO
================================================================ */

function HistoricalScenario({
  scenario,
  index,
  threshold,
}) {
  const [open, setOpen] = useState(false);

  const strong = scenario.similarity >= threshold;

  return (
    <div>

      <button
        onClick={() => setOpen((v) => !v)}
        className="grid w-full gap-3 px-5 py-4 text-left transition hover:bg-[var(--color-canvas)]/50 md:grid-cols-[1.6fr_120px_120px_1fr]"
      >

        {/* Scenario */}

        <div className="flex gap-3">

          <span className="hidden font-mono-num text-[10px] text-[var(--color-body)]/30 md:block">
            {String(index + 1).padStart(2, "0")}
          </span>

          <div className="min-w-0">

            <div className="truncate text-sm font-semibold text-[var(--color-heading)]">
              {scenario.title}
            </div>

            <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--color-body)]/45">
              <Clock3 size={11} />
              {String(scenario.date).slice(0, 10)}

              <span>·</span>

              {cap(scenario.region || "")}
            </div>

          </div>

        </div>

        {/* Similarity */}

        <div className="flex items-center">
          <SimilarityScore
            value={scenario.similarity}
            threshold={threshold}
          />
        </div>

        {/* Status */}

        <div className="flex items-center gap-2">

          {scenario.source === "confirmed" ? (
            <Badge variant="primary">
              Confirmed
            </Badge>
          ) : (
            <Badge
              variant={strong ? "positive" : "neutral"}
            >
              {strong ? "Matched" : "Below threshold"}
            </Badge>
          )}

        </div>

        {/* Outcome */}

        <div className="hidden items-center justify-between gap-3 md:flex">

          <span className="line-clamp-2 text-xs leading-5 text-[var(--color-body)]/65">
            {scenario.outcome}
          </span>

          {open ? (
            <ChevronDown
              size={15}
              className="shrink-0 text-[var(--color-body)]/40"
            />
          ) : (
            <ArrowRight
              size={15}
              className="shrink-0 text-[var(--color-body)]/30"
            />
          )}

        </div>

      </button>

      {/* Mobile / Expanded details */}

      {open && (
        <div className="border-t border-[var(--color-line)] bg-[var(--color-canvas)]/40 px-5 py-5">

          <div className="grid gap-5 md:grid-cols-4">

            <Detail
              label="What happened"
              value={scenario.whatHappened}
            />

            <Detail
              label="Suspected driver"
              value={scenario.suspectedDriver}
            />

            <Detail
              label="Action taken"
              value={scenario.actionTaken}
            />

            <Detail
              label="Outcome"
              value={scenario.outcome}
            />

          </div>

        </div>
      )}

    </div>
  );
}

/* ================================================================
   PENDING SCENARIO
================================================================ */

function PendingScenario({
  scenario,
  token,
  onConfirmed,
}) {
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    confirmedCause: "",
    actionTaken: "",
    outcome: "",
  });

  const [status, setStatus] = useState(null);

  async function submit(e) {
    e.preventDefault();

    setStatus("saving");

    try {
      await api.confirmScenario(
        token,
        scenario.id,
        form
      );

      setStatus("confirmed");
      onConfirmed();
    } catch (err) {
      setStatus(`error: ${err.message}`);
    }
  }

  return (
    <div className="border border-[var(--color-amber)]/20 bg-white">

      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">

        <div className="min-w-0">

          <div className="flex items-center gap-2">

            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--color-amber-soft)] text-[var(--color-amber)]">
              <Clock3 size={14} />
            </span>

            <div className="truncate text-sm font-semibold text-[var(--color-heading)]">
              {scenario.kpi} · {scenario.region}
            </div>

          </div>

          <div className="mt-2 text-xs text-[var(--color-body)]/55">

            Proposed{" "}
            {scenario.proposedAt?.slice(0, 16)}
            {" · "}
            {scenario.proposedBy}

          </div>

          {scenario.hypotheses?.[0] && (
            <div className="mt-2 text-xs text-[var(--color-body)]/65">
              Leading hypothesis:{" "}
              <strong className="text-[var(--color-heading)]">
                {scenario.hypotheses[0].label}
              </strong>

              {" · "}

              {scenario.hypotheses[0].confidence}%
            </div>
          )}

        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="flex shrink-0 items-center justify-center gap-1.5 border border-[var(--color-line)] px-3 py-2 text-xs font-semibold text-[var(--color-heading)] transition hover:bg-[var(--color-canvas)]"
        >
          <UserCheck size={13} />

          {open ? "Close" : "Review & confirm"}
        </button>

      </div>

      {open && (
        <form
          onSubmit={submit}
          className="border-t border-[var(--color-line)] bg-[var(--color-canvas)]/40 p-4"
        >

          <div className="mb-4 text-xs font-semibold text-[var(--color-heading)]">
            Confirm historical outcome
          </div>

          <div className="grid gap-3 md:grid-cols-3">

            <Input
              label="Confirmed cause"
              value={form.confirmedCause}
              onChange={(value) =>
                setForm({
                  ...form,
                  confirmedCause: value,
                })
              }
            />

            <Input
              label="Action taken"
              value={form.actionTaken}
              onChange={(value) =>
                setForm({
                  ...form,
                  actionTaken: value,
                })
              }
            />

            <Input
              label="Outcome"
              value={form.outcome}
              onChange={(value) =>
                setForm({
                  ...form,
                  outcome: value,
                })
              }
            />

          </div>

          <div className="mt-4 flex items-center gap-3">

            <button
              type="submit"
              className="flex items-center gap-2 bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
            >
              <Check size={14} />
              Confirm scenario
            </button>

            {status && (
              <span className="text-xs text-[var(--color-body)]/60">
                {status}
              </span>
            )}

          </div>

        </form>
      )}

    </div>
  );
}

/* ================================================================
   CALIBRATION
================================================================ */

function ConfidenceCalibration({ data }) {
  const [open, setOpen] = useState(false);

  if (!data.available) {
    return (
      <section className="mb-8 border border-[var(--color-line)] bg-white">

        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-2">
            <Target
              size={15}
              className="text-[var(--color-primary)]"
            />

            <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-body)]/55">
              Confidence calibration
            </span>
          </div>

          {open ? (
            <ChevronDown size={15} />
          ) : (
            <ChevronDown size={15} className="rotate-[-90deg]" />
          )}
        </button>

        {open && (
          <div className="border-t border-[var(--color-line)] p-4 text-xs leading-5 text-[var(--color-body)]">
            {data.message}

            <div className="mt-2 font-mono-num">
              {data.confirmedOutcomeCount}/
              {data.minimumRequired} confirmed outcomes
            </div>
          </div>
        )}

      </section>
    );
  }

  const tiers = [
    {
      key: "HIGH",
      label: "High",
    },
    {
      key: "MEDIUM",
      label: "Medium",
    },
    {
      key: "LOW",
      label: "Low",
    },
  ];

  return (
    <section className="mb-8">

      <SectionHeading
        icon={Target}
        title="Confidence calibration"
        subtitle={data.disclaimer}
      />

      <div className="grid gap-px overflow-hidden border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-3 lg:grid-cols-4">

        {tiers.map((tier) => {
          const bucket = data.buckets[tier.key];
          const config = TIER_CONFIG[tier.key];

          return (
            <div
              key={tier.key}
              className="bg-white p-5"
            >

              <div
                className="inline-flex px-2 py-1 text-[10px] font-bold uppercase tracking-wide"
                style={{
                  color: config.color,
                  background: config.bg,
                }}
              >
                {tier.label}
              </div>

              <div className="mt-4 font-mono-num text-2xl font-bold text-[var(--color-heading)]">
                {bucket.accuracyPct != null
                  ? `${bucket.accuracyPct}%`
                  : "N/A"}
              </div>

              <div className="mt-1 text-[10px] text-[var(--color-body)]/45">
                {bucket.n} sample
                {bucket.n === 1 ? "" : "s"}
              </div>

              {!bucket.reliable && bucket.n > 0 && (
                <div className="mt-2 flex items-center gap-1 text-[9px] text-[var(--color-amber)]">
                  <Info size={11} />
                  Limited sample
                </div>
              )}

            </div>
          );
        })}

        <div className="bg-white p-5">

          <div className="inline-flex bg-[var(--color-primary-soft)] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-primary)]">
            Brier score
          </div>

          <div className="mt-4 font-mono-num text-2xl font-bold text-[var(--color-heading)]">
            {data.brierScore}
          </div>

          <div className="mt-1 text-[10px] text-[var(--color-body)]/45">
            0 = perfect calibration
          </div>

        </div>

      </div>

    </section>
  );
}

/* ================================================================
   METHODOLOGY
================================================================ */

function Methodology() {
  const [open, setOpen] = useState(false);

  return (
    <section className="border-t border-[var(--color-line)] pt-5">

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-xs font-semibold text-[var(--color-body)]/55 hover:text-[var(--color-heading)]"
      >
        {open ? (
          <ChevronDown size={14} />
        ) : (
          <ChevronDown
            size={14}
            className="rotate-[-90deg]"
          />
        )}

        How historical memory works
      </button>

      {open && (
        <div className="mt-4 grid gap-4 text-xs leading-5 text-[var(--color-body)]/65 md:grid-cols-3">

          <Method
            number="01"
            title="Fingerprint"
            text="The current business scenario is represented as a structured set of KPI and driver signals."
          />

          <Method
            number="02"
            title="Similarity"
            text="Historical scenarios are ranked against the current fingerprint using the configured similarity threshold."
          />

          <Method
            number="03"
            title="Confirmation"
            text="Analyst-confirmed scenarios become trusted historical memory and can influence future investigations."
          />

        </div>
      )}

    </section>
  );
}

/* ================================================================
   HELPERS
================================================================ */

function SectionHeading({
  icon: Icon,
  title,
  subtitle,
}) {
  return (
    <div className="mb-3 flex items-start gap-2">

      <Icon
        size={15}
        className="mt-0.5 text-[var(--color-primary)]"
      />

      <div>

        <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--color-body)]/55">
          {title}
        </h2>

        {subtitle && (
          <p className="mt-1 text-xs text-[var(--color-body)]/50">
            {subtitle}
          </p>
        )}

      </div>

    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-wide text-[var(--color-body)]/40">
        {label}
      </div>

      <div className="mt-1 text-xs leading-5 text-[var(--color-body)]">
        {value || "N/A"}
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
}) {
  return (
    <label className="block">

      <span className="mb-1 block text-[10px] font-semibold text-[var(--color-heading)]">
        {label}
      </span>

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full border border-[var(--color-line)] bg-white px-3 py-2 text-xs outline-none transition focus:border-[var(--color-primary)]"
      />

    </label>
  );
}

function Method({
  number,
  title,
  text,
}) {
  return (
    <div className="flex gap-3">

      <span className="font-mono-num text-[10px] text-[var(--color-primary)]">
        {number}
      </span>

      <div>
        <div className="font-semibold text-[var(--color-heading)]">
          {title}
        </div>

        <p className="mt-1">
          {text}
        </p>
      </div>

    </div>
  );
}

function formatLabel(value) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (s) => s.toUpperCase());
}