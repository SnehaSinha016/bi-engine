import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { PageHeader, Loading, ErrorPanel } from "./Dashboard";
import Badge from "../components/Badge";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  CheckCircle2,
  Clock3,
  Cpu,
  DollarSign,
  Gauge,
  Info,
  Layers3,
  RefreshCw,
  Server,
  Zap,
} from "lucide-react";


/* =========================================================
   PROVIDER CONFIG
========================================================= */

const SOURCE_BADGE = {
  gemini: {
    label: "GEMINI",
    cls: "bg-[var(--color-green-soft)] text-[var(--color-green)]",
  },

  anthropic: {
    label: "CLAUDE",
    cls: "bg-[var(--color-green-soft)] text-[var(--color-green)]",
  },

  "mock-fallback": {
    label: "FALLBACK",
    cls: "bg-[var(--color-amber-soft)] text-[var(--color-amber)]",
  },

  "error-fallback": {
    label: "FALLBACK",
    cls: "bg-[var(--color-amber-soft)] text-[var(--color-amber)]",
  },

  mock: {
    label: "MOCK",
    cls: "bg-[var(--color-canvas)] text-[var(--color-body)]",
  },
};


/* =========================================================
   PAGE
========================================================= */

export default function Telemetry() {
  const { token } = useAuth();

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  async function loadTelemetry(showRefresh = false) {
    if (showRefresh) setRefreshing(true);

    setError(null);

    try {
      const result = await api.telemetry(token);
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadTelemetry();
  }, [token]);

  if (error) return <ErrorPanel message={error} />;
  if (!data) return <Loading />;

  const s = data.summary || {};
  const recent = data.recent || [];

  const anyMock = recent.some(
    (t) =>
      t.narrativeSource === "mock" ||
      t.isMock
  );

  const anyFallback = recent.some(
    (t) =>
      t.narrativeSource === "mock-fallback" ||
      t.narrativeSource === "error-fallback"
  );

  const anyReal = recent.some(
    (t) =>
      t.narrativeSource === "gemini" ||
      t.narrativeSource === "anthropic"
  );

  const providerStatus = anyFallback
    ? "attention"
    : anyReal
      ? "healthy"
      : "demo";


  return (
    <div className="mx-auto w-full max-w-[1400px] pb-12">


      {/* =====================================================
          HEADER
      ===================================================== */}

      <PageHeader
        title="LLM Telemetry"
        subtitle="Runtime performance, provider usage and estimated inference cost"
        right={
          <button
            onClick={() => loadTelemetry(true)}
            disabled={refreshing}
            className="
              inline-flex
              items-center
              gap-2
              rounded-lg
              border
              border-[var(--color-line)]
              bg-white
              px-3
              py-2
              text-[10px]
              font-semibold
              text-[var(--color-body)]
              transition
              hover:border-[var(--color-primary)]/30
              hover:text-[var(--color-primary)]
              disabled:opacity-50
            "
          >
            <RefreshCw
              size={13}
              className={refreshing ? "animate-spin" : ""}
            />

            Refresh
          </button>
        }
      />


      {/* =====================================================
          SYSTEM STATUS
      ===================================================== */}

      <SystemStatus
        status={providerStatus}
        real={anyReal}
        fallback={anyFallback}
        mock={anyMock}
      />


      {/* =====================================================
          KPI SUMMARY
      ===================================================== */}

      <section className="mt-5">

        <SectionHeading
          number="01"
          title="Runtime overview"
          description="Aggregate performance across recent insight-generation calls"
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">

          <MetricCard
            icon={<Activity size={15} />}
            label="Insights generated"
            value={formatNumber(s.count)}
          />

          <MetricCard
            icon={<Clock3 size={15} />}
            label="Average latency"
            value={`${s.avgLatencyMs ?? "N/A"} ms`}
          />

          <MetricCard
            icon={<Cpu size={15} />}
            label="LLM calls / insight"
            value={s.avgLlmCalls ?? "N/A"}
          />

          <MetricCard
            icon={<Zap size={15} />}
            label="Average tokens"
            value={formatNumber(s.avgTokens)}
          />

          <MetricCard
            icon={<DollarSign size={15} />}
            label="Average cost"
            value={
              s.avgCostUsd != null
                ? `$${s.avgCostUsd}`
                : "N/A"
            }
          />

        </div>

      </section>


      {/* =====================================================
          PROVIDER HEALTH
      ===================================================== */}

      <section className="mt-8">

        <SectionHeading
          number="02"
          title="Provider health"
          description="Which execution path produced the recent narratives"
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">

          <ProviderCard
            title="Live provider"
            icon={<Server size={15} />}
            active={anyReal}
            description={
              anyReal
                ? "Gemini or Claude generated recent narratives."
                : "No recent live-provider calls detected."
            }
          />

          <ProviderCard
            title="Fallback path"
            icon={<AlertTriangle size={15} />}
            active={anyFallback}
            warning={anyFallback}
            description={
              anyFallback
                ? "At least one configured provider failed and fallback was triggered."
                : "No provider fallback recorded in recent calls."
            }
          />

          <ProviderCard
            title="Deterministic demo"
            icon={<Layers3 size={15} />}
            active={anyMock && !anyReal}
            description={
              anyMock
                ? "Template-based narration is available for demo execution."
                : "No mock narration recorded in recent calls."
            }
          />

        </div>

      </section>


      {/* =====================================================
          FALLBACK EXPLANATION
      ===================================================== */}

      {anyFallback && (

        <section className="mt-8">

          <div className="rounded-md border border-[var(--color-amber)]/20 bg-[var(--color-amber-soft)]/30 p-4">

            <div className="flex gap-3">

              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-amber-soft)] text-[var(--color-amber)]">

                <AlertTriangle size={16} />

              </div>

              <div>

                <div className="text-xs font-semibold text-[var(--color-heading)]">
                  Fallback execution detected
                </div>

                <p className="mt-1 max-w-4xl text-[10px] leading-5 text-[var(--color-body)]/60">

                  A configured real provider failed during at least one
                  recent call. The system continued with the deterministic
                  narrator instead of exposing the provider failure to the
                  user.

                </p>

                <div className="mt-2 flex items-center gap-2 text-[9px] text-[var(--color-body)]/45">

                  <Info size={11} />

                  Quantitative calculations remain unaffected; only the
                  narrative generation path changed.

                </div>

              </div>

            </div>

          </div>

        </section>

      )}


      {/* =====================================================
          MOCK ENVIRONMENT
      ===================================================== */}

      {anyMock && !anyReal && (

        <section className="mt-8">

          <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] p-4">

            <div className="flex gap-3">

              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-canvas)] text-[var(--color-body)]/50">

                <Bot size={16} />

              </div>

              <div>

                <div className="text-xs font-semibold text-[var(--color-heading)]">
                  Deterministic demo narrator
                </div>

                <p className="mt-1 max-w-4xl text-[10px] leading-5 text-[var(--color-body)]/55">

                  No recent Gemini or Claude execution is visible.
                  Narratives are template-filled from precomputed facts.
                  Latency represents local execution time and cost is
                  fixed at $0.00.

                </p>

              </div>

            </div>

          </div>

        </section>

      )}


      {/* =====================================================
          RECENT CALLS
      ===================================================== */}

      <section className="mt-8">

        <SectionHeading
          number="03"
          title="Recent insight calls"
          description={`${recent.length} recent executions returned by the telemetry service`}
        />


        <div className="overflow-hidden rounded-md border border-[var(--color-line)] bg-white">

          {/* TABLE HEADER */}

          <div className="hidden grid-cols-[1.1fr_1.2fr_0.8fr_0.8fr_1fr_0.7fr_0.8fr_0.8fr] gap-3 border-b border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-3 md:grid">

            <TableHeader label="Time" />
            <TableHeader label="Insight" />
            <TableHeader label="Region" />
            <TableHeader label="Source" />
            <TableHeader label="Model" />
            <TableHeader label="Tokens" />
            <TableHeader label="Latency" />
            <TableHeader label="Cost" />

          </div>


          {/* ROWS */}

          <div className="divide-y divide-[var(--color-line)]">

            {recent.length === 0 ? (

              <div className="px-5 py-10 text-center text-xs text-[var(--color-body)]/40">
                No recent telemetry records available.
              </div>

            ) : (

              recent.map((t) => (

                <TelemetryRow
                  key={t.id}
                  item={t}
                />

              ))

            )}

          </div>

        </div>


        {recent.some((t) => t.tokensAreEstimated) && (

          <div className="mt-2 flex items-center gap-1.5 text-[9px] text-[var(--color-body)]/35">

            <Info size={10} />

            Estimated token values use a character-length heuristic,
            not a provider tokenizer.

          </div>

        )}

      </section>


      {/* =====================================================
          ARCHITECTURE NOTE
      ===================================================== */}

      <section className="mt-8">

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">

          <ArchitectureItem
            icon={<Gauge size={14} />}
            title="Calculation layer"
            text="Quantitative results are computed independently from the LLM."
          />

          <ArchitectureItem
            icon={<Bot size={14} />}
            title="Narrative layer"
            text="LLMs are used for interpretation and presentation only."
          />

          <ArchitectureItem
            icon={<ShieldIcon />}
            title="Failure handling"
            text="Provider failures fall back without changing computed results."
          />

        </div>

      </section>


      {/* FOOTNOTE */}

      <div className="mt-8 border-t border-[var(--color-line)] pt-4 text-[9px] text-[var(--color-body)]/35">

        Telemetry reflects the execution path recorded by the application
        runtime. Cost and token values may be estimates depending on the
        configured provider.

      </div>

    </div>
  );
}


