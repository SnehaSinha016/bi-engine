import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  Database,
  ExternalLink,
  GitBranch,
  History,
  Info,
  Layers3,
  Lightbulb,
  Search,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  UserRound,
  XCircle,
  Zap,
} from "lucide-react";
import { Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Filler);

import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { Loading, ErrorPanel, cap } from "./Dashboard";
import ConfidenceRing from "../components/ConfidenceRing";
import Badge from "../components/Badge";
import { NarrativeSourceBadge } from "../components/UI";

const TIER_COLOR = {
  HIGH: "var(--color-green)",
  MEDIUM: "var(--color-amber)",
  LOW: "var(--color-clay)",
};

const TIER_BG = {
  HIGH: "var(--color-green-soft)",
  MEDIUM: "var(--color-amber-soft)",
  LOW: "var(--color-clay-soft)",
};

const TAG_LABEL = {
  KNOWN: "Known cause",
  LIKELY: "Likely cause",
  CORRELATED_ONLY: "Correlated only",
};

const DECISION_CONFIG = {
  RECOMMEND_ACTION: {
    label: "Action recommended",
    short: "ACT",
    icon: Zap,
    tone: "positive",
  },
  NO_ACTION: {
    label: "No action required",
    short: "STABLE",
    icon: ShieldCheck,
    tone: "positive",
  },
  INVESTIGATE_DEEPER: {
    label: "Further investigation required",
    short: "INVESTIGATE",
    icon: Search,
    tone: "warning",
  },
  AMBIGUOUS: {
    label: "Cause remains ambiguous",
    short: "AMBIGUOUS",
    icon: CircleAlert,
    tone: "warning",
  },
  ABSTAIN: {
    label: "Insufficient confidence",
    short: "ABSTAIN",
    icon: AlertCircle,
    tone: "warning",
  },
  ABSTAIN_INSUFFICIENT_HISTORY: {
    label: "Insufficient historical evidence",
    short: "ABSTAIN",
    icon: History,
    tone: "warning",
  },
};