/* =========================================================
   SYSTEM STATUS
========================================================= */

function SystemStatus({
  status,
  real,
  fallback,
  mock,
}) {

  const healthy = status === "healthy";
  const attention = status === "attention";

  return (
    <div
      className={`flex flex-col gap-3 rounded-md border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
        healthy
          ? "border-[var(--color-green)]/20 bg-[var(--color-green-soft)]/30"
          : attention
            ? "border-[var(--color-amber)]/20 bg-[var(--color-amber-soft)]/30"
            : "border-[var(--color-line)] bg-white"
      }`}
    >

      <div className="flex items-start gap-3">

        <div
          className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg ${
            healthy
              ? "bg-[var(--color-green-soft)] text-[var(--color-green)]"
              : attention
                ? "bg-[var(--color-amber-soft)] text-[var(--color-amber)]"
                : "bg-[var(--color-canvas)] text-[var(--color-body)]/50"
          }`}
        >

          {healthy ? (
            <CheckCircle2 size={14} />
          ) : attention ? (
            <AlertTriangle size={14} />
          ) : (
            <Bot size={14} />
          )}

        </div>


        <div>

          <div className="text-xs font-semibold text-[var(--color-heading)]">

            {healthy
              ? "Narrative service operational"
              : attention
                ? "Narrative service operating with fallback"
                : "Deterministic demo environment"}

          </div>

          <div className="mt-0.5 text-[9px] text-[var(--color-body)]/50">

            {real && "Live provider activity detected"}
            {real && fallback && " · "}
            {fallback && "Fallback activity detected"}
            {!real && !fallback && mock && "Template-based narration active"}

          </div>

        </div>

      </div>


      <div className="flex items-center gap-1.5">

        {real && (
          <span className="rounded-md bg-[var(--color-green-soft)] px-2 py-1 text-[8px] font-semibold text-[var(--color-green)]">
            LIVE
          </span>
        )}

        {fallback && (
          <span className="rounded-md bg-[var(--color-amber-soft)] px-2 py-1 text-[8px] font-semibold text-[var(--color-amber)]">
            FALLBACK
          </span>
        )}

        {!real && mock && (
          <span className="rounded-md bg-[var(--color-canvas)] px-2 py-1 text-[8px] font-semibold text-[var(--color-body)]">
            DEMO
          </span>
        )}

      </div>

    </div>
  );
}


/* =========================================================
   METRIC CARD
========================================================= */

function MetricCard({
  icon,
  label,
  value,
}) {

  return (
    <div className="rounded-md border border-[var(--color-line)] bg-white p-4">

      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-canvas)] text-[var(--color-body)]/50">
        {icon}
      </div>

      <div className="mt-4 text-[8px] font-semibold uppercase tracking-[0.1em] text-[var(--color-body)]/35">
        {label}
      </div>

      <div className="mt-1 font-mono-num text-2xl font-semibold tracking-tight text-[var(--color-heading)]">
        {value}
      </div>

    </div>
  );
}


/* =========================================================
   PROVIDER CARD
========================================================= */

function ProviderCard({
  title,
  icon,
  active,
  warning,
  description,
}) {

  return (
    <div
      className={`rounded-md border bg-white p-4 ${
        warning
          ? "border-[var(--color-amber)]/20"
          : "border-[var(--color-line)]"
      }`}
    >

      <div className="flex items-center justify-between">

        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-canvas)] text-[var(--color-body)]/50">
          {icon}
        </div>

        <span
          className={`h-2 w-2 rounded-full ${
            warning
              ? "bg-[var(--color-amber)]"
              : active
                ? "bg-[var(--color-green)]"
                : "bg-[var(--color-body)]/20"
          }`}
        />

      </div>

      <div className="mt-4 text-xs font-semibold text-[var(--color-heading)]">
        {title}
      </div>

      <p className="mt-1 text-[9px] leading-5 text-[var(--color-body)]/50">
        {description}
      </p>

    </div>
  );
}


/* =========================================================
   TELEMETRY ROW
========================================================= */

function TelemetryRow({
  item,
}) {

  const src =
    SOURCE_BADGE[item.narrativeSource] ||
    (item.isMock
      ? SOURCE_BADGE.mock
      : SOURCE_BADGE.anthropic);

  return (
    <div className="px-4 py-3 transition-colors hover:bg-[var(--color-paper)]">

      {/* DESKTOP */}

      <div className="hidden grid-cols-[1.1fr_1.2fr_0.8fr_0.8fr_1fr_0.7fr_0.8fr_0.8fr] items-center gap-3 md:grid">

        <div className="font-mono-num text-[9px] text-[var(--color-body)]/60">
          {formatTime(item.timestamp)}
        </div>

        <div className="truncate text-[10px] font-medium text-[var(--color-heading)]">
          {item.insightType}
        </div>

        <div className="text-[9px] text-[var(--color-body)]/60">
          {item.region}
        </div>

        <div>

          <span
            className={`rounded-md px-2 py-1 text-[8px] font-semibold ${src.cls}`}
            title={item.fallbackReason || undefined}
          >
            {src.label}
          </span>

        </div>

        <div className="truncate font-mono-num text-[9px] text-[var(--color-body)]/60">
          {item.model}
        </div>

        <div className="font-mono-num text-[9px] text-[var(--color-body)]/60">
          {item.totalTokens}
          {item.tokensAreEstimated ? "*" : ""}
        </div>

        <div className="font-mono-num text-[9px] text-[var(--color-body)]/60">
          {item.latencyMs}ms
        </div>

        <div className="font-mono-num text-[9px] text-[var(--color-body)]/60">
          {item.costLabel || `$${item.estimatedCostUsd}`}
        </div>

      </div>


      {/* MOBILE */}

      <div className="md:hidden">

        <div className="flex items-start justify-between gap-3">

          <div>

            <div className="text-[10px] font-semibold text-[var(--color-heading)]">
              {item.insightType}
            </div>

            <div className="mt-1 font-mono-num text-[8px] text-[var(--color-body)]/40">
              {formatTime(item.timestamp)} · {item.region}
            </div>

          </div>

          <span
            className={`rounded-md px-2 py-1 text-[8px] font-semibold ${src.cls}`}
            title={item.fallbackReason || undefined}
          >
            {src.label}
          </span>

        </div>


        <div className="mt-3 grid grid-cols-3 gap-3 border-t border-[var(--color-line)] pt-3">

          <MobileMetric
            label="Model"
            value={item.model}
          />

          <MobileMetric
            label="Latency"
            value={`${item.latencyMs}ms`}
          />

          <MobileMetric
            label="Cost"
            value={
              item.costLabel ||
              `$${item.estimatedCostUsd}`
            }
          />

        </div>

      </div>

    </div>
  );
}


/* =========================================================
   MOBILE METRIC
========================================================= */

function MobileMetric({
  label,
  value,
}) {

  return (
    <div>

      <div className="text-[7px] font-semibold uppercase tracking-[0.08em] text-[var(--color-body)]/30">
        {label}
      </div>

      <div className="mt-1 truncate font-mono-num text-[9px] text-[var(--color-body)]/60">
        {value}
      </div>

    </div>
  );
}


/* =========================================================
   ARCHITECTURE ITEM
========================================================= */

function ArchitectureItem({
  icon,
  title,
  text,
}) {

  return (
    <div className="rounded-md border border-[var(--color-line)] bg-white p-4">

      <div className="flex items-center gap-2">

        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-canvas)] text-[var(--color-body)]/50">
          {icon}
        </div>

        <div className="text-[10px] font-semibold text-[var(--color-heading)]">
          {title}
        </div>

      </div>

      <p className="mt-3 text-[9px] leading-5 text-[var(--color-body)]/50">
        {text}
      </p>

    </div>
  );
}


/* =========================================================
   SECTION HEADING
========================================================= */

function SectionHeading({
  number,
  title,
  description,
}) {

  return (
    <div className="mb-3 flex items-start gap-3">

      <span className="pt-0.5 font-mono-num text-[9px] text-[var(--color-body)]/25">
        {number}
      </span>

      <div>

        <h2 className="text-sm font-semibold text-[var(--color-heading)]">
          {title}
        </h2>

        <p className="mt-0.5 text-[9px] text-[var(--color-body)]/45">
          {description}
        </p>

      </div>

    </div>
  );
}


/* =========================================================
   TABLE HEADER
========================================================= */

function TableHeader({
  label,
}) {

  return (
    <div className="text-[8px] font-semibold uppercase tracking-[0.08em] text-[var(--color-body)]/35">
      {label}
    </div>
  );
}


/* =========================================================
   HELPERS
========================================================= */

function formatNumber(value) {

  if (value == null) return "N/A";

  if (typeof value === "number") {
    return value.toLocaleString("en-IN");
  }

  return value;
}


function formatTime(timestamp) {

  if (!timestamp) return "N/A";

  try {
    return timestamp.slice(11, 19);
  } catch {
    return timestamp;
  }
}


function ShieldIcon() {
  return (
    <span className="text-[11px] font-semibold">
      RB
    </span>
  );
}