export default function InvestigationView() {
  const { kpiId = "revenue" } = useParams();
  const { token, region, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [kpis, setKpis] = useState([]);

  const defaultPersona =
    user.role === "executive"
      ? "executive"
      : user.role === "analyst"
        ? "analyst"
        : "operations";

  // Persona is decided at login (see AuthContext / Sidebar's "Switch
  // persona" control), this page no longer offers its own in-page
  // override toggle, since that duplicated a choice already made
  // once, higher up. A `?persona=` URL param is still honored if
  // present (e.g. a future deep link), but there's no UI here to
  // set one.
  const persona = searchParams.get("persona") || defaultPersona;

  const [data, setData] = useState(null);
  const [actionData, setActionData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    api.metaKpis(token).then(setKpis).catch(() => {});
  }, [token]);

  useEffect(() => {
    setData(null);
    setActionData(null);
    setSelectedId(null);
    setError(null);

    api
      .kpiStory(token, kpiId, region, persona)
      .then((d) => {
        setData(d);
        setSelectedId(d.topHypothesis?.id || null);
      })
      .catch((e) => setError(e.message));
  }, [token, region, kpiId, persona]);

  useEffect(() => {
    if (data?.decision === "RECOMMEND_ACTION") {
      api
        .actions(token, kpiId, data.region)
        .then(setActionData)
        .catch(() => {});
    }
    // Depend on `data` itself (the object reference), not
    // `data?.decision`. decision is persona-independent by design ,
    // it never changes value on a pure persona switch, so a
    // dependency array keyed on decision's *value* silently skips
    // re-fetching actionData when only persona changes, even though
    // the effect above already reset it to null. Depending on the
    // object reference means this correctly re-fires on every new
    // investigation result, regardless of which field changed.
  }, [data, token, kpiId]);

  if (error) return <ErrorPanel message={error} />;
  if (!data) return <Loading />;

  const decision =
    DECISION_CONFIG[data.decision] || DECISION_CONFIG.INVESTIGATE_DEEPER;

  const DecisionIcon = decision.icon;

  const changeNegative = Number(data.change) < 0;

  return (
    <div className="mx-auto max-w-[1400px] pb-16">
      {/* ============================================================
          HEADER
      ============================================================ */}

      <header className="mb-6 border-b border-[var(--color-line)] pb-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs text-[var(--color-body)]/50">
              <span>Investigation</span>
              <ChevronRight size={13} />
              <span>{data.kpiName}</span>
              <ChevronRight size={13} />
              <span>
                {data.region === "all"
                  ? "All regions"
                  : cap(data.region)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-heading)]">
                {data.kpiName}
              </h1>

              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  changeNegative
                    ? "bg-[var(--color-clay-soft)] text-[var(--color-clay)]"
                    : "bg-[var(--color-green-soft)] text-[var(--color-green)]"
                }`}
              >
                {changeNegative ? (
                  <ArrowDownRight size={14} />
                ) : (
                  <ArrowUpRight size={14} />
                )}

                {data.change > 0 ? "+" : ""}
                {data.change}%
              </span>
            </div>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-body)]">
              {data.materiality.rationale}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <KpiSelector
              value={kpiId}
              kpis={kpis}
              onChange={(value) =>
                setSearchParams({
                  kpi: value,
                  persona,
                })
              }
            />
          </div>
        </div>
      </header>

      {/* ============================================================
          STATUS, merged decision outcome + uncertainty warning
          into one compact, collapsible banner (was two separate
          boxes competing for attention)
      ============================================================ */}

      <StatusBanner
        data={data}
        decision={decision}
        DecisionIcon={DecisionIcon}
        kpiId={kpiId}
        navigate={navigate}
      />

      {/* ============================================================
          INTELLIGENCE TRACE
      ============================================================ */}

      <IntelligenceTrace data={data} />

      {/* ============================================================
          PERSONA CONTENT
      ============================================================ */}

      {persona === "executive" && (
        <ExecutiveBody
          data={data}
          actionData={actionData}
          kpiId={kpiId}
          navigate={navigate}
        />
      )}

      {persona === "operations" && (
        <OperationsBody
          data={data}
          actionData={actionData}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      )}

      {persona === "analyst" && <AnalystBody data={data} />}
    </div>
  );
}

/* ================================================================
   HEADER COMPONENTS
================================================================ */

function KpiSelector({ value, kpis, onChange }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-lg border border-[var(--color-line)] bg-white py-2 pl-3 pr-9 text-sm font-medium text-[var(--color-heading)] shadow-sm outline-none transition hover:border-[var(--color-primary)] focus:border-[var(--color-primary)]"
      >
        {kpis.map((k) => (
          <option key={k.id} value={k.id}>
            {k.name}
          </option>
        ))}
      </select>

      <ChevronDown
        size={15}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-body)]/50"
      />
    </div>
  );
}

function StatusBanner({ data, decision, DecisionIcon, kpiId, navigate }) {
  const positive = decision.tone === "positive";
  const uncertain = [
    "AMBIGUOUS",
    "ABSTAIN",
    "ABSTAIN_INSUFFICIENT_HISTORY",
    "INVESTIGATE_DEEPER",
  ].includes(data.decision);
  const [open, setOpen] = useState(uncertain);

  const tone = uncertain ? "clay" : positive ? "green" : "amber";
  // Depth, not color-fill: white surface + shadow + a colored LEFT
  // ACCENT bar carries the status, the icon square is the only
  // other place color appears. No full color-wash background.
  const accent = { clay: "border-l-[var(--color-clay)]", green: "border-l-[var(--color-green)]", amber: "border-l-[var(--color-amber)]" }[tone];
  const iconBg = { clay: "bg-[var(--color-clay)]", green: "bg-[var(--color-green)]", amber: "bg-[var(--color-amber)]" }[tone];

  const nbi = data.nextBestInvestigation;
  const top = data.topHypothesis;

  return (
    <div className={`mb-8 overflow-hidden rounded-md border border-[var(--color-line)] border-l-[3px] bg-white shadow-sm ${accent}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--color-canvas)]/50"
      >
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg} text-white`}>
          <DecisionIcon size={16} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-body)]/55">
            Investigation outcome
          </div>
          <div className="mt-0.5 truncate text-sm font-semibold text-[var(--color-heading)]">
            {decision.label}
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-body)]/45">Materiality</span>
          <span className="font-mono-num text-base font-bold text-[var(--color-heading)]">{data.materiality.materialityScore ?? "N/A"}</span>
          <span className="text-xs text-[var(--color-body)]/50">/100</span>
        </div>

        {open ? <ChevronDown size={16} className="shrink-0 text-[var(--color-body)]/40" /> : <ChevronRight size={16} className="shrink-0 text-[var(--color-body)]/40" />}
      </button>

      {open && (
        <div className="border-t border-[var(--color-line)] px-4 py-4">
          <p className="max-w-3xl text-xs leading-5 text-[var(--color-body)]">
            {data.decisionReason}
          </p>

          {uncertain && (nbi || top) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {nbi?.hypothesisA && nbi?.hypothesisB && (
                <button
                  type="button"
                  onClick={() => navigate(`/evidence?kpi=${kpiId}`)}
                  className="inline-flex items-center gap-1.5 border border-[var(--color-ink)] bg-[var(--color-ink)] px-3 py-1.5 text-xs font-semibold text-white hover:shadow-sm"
                >
                  <GitBranch size={13} />
                  Compare {nbi.hypothesisA} vs {nbi.hypothesisB}
                </button>
              )}
              {top && (
                <button
                  type="button"
                  onClick={() => navigate(`/evidence?kpi=${kpiId}`)}
                  className="inline-flex items-center gap-1.5 border border-[var(--color-line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-heading)] hover:border-[var(--color-primary)]/40 hover:shadow-sm"
                >
                  <Check size={13} />
                  Validate {top.label}
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate("/")}
                className="inline-flex items-center gap-1.5 border border-[var(--color-line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-heading)] hover:border-[var(--color-primary)]/40 hover:shadow-sm"
              >
                <ArrowRight size={13} />
                Compare region performance
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   INTELLIGENCE TRACE
================================================================ */

function IntelligenceTrace({ data }) {
  const [open, setOpen] = useState(false);
  const [expandedStep, setExpandedStep] = useState(null);

  if (!data.intelligenceTrace?.length) return null;

  return (
    <section className="mb-8 overflow-hidden rounded-md border border-[var(--color-line)] bg-white shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[var(--color-canvas)]"
      >
        <div className="flex items-center gap-3">
          <div>
            <div className="text-sm font-semibold text-[var(--color-heading)]">
              Intelligence trace
            </div>

            <div className="text-[10px] text-[var(--color-body)]/50">
              {data.intelligenceTrace.length} verified processing steps
            </div>
          </div>
        </div>

        {open ? (
          <ChevronDown size={17} className="text-[var(--color-body)]/50" />
        ) : (
          <ChevronRight size={17} className="text-[var(--color-body)]/50" />
        )}
      </button>

      {open && (
        <div className="border-t border-[var(--color-line)] bg-[var(--color-canvas)]/40 p-4">
          <div className="grid gap-1">
            {data.intelligenceTrace.map((step, index) => {
              const expanded = expandedStep === step.step;

              return (
                <div key={step.step}>
                  <button
                    onClick={() =>
                      setExpandedStep(expanded ? null : step.step)
                    }
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-white"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--color-green)]/30 bg-[var(--color-green-soft)] text-[var(--color-green)]">
                      <Check size={13} />
                    </span>

                    <span className="w-5 shrink-0 font-mono-num text-[10px] text-[var(--color-body)]/35">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <span className="text-xs font-semibold text-[var(--color-heading)]">
                      {step.module}
                    </span>

                    <span className="hidden text-xs text-[var(--color-body)]/55 sm:inline">
                      {step.description}
                    </span>

                    {step.dataKey && (
                      <span className="ml-auto text-[10px] text-[var(--color-primary)]">
                        {expanded ? "Hide" : "Inspect"}
                      </span>
                    )}
                  </button>

                  {expanded && step.dataKey && (
                    <div className="ml-[72px] mr-3 mb-2 rounded-lg border border-[var(--color-line)] bg-white p-3">
                      <TraceDetail
                        dataKey={step.dataKey}
                        data={data}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function TraceDetail({ dataKey, data }) {
  const base = "text-xs leading-5 text-[var(--color-body)]";

  switch (dataKey) {
    case "materiality":
      return (
        <div className={base}>
          <div>
            Materiality:{" "}
            <strong>{data.materiality.level}</strong>
          </div>

          <div>
            Score:{" "}
            <strong>{data.materiality.materialityScore}/100</strong>
          </div>

          <div>
            Adaptive threshold:{" "}
            <strong>{data.materiality.adaptiveThreshold}%</strong>
          </div>

          <p className="mt-1 text-[var(--color-body)]/60">
            {data.materiality.rationale}
          </p>
        </div>
      );

    case "historicalMemory":
      return (
        <div className={base}>
          {data.novelPattern ? (
            <span>
              No historical match above{" "}
              <strong>{data.historicalMemory.threshold}%</strong>.
              Best match:{" "}
              <strong>
                {data.historicalMemory.ranked[0]?.similarity ?? 0}%
              </strong>
            </span>
          ) : (
            <span>
              Best match:{" "}
              <strong>{data.historicalMemory.best.title}</strong>{" "}
              at {data.historicalMemory.best.similarity}% similarity.
            </span>
          )}
        </div>
      );

    case "driverTree":
      return (
        <div className={base}>
          {data.driverTree.children
            .map(
              (c) =>
                `${c.node.label} (${c.metrics.pctChange}${
                  c.node.composite ? " idx" : "%"
                })`
            )
            .join(" · ")}
        </div>
      );

    case "hypotheses":
      return (
        <div className="space-y-1 text-xs text-[var(--color-body)]">
          {data.hypotheses.slice(0, 5).map((h) => (
            <div key={h.id}>
              <strong>{h.label}</strong>, {h.confidence.overall}% ·{" "}
              {TAG_LABEL[h.causalTag] || h.causalTag}
            </div>
          ))}
        </div>
      );

    case "decision":
      return (
        <div className={base}>
          <strong>{data.decision}.</strong> {data.decisionReason}
        </div>
      );

    case "nextBestInvestigation":
      return (
        <div className={base}>
          {data.nextBestInvestigation?.text}
        </div>
      );

    case "recommendation":
      return (
        <div className={base}>
          {data.recommendation?.actions?.[0]?.contextualRecommendation ||
            "No recommendation generated."}
        </div>
      );

    case "narrative":
      return <div className={base}>{data.narrative}</div>;

    case "personaView":
      return (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap font-mono-num text-[10px] text-[var(--color-body)]">
          {JSON.stringify(data.personaView, null, 2)}
        </pre>
      );

    default:
      return null;
  }
}

/* ================================================================
   HUMANIZATION HELPERS, pure presentation transforms of REAL
   backend numbers into natural phrasing. Never invents a value;
   only chooses how to say a value that's already there. The exact
   number is always still shown alongside the phrase, never hidden.
================================================================ */

function confidencePhrase(pct) {
  if (pct >= 85) return "We're highly confident in this";
  if (pct >= 70) return "We're confident in this";
  if (pct >= 50) return "We're moderately confident in this";
  return "We're not yet confident in this";
}

function magnitudePhrase(pctChange) {
  const abs = Math.abs(Number(pctChange) || 0);
  if (abs >= 12) return "dropped sharply";
  if (abs >= 6) return "dropped noticeably";
  if (abs >= 2) return "shifted somewhat";
  return "moved only slightly";
}

function riskFromPriority(priority) {
  if (priority === "HIGH") return { label: "High risk", tone: "HIGH" };
  if (priority === "MEDIUM") return { label: "Medium risk", tone: "MEDIUM" };
  return { label: "Low risk", tone: "LOW" };
}

/* ================================================================
   EXECUTIVE VIEW, restructured as a hero insight card + two-column
   grid (primary insight flow / sticky decision panel), per the
   "insight-first, not data-dump" brief. Every number below still
   traces to a real backend field (data.topHypothesis, data.hypotheses,
   data.personaView, actionData), only the SENTENCES around them are
   phrased naturally instead of clinically.
================================================================ */

function ExecutiveBody({ data, actionData, kpiId, navigate }) {
  const top = data.topHypothesis;
  const action = actionData?.actions?.[0];
  const negative = Number(data.change) < 0;
  const risk = riskFromPriority(data.priority);
  const topDrivers = data.hypotheses?.slice(0, 5) || [];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px] lg:items-start">

      {/* ============================================
          LEFT, PRIMARY INSIGHT FLOW
      ============================================ */}
      <div className="space-y-6">

        {/* KEY INSIGHT CARD (hero), one clear statement, not a paragraph */}
        <section
          className="bg-white p-7 shadow-sm"
          style={{ borderLeft: `3px solid ${negative ? "var(--color-clay)" : "var(--color-green)"}` }}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-body)]/45">
              Key insight
            </span>
            <NarrativeSourceBadge aiProvider={data.aiProvider} />
          </div>

          <h2 className="font-display text-2xl font-bold leading-snug tracking-tight text-[var(--color-heading)] sm:text-[28px]">
            {top ? `${data.kpiName} ${magnitudePhrase(data.change)}. ${top.label} is the strongest explanation.` : `${data.kpiName} moved ${data.change}%.`}
          </h2>

          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--color-body)]">
            {top ? `${confidencePhrase(top.confidence.overall)} (${top.confidence.overall}%). ${TAG_LABEL[top.causalTag]}.` : data.decisionReason}
            {top?.deltaImpact?.available && <> The business impact: {top.deltaImpact.text}</>}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold ${negative ? "text-[var(--color-clay)]" : "text-[var(--color-green)]"}`}>
                {data.change > 0 ? "+" : ""}{data.change}%
              </span>
              <span className="text-xs text-[var(--color-body)]/50">vs. baseline</span>
            </div>
            {top && (
              <div className="flex items-center gap-2">
                <ConfidenceRing value={top.confidence.overall} tier={top.confidence.tier} size={28} />
                <span className="text-xs text-[var(--color-body)]/50">confidence</span>
              </div>
            )}
          </div>
        </section>

        {/* DRIVER / CAUSE BREAKDOWN, visual, not descriptive */}
        {topDrivers.length > 0 && (
          <section className="border border-[var(--color-line)] bg-white p-6">
            <div className="mb-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-body)]/45">
                What's driving it
              </span>
            </div>
            <div className="space-y-3">
              {topDrivers.map((h) => (
                <div key={h.id || h.label} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 truncate text-xs font-medium text-[var(--color-heading)]" title={h.label}>
                    {h.label}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-canvas)]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${h.confidence.overall}%`, background: TIER_COLOR[h.confidence.tier] || "var(--color-primary)" }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right font-mono-num text-xs font-semibold text-[var(--color-heading)]">
                    {h.confidence.overall}%
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* EVIDENCE, checks and contradictions, not sentences */}
        {top && (top.supporting?.length > 0 || top.contradicting?.length > 0) && (
          <section className="border border-[var(--color-line)] bg-white p-6">
            <div className="mb-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-body)]/45">
                Supporting evidence
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {top.supporting?.map((s, i) => (
                <div key={`s${i}`} className="flex items-start gap-2 text-xs leading-5 text-[var(--color-heading)]">
                  <Check size={13} className="mt-0.5 shrink-0 text-[var(--color-green)]" />
                  {s}
                </div>
              ))}
              {top.contradicting?.map((s, i) => (
                <div key={`c${i}`} className="flex items-start gap-2 text-xs leading-5 text-[var(--color-body)]">
                  <XCircle size={13} className="mt-0.5 shrink-0 text-[var(--color-clay)]" />
                  {s}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ============================================
          RIGHT, DECISION PANEL (sticky)
      ============================================ */}
      <aside className="space-y-4 lg:sticky lg:top-6">

        <section className="border border-[var(--color-line)] bg-white p-5">
          <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-body)]/45">
            Decision
          </div>

          {top && (
            <div className="mb-5 flex flex-col items-center border-b border-[var(--color-line)] pb-5 text-center">
              <ConfidenceRing value={top.confidence.overall} tier={top.confidence.tier} size={72} />
              <div className="mt-2 text-xs font-semibold text-[var(--color-heading)]">{top.confidence.tier} confidence</div>
            </div>
          )}

          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs text-[var(--color-body)]/55">Risk level</span>
            <Badge variant={risk.tone}>{risk.label}</Badge>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs text-[var(--color-body)]/55">Region</span>
            <span className="text-xs font-semibold text-[var(--color-heading)]">
              {data.region === "all" ? "All regions" : cap(data.region)}
            </span>
          </div>

          <div className="mb-5 flex items-center justify-between">
            <span className="text-xs text-[var(--color-body)]/55">Materiality</span>
            <span className="text-xs font-semibold text-[var(--color-heading)]">{data.materiality.materialityScore ?? "N/A"}/100</span>
          </div>

          {action ? (
            <button
              type="button"
              onClick={() => navigate(`/actions?kpi=${kpiId}`)}
              className="mb-2 flex w-full items-center justify-between gap-2 border border-[var(--color-primary)] bg-[var(--color-primary)] px-4 py-2.5 text-left text-xs font-semibold text-white hover:shadow-sm"
            >
              {action.lever ? `Address ${action.lever}` : "Review recommendation"}
              <ArrowRight size={14} />
            </button>
          ) : top ? (
            <button
              type="button"
              onClick={() => navigate(`/evidence?kpi=${kpiId}`)}
              className="mb-2 flex w-full items-center justify-between gap-2 border border-[var(--color-line)] bg-white px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-heading)] hover:border-[var(--color-primary)]/40 hover:shadow-sm"
            >
              {`Validate ${top.label}`}
              <ArrowRight size={14} />
            </button>
          ) : null}

          {data.nextBestInvestigation && (
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex w-full items-center justify-between gap-2 border border-[var(--color-line)] bg-white px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-heading)] hover:border-[var(--color-primary)]/40 hover:shadow-sm"
            >
              Compare region performance
              <ArrowRight size={14} />
            </button>
          )}

          {action && (
            <div className="mt-4 space-y-2 border-t border-[var(--color-line)] pt-4 text-xs">
              {action.owner && (
                <div className="flex items-center gap-2 text-[var(--color-body)]">
                  <UserRound size={13} className="text-[var(--color-body)]/40" />
                  {action.owner}
                </div>
              )}
              {(action.expectedImpact) && (
                <div className="leading-relaxed text-[var(--color-body)]/70">{action.expectedImpact}</div>
              )}
            </div>
          )}

          {!action && !top && (
            <p className="text-xs leading-relaxed text-[var(--color-body)]/55">{data.decisionReason}</p>
          )}
        </section>
      </aside>
    </div>
  );
}

function ExecutiveMetric({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-white p-5">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-[var(--color-body)]/45">
        <Icon size={14} />
        {label}
      </div>

      <div className="mt-3 text-base font-semibold text-[var(--color-heading)]">
        {value}
      </div>

      <div className="mt-1 text-xs text-[var(--color-body)]/50">
        {sub}
      </div>
    </div>
  );
}

/* ================================================================
   OPERATIONS VIEW
================================================================ */

function OperationsBody({
  data,
  actionData,
  selectedId,
  onSelect,
}) {
  const view = data.personaView;

  return (
    <div className="space-y-8">
      {/* Operational framing */}

      <section className="border border-[var(--color-line)] bg-white p-5 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-body)]/50">
              Operational focus
            </div>

            <div className="text-xl font-bold text-[var(--color-heading)]">
              {view.operationalDriver ||
                "No single driver identified"}
            </div>

            {view.controllableLever && (
              <div className="mt-2 text-sm text-[var(--color-body)]">
                Controllable lever:{" "}
                <strong className="text-[var(--color-heading)]">
                  {view.controllableLever}
                </strong>
              </div>
            )}
          </div>

          <div className="max-w-md border-l-2 border-[var(--color-primary)] pl-4">
            <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-body)]/45">
              Immediate action
            </div>

            <div className="mt-1 text-sm font-semibold leading-6 text-[var(--color-heading)]">
              {view.immediateAction}
            </div>
          </div>
        </div>
      </section>

      {/* Investigation workspace */}

      <section>
        <SectionHeading
          icon={GitBranch}
          title="Driver investigation"
          subtitle="Select a leaf driver to inspect the evidence supporting the current diagnosis."
        />

        <div className="grid overflow-hidden rounded-md border border-[var(--color-line)] bg-white shadow-sm lg:grid-cols-[380px_1fr]">
          <div className="border-b border-[var(--color-line)] bg-[var(--color-canvas)]/50 p-4 lg:border-b-0 lg:border-r">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-body)]/45">
                Driver hierarchy
              </span>

              <span className="text-[10px] text-[var(--color-body)]/40">
                Click leaf to inspect
              </span>
            </div>

            <div className="rounded-lg border border-[var(--color-line)] bg-white p-2">
              <Tree
                node={data.driverTree}
                depth={0}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            </div>
          </div>

          <div className="min-w-0 p-5">
            <EvidencePanel
              hypothesis={data.hypotheses?.find(
                (h) => h.id === selectedId
              )}
            />
          </div>
        </div>
      </section>

      {/* Historical memory */}

      <section>
        <SectionHeading
          icon={History}
          title="Historical context"
          subtitle="Previous scenarios that resemble the current signal."
        />

        <HistoricalMemoryPanel data={data} />
      </section>

      {/* Next best investigation */}

      {data.nextBestInvestigation && (
        <section>
          <SectionHeading
            icon={Search}
            title="Next best investigation"
            subtitle="The most useful additional evidence to reduce uncertainty."
          />

          <div className="border border-[var(--color-primary)]/20 bg-[var(--color-primary-soft)] p-5">
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white">
                <Search size={16} />
              </div>

              <div>
                <div className="text-sm font-semibold text-[var(--color-heading)]">
                  {data.nextBestInvestigation.text}
                </div>

                {data.nextBestInvestigation.discriminatingMetrics?.length >
                  0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {data.nextBestInvestigation.discriminatingMetrics.map(
                      (metric) => (
                        <span
                          key={metric}
                          className="rounded-md bg-white px-2 py-1 font-mono-num text-[10px] text-[var(--color-primary)]"
                        >
                          {metric}
                        </span>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Action */}

      <section>
        <SectionHeading
          icon={Zap}
          title="Recommended action"
          subtitle="Operational response based on the current investigation."
        />

        {data.decision === "RECOMMEND_ACTION" &&
        actionData?.actions?.[0] ? (
          <OperationalActionCard
            action={actionData.actions[0]}
          />
        ) : (
          <div className="border border-[var(--color-line)] bg-white p-5 text-sm text-[var(--color-body)]">
            {data.decisionReason}
          </div>
        )}
      </section>
    </div>
  );
}

/* ================================================================
   ANALYST VIEW
================================================================ */

function AnalystBody({ data }) {
  const view = data.personaView;
  const top = data.topHypothesis;

  return (
    <div className="space-y-8">
      <section className="border border-[var(--color-line)] bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Activity
            size={15}
            className="text-[var(--color-primary)]"
          />

          <span className="text-xs font-bold uppercase tracking-wide text-[var(--color-body)]/50">
            Analytical narrative
          </span>

          <NarrativeSourceBadge aiProvider={data.aiProvider} />
        </div>

        <p className="max-w-4xl text-sm leading-7 text-[var(--color-heading)]">
          {data.narrative}
        </p>
      </section>

      {/* KPI metrics */}

      <section>
        <SectionHeading
          icon={Activity}
          title="KPI signal"
          subtitle="Statistical context behind the detected movement."
        />

        <div className="grid gap-px overflow-hidden border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-3 lg:grid-cols-6">
          <MetricCell
            label="Current"
            value={view.kpiTrend.current}
          />

          <MetricCell
            label="Baseline"
            value={view.kpiTrend.baseline}
          />

          <MetricCell
            label="Change"
            value={`${view.kpiTrend.changePct}%`}
          />

          <MetricCell
            label="Z-score"
            value={view.kpiTrend.zScore}
          />

          <MetricCell
            label="Materiality"
            value={`${view.kpiTrend.materialityScore}/100`}
          />

          <MetricCell
            label="Threshold"
            value={`${view.kpiTrend.adaptiveThreshold}%`}
          />
        </div>

        {view.kpiTrend.trend?.length > 0 ? (
          <div className="mt-px border border-t-0 border-[var(--color-line)] bg-white p-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[var(--color-body)]/45">
              Daily history, last {view.kpiTrend.trend.length} days
            </div>
            <div className="h-32">
              <Line
                data={{
                  labels: view.kpiTrend.trend.map((p) => p.date.slice(5)),
                  datasets: [
                    {
                      data: view.kpiTrend.trend.map((p) => p.value),
                      borderColor: "#3454d1",
                      backgroundColor: "rgba(52, 84, 209, 0.06)",
                      borderWidth: 1.5,
                      pointRadius: 0,
                      pointHoverRadius: 3,
                      tension: 0.25,
                      fill: true,
                    },
                    {
                      data: view.kpiTrend.trend.map(() => view.kpiTrend.baseline),
                      borderColor: "#b0b6c9",
                      borderWidth: 1,
                      borderDash: [4, 4],
                      pointRadius: 0,
                      fill: false,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: { mode: "index", intersect: false },
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: "#0f1729",
                      padding: 8,
                      bodyFont: { size: 10 },
                      displayColors: false,
                    },
                  },
                  scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 8 }, color: "#8a90a6", maxTicksLimit: 6 } },
                    y: { grid: { color: "#e3e6ef" }, ticks: { font: { size: 8 }, color: "#8a90a6" } },
                  },
                }}
              />
            </div>
          </div>
        ) : (
          <div className="mt-px border border-t-0 border-dashed border-[var(--color-line)] bg-[var(--color-paper)] p-4 text-center text-[10px] text-[var(--color-body)]/45">
            Daily history unavailable. Not enough recorded days for this metric.
          </div>
        )}
      </section>

      {/* Driver ranking */}

      <section>
        <SectionHeading
          icon={Layers3}
          title={`Driver ranking (${view.driverRanking.length})`}
          subtitle="Ranked evidence, not causal attribution."
        />

        <div className="border border-[var(--color-line)] bg-white p-4 shadow-sm">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-wide text-[var(--color-body)]/45">
            Confidence vs. contribution weight
          </div>
          <div style={{ height: Math.max(120, view.driverRanking.length * 34) }}>
            <Bar
              data={{
                labels: view.driverRanking.map((h) => h.label),
                datasets: [
                  {
                    label: "Confidence",
                    data: view.driverRanking.map((h) => h.confidence),
                    backgroundColor: view.driverRanking.map((h) => TIER_COLOR[h.tier] || "#3454d1"),
                    borderRadius: 3,
                    barThickness: 10,
                  },
                  {
                    label: "Contribution weight",
                    data: view.driverRanking.map((h) => h.contributionPct),
                    backgroundColor: "#c7cbe0",
                    borderRadius: 3,
                    barThickness: 10,
                  },
                ],
              }}
              options={{
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: "top",
                    align: "start",
                    labels: { boxWidth: 8, font: { size: 10 }, color: "#545b70" },
                  },
                  tooltip: {
                    backgroundColor: "#0f1729",
                    padding: 8,
                    bodyFont: { size: 10 },
                    callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.x}%` },
                  },
                },
                scales: {
                  x: { max: 100, grid: { color: "#e3e6ef" }, ticks: { font: { size: 9 }, color: "#8a90a6" } },
                  y: { grid: { display: false }, ticks: { font: { size: 10 }, color: "#161b2c" } },
                },
              }}
            />
          </div>
        </div>

        <div className="mt-px overflow-x-auto rounded-b-xl border border-t-0 border-[var(--color-line)] bg-white shadow-sm">
          <table className="w-full min-w-[850px] text-left text-xs">
            <thead className="border-b border-[var(--color-line)] bg-[var(--color-canvas)]/60">
              <tr>
                <th className="px-4 py-3 font-semibold">Driver</th>
                <th className="px-4 py-3 font-semibold">
                  Confidence
                </th>
                <th className="px-4 py-3 font-semibold">Tier</th>
                <th className="px-4 py-3 font-semibold">Evidence</th>
                <th className="px-4 py-3 font-semibold">Weight</th>
                <th className="px-4 py-3 font-semibold">Impact</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--color-line)]">
              {view.driverRanking.map((h) => (
                <tr
                  key={h.label}
                  className="hover:bg-[var(--color-canvas)]/50"
                >
                  <td className="px-4 py-3 font-semibold text-[var(--color-heading)]">
                    {h.label}
                  </td>

                  <td
                    className="px-4 py-3 font-mono-num font-semibold"
                    style={{
                      color:
                        TIER_COLOR[h.tier] ||
                        "var(--color-heading)",
                    }}
                  >
                    {h.confidence}%
                  </td>

                  <td className="px-4 py-3">
                    <Badge variant={h.tier}>
                      {h.tier}
                    </Badge>
                  </td>

                  <td className="px-4 py-3 text-[var(--color-body)]">
                    {h.evidenceStrength}
                  </td>

                  <td className="px-4 py-3 font-mono-num">
                    {h.contributionPct}%
                  </td>

                  <td className="px-4 py-3 text-[var(--color-body)]/70">
                    {h.deltaImpact || "N/A"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Confidence */}

      {top && (
        <section>
          <SectionHeading
            icon={Target}
            title={`Confidence assessment: ${top.label}`}
            subtitle="Component scores contributing to the overall confidence."
          />

          <div className="grid gap-6 border border-[var(--color-line)] bg-white p-5 lg:grid-cols-[180px_1fr]">
            <div className="flex flex-col items-center justify-center border-b border-[var(--color-line)] pb-5 lg:border-b-0 lg:border-r lg:pb-0">
              <ConfidenceRing
                value={top.confidence.overall}
                tier={top.confidence.tier}
                size={82}
              />

              <div className="mt-3 text-xs font-semibold text-[var(--color-heading)]">
                {top.confidence.tier} confidence
              </div>
            </div>

            <div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(
                  top.confidence.checks || {}
                ).map(([key, value]) => (
                  <MetricCell
                    key={key}
                    label={key.replace(
                      /([A-Z])/g,
                      " $1"
                    )}
                    value={value}
                  />
                ))}
              </div>

              <p className="mt-5 text-xs leading-5 text-[var(--color-body)]/65">
                {top.confidence.explanation}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Evidence */}

      <section>
        <SectionHeading
          icon={Database}
          title="Evidence explorer"
          subtitle="Source-level evidence used in the ranking."
        />

        <div className="space-y-2">
          {view.evidenceExplorer.slice(0, 5).map((e) => (
            <EvidenceRow key={e.label} evidence={e} />
          ))}
        </div>
      </section>

      {/* Alternatives */}

      {view.alternativeHypotheses?.length > 0 && (
        <section>
          <SectionHeading
            icon={GitBranch}
            title="Alternative hypotheses"
            subtitle="Why other explanations ranked below the leading hypothesis."
          />

          <div className="divide-y divide-[var(--color-line)] border border-[var(--color-line)] bg-white">
            {view.alternativeHypotheses.map((h) => (
              <div
                key={h.label}
                className="p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-sm text-[var(--color-heading)]">
                    {h.label}
                  </span>

                  <span className="font-mono-num text-xs text-[var(--color-body)]/50">
                    {h.confidence}%
                  </span>
                </div>

                <p className="mt-1 text-xs leading-5 text-[var(--color-body)]">
                  {h.whyRankedLower}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Lineage */}

      {view.lineage && (
        <section>
          <SectionHeading
            icon={GitBranch}
            title="Calculation lineage"
          />

          <div className="overflow-x-auto rounded-lg border border-[var(--color-line)] bg-[var(--color-canvas)] p-4">
            <code className="whitespace-nowrap font-mono-num text-xs text-[var(--color-body)]">
              {view.lineage}
            </code>
          </div>
        </section>
      )}
    </div>
  );
}

/* ================================================================
   DRIVER TREE
================================================================ */

function Tree({
  node,
  depth,
  selectedId,
  onSelect,
}) {
  const [open, setOpen] = useState(depth < 2);

  const children = node.children || [];
  const hasChildren = children.length > 0;
  const isLeaf = !hasChildren;
  const isSelected = node.node.id === selectedId;

  const level = node.materiality?.level;
  const material =
    level === "HIGH"
      ? TIER_COLOR.HIGH
      : level === "MEDIUM"
        ? TIER_COLOR.MEDIUM
        : "var(--color-line)";

  return (
    <div>
      <div
        className={`group flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 transition ${
          isSelected
            ? "bg-[var(--color-ink)] text-white"
            : "hover:bg-[var(--color-canvas)]"
        }`}
        style={{
          marginLeft: depth * 17,
        }}
        onClick={() => {
          if (isLeaf) {
            onSelect(node.node.id);
          } else {
            setOpen((v) => !v);
          }
        }}
      >
        {hasChildren ? (
          <span className="flex h-4 w-4 items-center justify-center">
            {open ? (
              <ChevronDown size={13} />
            ) : (
              <ChevronRight size={13} />
            )}
          </span>
        ) : (
          <span
            className="flex h-2.5 w-2.5 shrink-0 rounded-full"
            style={{
              background: material,
            }}
          />
        )}

        <span
          className={`min-w-0 flex-1 truncate text-xs ${
            isSelected
              ? "font-semibold"
              : isLeaf
                ? "font-medium text-[var(--color-heading)]"
                : "text-[var(--color-body)]"
          }`}
        >
          {node.node.label}
        </span>

        <span
          className={`shrink-0 font-mono-num text-[10px] ${
            isSelected
              ? "text-white/60"
              : node.metrics.pctChange < 0
                ? "text-[var(--color-clay)]"
                : "text-[var(--color-green)]"
          }`}
        >
          {node.metrics.pctChange > 0 ? "+" : ""}
          {node.metrics.pctChange}
          {node.node.composite ? " idx" : "%"}
        </span>
      </div>

      {hasChildren &&
        open &&
        children.map((child) => (
          <Tree
            key={child.node.id}
            node={child}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

/* ================================================================
   EVIDENCE PANEL
================================================================ */

function EvidencePanel({ hypothesis }) {
  if (!hypothesis) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-canvas)]">
          <Search
            size={18}
            className="text-[var(--color-body)]/40"
          />
        </div>

        <div className="text-sm font-semibold text-[var(--color-heading)]">
          Select a driver
        </div>

        <p className="mt-1 max-w-xs text-xs leading-5 text-[var(--color-body)]/50">
          Choose a leaf in the driver hierarchy to inspect the evidence behind its ranking.
        </p>
      </div>
    );
  }

  const tier = hypothesis.confidence.tier;
  const color = TIER_COLOR[tier];
  const background = TIER_BG[tier];

  return (
    <div>
      <div className="flex flex-col gap-4 border-b border-[var(--color-line)] pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-body)]/45">
            Selected driver
          </div>

          <h3 className="text-xl font-bold text-[var(--color-heading)]">
            {hypothesis.label}
          </h3>

          <p className="mt-1 max-w-xl text-xs leading-5 text-[var(--color-body)]/60">
            {hypothesis.confidence.explanation}
          </p>
        </div>

        <div
          className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2"
          style={{ background }}
        >
          <ConfidenceRing
            value={hypothesis.confidence.overall}
            tier={tier}
            size={42}
          />

          <div>
            <div
              className="text-sm font-bold"
              style={{ color }}
            >
              {hypothesis.confidence.overall}%
            </div>

            <div
              className="text-[10px] font-semibold uppercase"
              style={{ color }}
            >
              {tier}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-px overflow-hidden border-b border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-4">
        <MetricCell
          label="Source"
          value={hypothesis.structuredEvidence?.source}
        />

        <MetricCell
          label="Change"
          value={hypothesis.structuredEvidence?.change}
        />

        <MetricCell
          label="Alignment"
          value={hypothesis.structuredEvidence?.alignment}
        />

        <MetricCell
          label="Ranking"
          value={`${hypothesis.contributionPct}%`}
        />
      </div>

      <div className="grid gap-6 pt-5 sm:grid-cols-2">
        <EvidenceList
          title="Supporting evidence"
          items={hypothesis.supporting}
          positive
        />

        <EvidenceList
          title="Contradicting evidence"
          items={hypothesis.contradicting}
        />
      </div>
    </div>
  );
}

function EvidenceList({
  title,
  items = [],
  positive = false,
}) {
  return (
    <div>
      <div
        className={`mb-2 flex items-center gap-1.5 text-xs font-bold ${
          positive
            ? "text-[var(--color-green)]"
            : "text-[var(--color-clay)]"
        }`}
      >
        {positive ? (
          <Check size={14} />
        ) : (
          <CircleAlert size={14} />
        )}

        {title}
      </div>

      {items.length ? (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li
              key={index}
              className="flex gap-2 text-xs leading-5 text-[var(--color-body)]"
            >
              <span
                className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${
                  positive
                    ? "bg-[var(--color-green)]"
                    : "bg-[var(--color-clay)]"
                }`}
              />

              {item}
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-xs text-[var(--color-body)]/40">
          No contradictory evidence identified.
        </div>
      )}
    </div>
  );
}

/* ================================================================
   HISTORICAL MEMORY
================================================================ */

function HistoricalMemoryPanel({ data }) {
  if (data.novelPattern) {
    return (
      <div className="border border-[var(--color-clay)]/20 bg-[var(--color-clay-soft)] p-5">
        <div className="flex gap-3">
          <History
            size={17}
            className="mt-0.5 shrink-0 text-[var(--color-clay)]"
          />

          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-[var(--color-clay)]">
              Novel pattern
            </div>

            <p className="mt-1 text-sm leading-6 text-[var(--color-heading)]">
              No historical scenario matched the current fingerprint above{" "}
              {data.historicalMemory.threshold}%.
            </p>

            <div className="mt-2 text-xs text-[var(--color-body)]/60">
              Best available match:{" "}
              {data.historicalMemory.ranked[0]?.similarity ?? 0}%
            </div>
          </div>
        </div>
      </div>
    );
  }

  const best = data.historicalMemory.best;

  return (
    <div className="border border-[var(--color-green)]/20 bg-[var(--color-green-soft)] p-5">
      <div className="flex gap-3">
        <History
          size={17}
          className="mt-0.5 shrink-0 text-[var(--color-green)]"
        />

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[var(--color-heading)]">
              {best.title}
            </span>

            <Badge variant="positive">
              {best.similarity}% similar
            </Badge>

            {best.source === "confirmed" && (
              <Badge variant="primary">
                analyst confirmed
              </Badge>
            )}
          </div>

          <div className="mt-3 grid gap-3 text-xs leading-5 text-[var(--color-body)] sm:grid-cols-3">
            <div>
              <span className="text-[var(--color-body)]/50">
                What happened
              </span>

              <div>{best.whatHappened}</div>
            </div>

            <div>
              <span className="text-[var(--color-body)]/50">
                Action taken
              </span>

              <div>{best.actionTaken}</div>
            </div>

            <div>
              <span className="text-[var(--color-body)]/50">
                Outcome
              </span>

              <div>{best.outcome}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   ACTIONS
================================================================ */

function ActionSummary({ action }) {
  return (
    <div className="border border-[var(--color-primary)]/20 bg-[var(--color-primary-soft)] p-4">
      <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-[var(--color-primary)]">
        <Zap size={13} />
        Recommended response
      </div>

      <div className="text-sm font-semibold leading-5 text-[var(--color-heading)]">
        {action.contextualRecommendation}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[10px] text-[var(--color-body)]">
        <span>
          Owner:{" "}
          <strong>{action.owner}</strong>
        </span>

        <span>
          Confidence:{" "}
          <strong>{action.confidence}%</strong>
        </span>
      </div>
    </div>
  );
}

function OperationalActionCard({ action }) {
  return (
    <div className="border border-[var(--color-line)] bg-white shadow-sm">
      <div className="border-b border-[var(--color-line)] p-5">
        <div className="flex gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white">
            <Zap size={17} />
          </div>

          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-body)]/45">
              Action
            </div>

            <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-[var(--color-heading)]">
              {action.contextualRecommendation}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-px bg-[var(--color-line)] sm:grid-cols-4">
        <MetricCell
          label="Controllable lever"
          value={action.lever}
        />

        <MetricCell
          label="Owner"
          value={action.owner}
        />

        <MetricCell
          label="Confidence"
          value={`${action.confidence}%`}
        />

        <MetricCell
          label="Monitoring"
          value={action.monitoring}
        />
      </div>

      {action.expectedImpact && (
        <div className="border-t border-[var(--color-line)] bg-[var(--color-canvas)]/50 p-4">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-body)]/45">
            Expected impact
          </div>

          <div className="mt-1 text-xs leading-5 text-[var(--color-body)]">
            {action.expectedImpact}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   SMALL COMPONENTS
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

function MetricCell({ label, value }) {
  return (
    <div className="bg-white p-4">
      <div className="text-[9px] font-bold uppercase tracking-wide text-[var(--color-body)]/45">
        {label}
      </div>

      <div className="mt-1.5 break-words font-mono-num text-sm font-semibold text-[var(--color-heading)]">
        {value ?? "N/A"}
      </div>
    </div>
  );
}

function EvidenceRow({ evidence }) {
  return (
    <div className="border border-[var(--color-line)] bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-[var(--color-heading)]">
            {evidence.label}
          </div>

          <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-[var(--color-body)]/55">
            <span>Source: {evidence.source}</span>
            <span>Metric: {evidence.metric}</span>
            <span>Change: {evidence.change}</span>
            <span>Alignment: {evidence.alignment}</span>
          </div>
        </div>

        <span className="shrink-0 font-mono-num text-[10px] text-[var(--color-body)]/45">
          {evidence.timestamp}
        </span>
      </div>

      {(evidence.supporting?.length > 0 ||
        evidence.contradicting?.length > 0) && (
        <div className="mt-3 border-t border-[var(--color-line)] pt-3">
          {evidence.supporting?.map((s, i) => (
            <div
              key={`support-${i}`}
              className="flex gap-2 text-xs leading-5 text-[var(--color-green)]"
            >
              <Check size={13} className="mt-1 shrink-0" />
              {s}
            </div>
          ))}

          {evidence.contradicting?.map((s, i) => (
            <div
              key={`contra-${i}`}
              className="mt-1 flex gap-2 text-xs leading-5 text-[var(--color-clay)]"
            >
              <CircleAlert size={13} className="mt-1 shrink-0" />
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}