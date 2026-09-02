import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Database,
  GitBranch,
  History,
  Info,
  Search,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  UserRound,
  Zap,
} from "lucide-react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { Loading, ErrorPanel, cap } from "./Dashboard";
import ConfidenceRing from "../components/ConfidenceRing";
import Badge from "../components/Badge";
import { NarrativeSourceBadge } from "../components/UI";


export default function KpiStory() {
  const { kpiId = "revenue" } = useParams();
  const { token, region, user } = useAuth();

  const [personas, setPersonas] = useState([]);
  const [persona, setPersona] = useState(
    user?.role === "executive"
      ? "executive"
      : user?.role === "analyst"
        ? "analyst"
        : "operations"
  );

  const [data, setData] = useState(null);
  const [actionData, setActionData] = useState(null);
  const [error, setError] = useState(null);
  const [proposeStatus, setProposeStatus] = useState(null);

  useEffect(() => {
    api.metaPersonas(token).then(setPersonas).catch(() => {});
  }, [token]);

  useEffect(() => {
    setData(null);
    setActionData(null);
    setError(null);
    setProposeStatus(null);

    api
      .kpiStory(token, kpiId, region, persona)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [token, region, kpiId, persona]);

  useEffect(() => {
    if (!data) return;

    if (data.decision === "RECOMMEND_ACTION") {
      api
        .actions(token, kpiId, data.region)
        .then(setActionData)
        .catch(() => {});
    }
  }, [data, token, kpiId]);

  if (error) return <ErrorPanel message={error} />;
  if (!data) return <Loading />;

  async function proposeToMemory() {
    setProposeStatus("Saving...");

    try {
      await api.proposeScenario(token, kpiId, data.region);
      setProposeStatus("Scenario proposed for analyst confirmation.");
    } catch (e) {
      setProposeStatus("Error: " + e.message);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] pb-12">

      {/* =====================================================
          TOP HEADER
      ===================================================== */}

      <header className="mb-6 border-b border-[var(--color-line)] pb-5">

        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

          <div>

            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-body)]/45">

              <span>Investigations</span>

              <span>/</span>

              <span>{cap(kpiId)}</span>

            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-heading)]">
              {data.kpiName || cap(kpiId)}
            </h1>

            <p className="mt-1.5 text-sm text-[var(--color-body)]/60">
              KPI investigation and decision analysis
            </p>

          </div>


          {/* PERSONA */}

          <div className="flex items-center gap-2">

            <span className="hidden text-[10px] font-medium text-[var(--color-body)]/45 sm:block">
              View
            </span>

            <div className="flex rounded-lg border border-[var(--color-line)] bg-white p-1">

              {personas.map((p) => {

                const id = p.id || p;
                const label = p.label || p;

                return (
                  <button
                    key={id}
                    onClick={() => setPersona(id)}
                    className={`
                      rounded-md px-3 py-1.5 text-[10px] font-semibold transition
                      ${
                        persona === id
                          ? "bg-[var(--color-ink)] text-white"
                          : "text-[var(--color-body)] hover:bg-[var(--color-canvas)]"
                      }
                    `}
                  >
                    {label}
                  </button>
                );
              })}

            </div>

          </div>

        </div>

      </header>


      {/* =====================================================
          KPI SUMMARY
      ===================================================== */}

      <KpiSummary data={data} />


      {/* =====================================================
          INVESTIGATION STATUS
      ===================================================== */}

      <InvestigationStatus data={data} />


      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">

        <main className="min-w-0 space-y-6">

          <ExplanationSection
            data={data}
            kpiId={kpiId}
          />

          <TrendSection data={data} />

          <HypothesesSection data={data} />

          <HistoricalSection data={data} />

          <UncertaintySection data={data} />

          {data.nextBestInvestigation && (
            <NextInvestigation
              data={data.nextBestInvestigation}
            />
          )}

          <DecisionSection
            data={data}
            actionData={actionData}
            kpiId={kpiId}
            proposeToMemory={proposeToMemory}
            proposeStatus={proposeStatus}
          />

        </main>


        {/* =================================================
            RIGHT INFORMATION PANEL
        ================================================= */}

        <aside className="space-y-6">

          <ConfidencePanel data={data} />

          <DataQualityPanel data={data} />

          <QuickLinks kpiId={kpiId} />

        </aside>

      </div>


      {/* =====================================================
          METHODS
      ===================================================== */}

      <Methods data={data} />

    </div>
  );
}


/* =========================================================
   KPI SUMMARY
========================================================= */

function KpiSummary({ data }) {

  const negative = data.change < 0;

  return (
    <section className="rounded-md border border-[var(--color-line)] bg-white">

      <div className="grid grid-cols-1 divide-y divide-[var(--color-line)] lg:grid-cols-[1.5fr_1fr_1fr_1fr] lg:divide-x lg:divide-y-0">

        {/* KPI */}

        <div className="p-5">

          <div className="mb-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-body)]/45">
            Current performance
          </div>

          <div className="flex items-end gap-4">

            <div className="font-mono-num text-4xl font-semibold tracking-tight text-[var(--color-heading)]">
              {formatValue(data.currentValue)}
            </div>

            <div
              className={`mb-1 flex items-center gap-1 text-sm font-semibold ${
                negative
                  ? "text-[var(--color-clay)]"
                  : "text-[var(--color-green)]"
              }`}
            >
              {negative ? (
                <TrendingDown size={15} />
              ) : (
                <TrendingUp size={15} />
              )}

              {data.change > 0 ? "+" : ""}
              {data.change}%
            </div>

          </div>

          <div className="mt-1 text-[10px] text-[var(--color-body)]/45">
            versus historical baseline of{" "}
            <span className="font-mono-num">
              {formatValue(data.baseline)}
            </span>
          </div>

        </div>


        {/* REGION */}

        <SummaryMetric
          label="Region"
          value={
            data.region === "all"
              ? "All regions"
              : cap(data.region)
          }
          icon={<Target size={14} />}
        />


        {/* MATERIALITY */}

        <SummaryMetric
          label="Materiality"
          value={`${data.materiality.materialityScore}/100`}
          icon={<Activity size={14} />}
          sublabel={
            data.materiality.isMaterial
              ? "Requires investigation"
              : "Within expected range"
          }
        />


        {/* FRESHNESS */}

        <SummaryMetric
          label="Data freshness"
          value={`${data.dataQuality?.overall ?? "N/A"}/100`}
          icon={<Clock3 size={14} />}
          sublabel="Source quality"
        />

      </div>

    </section>
  );
}


function SummaryMetric({
  label,
  value,
  icon,
  sublabel,
}) {

  return (
    <div className="flex items-center gap-3 p-5">

      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-canvas)] text-[var(--color-body)]/60">
        {icon}
      </div>

      <div className="min-w-0">

        <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--color-body)]/40">
          {label}
        </div>

        <div className="mt-0.5 font-mono-num text-base font-semibold text-[var(--color-heading)]">
          {value}
        </div>

        {sublabel && (
          <div className="mt-0.5 truncate text-[9px] text-[var(--color-body)]/45">
            {sublabel}
          </div>
        )}

      </div>

    </div>
  );
}


/* =========================================================
   INVESTIGATION STATUS
========================================================= */

function InvestigationStatus({ data }) {

  const config = getDecisionConfig(data);

  return (
    <div
      className={`mt-4 flex flex-col gap-3 rounded-md border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${config.container}`}
    >

      <div className="flex items-start gap-3">

        <div className={`mt-0.5 ${config.iconColor}`}>
          {config.icon}
        </div>

        <div>

          <div className={`text-xs font-semibold ${config.titleColor}`}>
            {config.title}
          </div>

          <div className="mt-0.5 text-[10px] leading-relaxed text-[var(--color-body)]/60">
            {config.description}
          </div>

        </div>

      </div>


      <div className="shrink-0">

        <Badge variant={config.badge}>
          {data.decision?.replaceAll("_", " ")}
        </Badge>

      </div>

    </div>
  );
}


/* =========================================================
   EXPLANATION
========================================================= */

function ExplanationSection({
  data,
  kpiId,
}) {

  return (
    <Panel>

      <PanelHeader
        number="01"
        title="Investigation summary"
        icon={<Search size={15} />}
        action={
          <Link
            to={`/tree?kpi=${kpiId}`}
            className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--color-primary)] hover:underline"
          >
            Open driver tree
            <ArrowRight size={12} />
          </Link>
        }
      />

      <div className="mb-4 flex items-center justify-between">

        <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--color-body)]/40">
          Automated analysis
        </span>

        <NarrativeSourceBadge
          aiProvider={data.aiProvider}
        />

      </div>

      <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4">

        <p className="text-sm leading-7 text-[var(--color-heading)]">
          {data.narrative}
        </p>

      </div>


      {data.driverTree?.children?.length > 0 && (

        <div className="mt-5">

          <div className="mb-3 flex items-center justify-between">

            <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--color-body)]/40">
              Contributing drivers
            </div>

            <Link
              to={`/tree?kpi=${kpiId}`}
              className="text-[9px] font-medium text-[var(--color-body)]/45 hover:text-[var(--color-primary)]"
            >
              View all
            </Link>

          </div>


          <div className="overflow-hidden rounded-lg border border-[var(--color-line)]">

            {data.driverTree.children
              .slice()
              .sort(
                (a, b) =>
                  Math.abs(b.metrics.pctChange) -
                  Math.abs(a.metrics.pctChange)
              )
              .map((child, index) => {

                const negative =
                  child.metrics.pctChange < 0;

                return (
                  <div
                    key={child.node.id}
                    className="flex items-center gap-4 border-b border-[var(--color-line)] px-4 py-3 last:border-0"
                  >

                    <div className="w-5 font-mono-num text-[9px] text-[var(--color-body)]/30">
                      {String(index + 1).padStart(2, "0")}
                    </div>

                    <div className="min-w-0 flex-1">

                      <div className="text-xs font-semibold text-[var(--color-heading)]">
                        {child.node.label}
                      </div>

                    </div>

                    <div
                      className={`flex items-center gap-1 font-mono-num text-xs font-semibold ${
                        negative
                          ? "text-[var(--color-clay)]"
                          : "text-[var(--color-green)]"
                      }`}
                    >

                      {negative ? (
                        <TrendingDown size={12} />
                      ) : (
                        <TrendingUp size={12} />
                      )}

                      {child.metrics.pctChange > 0
                        ? "+"
                        : ""}
                      {child.metrics.pctChange}
                      {child.node.composite
                        ? " idx"
                        : "%"}

                    </div>

                  </div>
                );
              })}

          </div>

        </div>

      )}

    </Panel>
  );
}


/* =========================================================
   TREND, real daily history from data.trend (see
   investigationOrchestrator.js), never fabricated. Chart.js line
   chart with a baseline reference line, following the same
   Panel/PanelHeader shell as every other section on this page.
========================================================= */

function TrendSection({ data }) {
  const trend = data.trend;

  return (
    <Panel>
      <PanelHeader
        number="02"
        title="Trend"
        icon={<TrendingUp size={15} />}
      />

      {!trend || trend.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-line)] bg-[var(--color-paper)] p-6 text-center text-xs text-[var(--color-body)]/50">
          {data.materiality?.insufficientHistory
            ? "Trend data unavailable. Not enough historical days recorded yet for this metric."
            : "Trend data unavailable for this metric."}
        </div>
      ) : (
        <>
          <div className="h-56">
            <Line
              data={{
                labels: trend.map((p) => p.date.slice(5)),
                datasets: [
                  {
                    label: data.kpiName,
                    data: trend.map((p) => p.value),
                    borderColor: "#3454d1",
                    backgroundColor: "rgba(52, 84, 209, 0.08)",
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0.25,
                    fill: true,
                  },
                  {
                    label: "Baseline",
                    data: trend.map(() => data.baseline),
                    borderColor: "#b0b6c9",
                    borderWidth: 1,
                    borderDash: [4, 4],
                    pointRadius: 0,
                    tension: 0,
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
                    padding: 10,
                    titleFont: { size: 11 },
                    bodyFont: { size: 11 },
                    callbacks: {
                      label: (ctx) => `${ctx.dataset.label}: ${formatValue(ctx.parsed.y)}`,
                    },
                  },
                },
                scales: {
                  x: {
                    grid: { display: false },
                    ticks: { font: { size: 9 }, color: "#8a90a6", maxTicksLimit: 8 },
                  },
                  y: {
                    grid: { color: "#e3e6ef" },
                    ticks: { font: { size: 9 }, color: "#8a90a6" },
                  },
                },
              }}
            />
          </div>
          <div className="mt-3 flex items-center gap-4 text-[9px] font-medium text-[var(--color-body)]/50">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded-full" style={{ background: "#3454d1" }} />
              {data.kpiName}, last {trend.length} days
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded-full border-t border-dashed" style={{ borderColor: "#b0b6c9" }} />
              Baseline ({formatValue(data.baseline)})
            </span>
          </div>
        </>
      )}
    </Panel>
  );
}


/* =========================================================
   HYPOTHESES
========================================================= */

function HypothesesSection({ data }) {

  return (
    <Panel>

      <PanelHeader
        number="03"
        title="Root-cause hypotheses"
        icon={<GitBranch size={15} />}
      />

      <div className="mb-4 flex items-center justify-between">

        <span className="text-[10px] text-[var(--color-body)]/50">
          Ranked by evidence strength and confidence
        </span>

        <span className="font-mono-num text-[9px] text-[var(--color-body)]/40">
          {data.hypotheses.length} hypotheses
        </span>

      </div>


      <div className="overflow-hidden rounded-lg border border-[var(--color-line)]">

        {data.hypotheses.map((h, index) => {

          const isTop = index === 0;

          return (
            <div
              key={h.id}
              className={`
                border-b border-[var(--color-line)] p-4 last:border-0
                ${isTop ? "bg-[var(--color-primary-soft)]/25" : "bg-white"}
              `}
            >

              <div className="flex gap-4">

                <div
                  className={`
                    flex h-7 w-7 shrink-0 items-center justify-center rounded-md
                    font-mono-num text-[10px] font-semibold
                    ${
                      isTop
                        ? "bg-[var(--color-primary)] text-white"
                        : "bg-[var(--color-canvas)] text-[var(--color-body)]/50"
                    }
                  `}
                >
                  {index + 1}
                </div>


                <div className="min-w-0 flex-1">

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                    <div>

                      <div className="text-sm font-semibold text-[var(--color-heading)]">
                        {h.label}
                      </div>

                      <div className="mt-1 text-[9px] text-[var(--color-body)]/45">
                        Contribution to ranking:{" "}
                        <span className="font-mono-num">
                          {h.contributionPct}%
                        </span>
                      </div>

                    </div>

                    <ConfidenceRing
                      value={h.confidence.overall}
                      tier={h.confidence.tier}
                    />

                  </div>


                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">

                    <EvidenceList
                      title="Supporting evidence"
                      items={h.supporting}
                      positive
                    />

                    <EvidenceList
                      title="Contradicting evidence"
                      items={h.contradicting}
                    />

                  </div>

                </div>

              </div>

            </div>
          );
        })}

      </div>

    </Panel>
  );
}


function EvidenceList({
  title,
  items,
  positive = false,
}) {

  return (
    <div>

      <div
        className={`mb-2 text-[9px] font-semibold uppercase tracking-[0.08em] ${
          positive
            ? "text-[var(--color-green)]"
            : "text-[var(--color-clay)]"
        }`}
      >
        {title}
      </div>

      {items?.length > 0 ? (

        <div className="space-y-1.5">

          {items.slice(0, 3).map((item, index) => (

            <div
              key={index}
              className="flex gap-2 text-[10px] leading-relaxed text-[var(--color-body)]/65"
            >

              {positive ? (
                <CheckCircle2
                  size={12}
                  className="mt-0.5 shrink-0 text-[var(--color-green)]"
                />
              ) : (
                <AlertCircle
                  size={12}
                  className="mt-0.5 shrink-0 text-[var(--color-clay)]"
                />
              )}

              <span>{item}</span>

            </div>

          ))}

        </div>

      ) : (

        <span className="text-[10px] text-[var(--color-body)]/35">
          None identified
        </span>

      )}

    </div>
  );
}


/* =========================================================
   HISTORICAL MEMORY
========================================================= */

function HistoricalSection({ data }) {

  const memory = data.historicalMemory;

  return (
    <Panel>

      <PanelHeader
        number="04"
        title="Historical context"
        icon={<History size={15} />}
      />


      {data.novelPattern ? (

        <div className="flex gap-3 rounded-lg border border-[var(--color-clay)]/20 bg-[var(--color-clay-soft)] p-4">

          <AlertCircle
            size={16}
            className="mt-0.5 shrink-0 text-[var(--color-clay)]"
          />

          <div>

            <div className="text-xs font-semibold text-[var(--color-clay)]">
              Novel pattern
            </div>

            <p className="mt-1 text-[10px] leading-relaxed text-[var(--color-body)]/65">
              No sufficiently similar historical scenario was found.
              Best available match:{" "}
              {memory?.best?.similarity ?? 0}%.
            </p>

          </div>

        </div>

      ) : memory?.best ? (

        <div className="rounded-lg border border-[var(--color-green)]/20 bg-[var(--color-green-soft)] p-4">

          <div className="flex items-start justify-between gap-4">

            <div>

              <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--color-green)]">
                Historical match
              </div>

              <div className="mt-1 text-sm font-semibold text-[var(--color-heading)]">
                {memory.best.title}
              </div>

            </div>

            <span className="font-mono-num text-sm font-semibold text-[var(--color-green)]">
              {memory.best.similarity}%
            </span>

          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 text-[10px] sm:grid-cols-3">

            <HistoryValue
              label="Date"
              value={String(memory.best.date || "").slice(0, 10)}
            />

            <HistoryValue
              label="Driver"
              value={memory.best.suspectedDriver}
            />

            <HistoryValue
              label="Outcome"
              value={memory.best.outcome}
            />

          </div>

        </div>

      ) : (

        <div className="rounded-lg bg-[var(--color-paper)] p-4 text-xs text-[var(--color-body)]/50">
          No historical scenario is available for comparison.
        </div>

      )}


      <Link
        to="/memory"
        className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--color-primary)] hover:underline"
      >
        Open Business Memory
        <ArrowRight size={12} />
      </Link>

    </Panel>
  );
}


function HistoryValue({
  label,
  value,
}) {

  return (
    <div>

      <div className="text-[8px] font-semibold uppercase tracking-[0.08em] text-[var(--color-body)]/35">
        {label}
      </div>

      <div className="mt-1 truncate font-medium text-[var(--color-heading)]">
        {value || "N/A"}
      </div>

    </div>
  );
}


/* =========================================================
   UNCERTAINTY
========================================================= */

function UncertaintySection({ data }) {

  const top = data.topHypothesis;

  return (
    <Panel>

      <PanelHeader
        number="05"
        title="Uncertainty & limitations"
        icon={<Info size={15} />}
      />

      <div className="space-y-2">

        {top.contradicting?.map((item, index) => (

          <div
            key={index}
            className="flex gap-2 rounded-lg border border-[var(--color-clay)]/15 bg-[var(--color-clay-soft)]/40 px-3 py-2.5 text-[10px] leading-relaxed text-[var(--color-body)]/70"
          >

            <AlertCircle
              size={12}
              className="mt-0.5 shrink-0 text-[var(--color-clay)]"
            />

            {item}

          </div>

        ))}


        {data.ambiguous && (

          <div className="flex gap-2 rounded-lg border border-[var(--color-primary)]/15 bg-[var(--color-primary-soft)]/40 px-3 py-2.5 text-[10px] leading-relaxed text-[var(--color-body)]/70">

            <Info
              size={12}
              className="mt-0.5 shrink-0 text-[var(--color-primary)]"
            />

            Multiple hypotheses remain plausible. The leading hypothesis
            should not be treated as confirmed.

          </div>

        )}


        {data.novelPattern && (

          <div className="flex gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2.5 text-[10px] leading-relaxed text-[var(--color-body)]/65">

            <History
              size={12}
              className="mt-0.5 shrink-0"
            />

            No sufficiently similar historical precedent was found.

          </div>

        )}


        {!data.ambiguous &&
          !data.novelPattern &&
          (!top.contradicting ||
            top.contradicting.length === 0) && (

            <div className="flex items-center gap-2 text-[10px] text-[var(--color-green)]">

              <CheckCircle2 size={13} />

              No material unresolved uncertainty identified.

            </div>

          )}

      </div>

    </Panel>
  );
}


/* =========================================================
   NEXT INVESTIGATION
========================================================= */

function NextInvestigation({ data }) {

  return (
    <Panel>

      <PanelHeader
        number="06"
        title="Next best investigation"
        icon={<Search size={15} />}
      />

      <div className="rounded-lg border border-[var(--color-primary)]/15 bg-[var(--color-primary-soft)]/25 p-4">

        <p className="text-xs font-semibold leading-relaxed text-[var(--color-heading)]">
          {data.text}
        </p>


        {data.discriminatingMetrics?.length > 0 && (

          <div className="mt-4">

            <div className="mb-2 text-[8px] font-semibold uppercase tracking-[0.1em] text-[var(--color-body)]/40">
              Discriminating metrics
            </div>

            <div className="flex flex-wrap gap-1.5">

              {data.discriminatingMetrics.map((metric) => (

                <span
                  key={metric}
                  className="rounded-md border border-[var(--color-line)] bg-white px-2 py-1 font-mono-num text-[9px] text-[var(--color-body)]"
                >
                  {metric}
                </span>

              ))}

            </div>

          </div>

        )}

      </div>

    </Panel>
  );
}


/* =========================================================
   DECISION
========================================================= */

function DecisionSection({
  data,
  actionData,
  kpiId,
  proposeToMemory,
  proposeStatus,
}) {

  return (
    <Panel>

      <PanelHeader
        number="07"
        title="Decision & action"
        icon={<Zap size={15} />}
        action={
          <Link
            to={`/actions?kpi=${kpiId}`}
            className="flex items-center gap-1 text-[10px] font-semibold text-[var(--color-primary)] hover:underline"
          >
            Action Center
            <ArrowRight size={12} />
          </Link>
        }
      />


      {data.decision === "RECOMMEND_ACTION" &&
      actionData?.actions?.length > 0 ? (

        <div className="space-y-3">

          {actionData.actions.map((action) => (

            <div
              key={action.id}
              className="rounded-lg border border-[var(--color-line)]"
            >

              <div className="border-b border-[var(--color-line)] bg-[var(--color-paper)] p-4">

                <div className="flex items-start gap-3">

                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white">
                    <Zap size={15} />
                  </div>

                  <div className="min-w-0 flex-1">

                    <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--color-body)]/40">
                      Recommended action
                    </div>

                    <div className="mt-1 text-sm font-semibold leading-relaxed text-[var(--color-heading)]">
                      {action.contextualRecommendation ||
                        action.action}
                    </div>

                  </div>

                  <Badge
                    variant={
                      action.confidence >= 75
                        ? "positive"
                        : action.confidence >= 50
                          ? "MEDIUM"
                          : "LOW"
                    }
                  >
                    {action.confidence}%
                  </Badge>

                </div>

              </div>


              <div className="grid grid-cols-2 divide-x divide-[var(--color-line)] sm:grid-cols-4">

                <DecisionMetric
                  icon={<Target size={12} />}
                  label="Lever"
                  value={action.lever}
                />

                <DecisionMetric
                  icon={<UserRound size={12} />}
                  label="Owner"
                  value={action.owner}
                />

                <DecisionMetric
                  icon={<Activity size={12} />}
                  label="Expected impact"
                  value={action.expectedImpact}
                />

                <DecisionMetric
                  icon={<Clock3 size={12} />}
                  label="Monitoring"
                  value={
                    action.monitoringPlan ||
                    action.monitoring
                  }
                />

              </div>

            </div>

          ))}

        </div>

      ) : (

        <div className="rounded-lg bg-[var(--color-paper)] p-4">

          <div className="flex gap-3">

            <CheckCircle2
              size={15}
              className="mt-0.5 shrink-0 text-[var(--color-green)]"
            />

            <div>

              <div className="text-xs font-semibold text-[var(--color-heading)]">
                No action recommended
              </div>

              <div className="mt-1 text-[10px] leading-relaxed text-[var(--color-body)]/60">
                {data.decisionReason ||
                  "The investigation did not identify a sufficiently strong action."}
              </div>

            </div>

          </div>

        </div>

      )}


      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--color-line)] pt-4">

        <button
          onClick={proposeToMemory}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-[10px] font-semibold text-[var(--color-body)] transition hover:border-[var(--color-primary)]/30 hover:text-[var(--color-primary)]"
        >
          <History size={13} />
          Propose to Business Memory
        </button>

        {proposeStatus && (
          <span className="text-[9px] text-[var(--color-body)]/50">
            {proposeStatus}
          </span>
        )}

      </div>

    </Panel>
  );
}


function DecisionMetric({
  icon,
  label,
  value,
}) {

  return (
    <div className="min-w-0 p-3">

      <div className="flex items-center gap-1 text-[var(--color-body)]/35">

        {icon}

        <span className="text-[8px] font-semibold uppercase tracking-[0.07em]">
          {label}
        </span>

      </div>

      <div className="mt-1 truncate text-[10px] font-semibold text-[var(--color-heading)]">
        {value || "N/A"}
      </div>

    </div>
  );
}


/* =========================================================
   CONFIDENCE
========================================================= */

function ConfidencePanel({ data }) {

  const top = data.topHypothesis;

  return (
    <SidePanel
      title="Confidence"
      icon={<ShieldCheck size={14} />}
    >

      <div className="flex items-center gap-4">

        <ConfidenceRing
          value={top.confidence.overall}
          tier={top.confidence.tier}
        />

        <div className="min-w-0">

          <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[var(--color-body)]/40">
            Leading hypothesis
          </div>

          <div className="mt-1 text-xs font-semibold leading-relaxed text-[var(--color-heading)]">
            {top.label}
          </div>

        </div>

      </div>


      <div className="mt-5 space-y-1.5">

        {Object.entries(top.confidence.components).map(
          ([key, value]) => (

            <div
              key={key}
              className="flex items-center justify-between rounded-md bg-[var(--color-paper)] px-3 py-2"
            >

              <span className="text-[9px] text-[var(--color-body)]/50">
                {formatLabel(key)}
              </span>

              <span className="font-mono-num text-[10px] font-semibold text-[var(--color-heading)]">
                {value}
              </span>

            </div>

          )
        )}

      </div>


      {top.impactEstimate && (

        <div className="mt-4 border-t border-[var(--color-line)] pt-4">

          <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[var(--color-body)]/40">
            Estimated impact
          </div>

          <p className="mt-1 text-[10px] font-medium leading-relaxed text-[var(--color-heading)]">
            {top.impactEstimate.text}
          </p>

        </div>

      )}

    </SidePanel>
  );
}


/* =========================================================
   DATA QUALITY
========================================================= */

function DataQualityPanel({ data }) {

  return (
    <SidePanel
      title="Data quality"
      icon={<Database size={14} />}
    >

      <div className="flex items-end justify-between">

        <div>

          <div className="font-mono-num text-3xl font-semibold text-[var(--color-heading)]">
            {data.dataQuality?.overall ?? "N/A"}
          </div>

          <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[var(--color-body)]/40">
            Overall score
          </div>

        </div>

        <CheckCircle2
          size={19}
          className="text-[var(--color-green)]"
        />

      </div>


      {data.dataQuality?.details && (

        <div className="mt-4 space-y-1.5">

          {data.dataQuality.details.map((d) => (

            <div
              key={d.source}
              className="flex items-center justify-between rounded-md border border-[var(--color-line)] px-3 py-2"
            >

              <div>

                <div className="text-[10px] font-semibold text-[var(--color-heading)]">
                  {d.source}
                </div>

                <div className="text-[8px] text-[var(--color-body)]/40">
                  {d.ageMinutes}m ago
                </div>

              </div>

              <span className="font-mono-num text-[10px] font-semibold">
                {d.score}
              </span>

            </div>

          ))}

        </div>

      )}

    </SidePanel>
  );
}


/* =========================================================
   QUICK LINKS
========================================================= */

function QuickLinks({ kpiId }) {

  const links = [
    {
      label: "Driver Tree",
      description: "Trace KPI contributors",
      icon: <GitBranch size={13} />,
      to: `/tree?kpi=${kpiId}`,
    },
    {
      label: "Evidence Explorer",
      description: "Inspect supporting evidence",
      icon: <Database size={13} />,
      to: `/evidence?kpi=${kpiId}`,
    },
    {
      label: "Action Center",
      description: "Review recommended actions",
      icon: <Zap size={13} />,
      to: `/actions?kpi=${kpiId}`,
    },
    {
      label: "Business Memory",
      description: "Compare historical cases",
      icon: <History size={13} />,
      to: "/memory",
    },
  ];

  return (
    <SidePanel
      title="Continue investigation"
      icon={<ArrowRight size={14} />}
    >

      <div className="space-y-1">

        {links.map((link) => (

          <Link
            key={link.to}
            to={link.to}
            className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-[var(--color-canvas)]"
          >

            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--color-paper)] text-[var(--color-body)]/50 group-hover:text-[var(--color-primary)]">
              {link.icon}
            </div>

            <div className="min-w-0 flex-1">

              <div className="text-[10px] font-semibold text-[var(--color-heading)]">
                {link.label}
              </div>

              <div className="text-[8px] text-[var(--color-body)]/40">
                {link.description}
              </div>

            </div>

            <ArrowRight
              size={11}
              className="text-[var(--color-body)]/20 transition group-hover:text-[var(--color-primary)]"
            />

          </Link>

        ))}

      </div>

    </SidePanel>
  );
}


/* =========================================================
   METHODS
========================================================= */

function Methods({ data }) {

  const [open, setOpen] = useState(false);

  if (!data.method?.length) return null;

  return (
    <section className="mt-6 rounded-md border border-[var(--color-line)] bg-white">

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >

        <Info size={13} className="text-[var(--color-body)]/40" />

        <span className="text-[10px] font-semibold text-[var(--color-body)]">
          Methods & calculation transparency
        </span>

        <ChevronDown
          size={13}
          className={`ml-auto text-[var(--color-body)]/40 transition ${
            open ? "rotate-180" : ""
          }`}
        />

      </button>


      {open && (

        <div className="border-t border-[var(--color-line)] px-4 py-4">

          <div className="space-y-2">

            {data.method.map((method, index) => (

              <div
                key={index}
                className="flex gap-3 text-[10px] leading-relaxed text-[var(--color-body)]/55"
              >

                <span className="font-mono-num text-[var(--color-body)]/25">
                  {String(index + 1).padStart(2, "0")}
                </span>

                {method}

              </div>

            ))}

          </div>

        </div>

      )}

    </section>
  );
}


/* =========================================================
   GENERIC PANELS
========================================================= */

function Panel({
  children,
}) {

  return (
    <section className="rounded-md border border-[var(--color-line)] bg-white">
      <div className="p-5 sm:p-6">
        {children}
      </div>
    </section>
  );
}


function PanelHeader({
  number,
  title,
  icon,
  action,
}) {

  return (
    <div className="mb-5 flex items-center gap-3">

      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--color-canvas)] text-[var(--color-body)]/55">
        {icon}
      </div>

      <div className="flex-1">

        <div className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[var(--color-body)]/35">
          {number}
        </div>

        <h2 className="text-sm font-semibold text-[var(--color-heading)]">
          {title}
        </h2>

      </div>

      {action}

    </div>
  );
}


function SidePanel({
  title,
  icon,
  children,
}) {

  return (
    <section className="rounded-md border border-[var(--color-line)] bg-white">

      <div className="flex items-center gap-2 border-b border-[var(--color-line)] px-4 py-3">

        <div className="text-[var(--color-body)]/45">
          {icon}
        </div>

        <h3 className="text-[10px] font-semibold text-[var(--color-heading)]">
          {title}
        </h3>

      </div>

      <div className="p-4">
        {children}
      </div>

    </section>
  );
}


/* =========================================================
   DECISION CONFIG
========================================================= */

function getDecisionConfig(data) {

  if (
    data.decision ===
    "ABSTAIN_INSUFFICIENT_HISTORY"
  ) {
    return {
      title: "Insufficient historical data",
      description: data.decisionReason,
      badge: "MEDIUM",
      container:
        "border-[var(--color-primary)]/20 bg-[var(--color-primary-soft)]/40",
      titleColor: "text-[var(--color-primary)]",
      iconColor: "text-[var(--color-primary)]",
      icon: <Info size={16} />,
    };
  }


  if (data.decision === "AMBIGUOUS") {
    return {
      title: "Investigation remains ambiguous",
      description: data.decisionReason,
      badge: "MEDIUM",
      container:
        "border-[var(--color-primary)]/20 bg-[var(--color-primary-soft)]/40",
      titleColor: "text-[var(--color-primary)]",
      iconColor: "text-[var(--color-primary)]",
      icon: <AlertCircle size={16} />,
    };
  }


  if (data.decision === "NO_ACTION") {
    return {
      title: "No action required",
      description: data.decisionReason,
      badge: "positive",
      container:
        "border-[var(--color-green)]/20 bg-[var(--color-green-soft)]/40",
      titleColor: "text-[var(--color-green)]",
      iconColor: "text-[var(--color-green)]",
      icon: <CheckCircle2 size={16} />,
    };
  }


  return {
    title: "Investigation requires attention",
    description:
      data.decisionReason ||
      "The KPI movement requires further investigation.",
    badge: "LOW",
    container:
      "border-[var(--color-clay)]/20 bg-[var(--color-clay-soft)]/40",
    titleColor: "text-[var(--color-clay)]",
    iconColor: "text-[var(--color-clay)]",
    icon: <AlertCircle size={16} />,
  };
}


/* =========================================================
   HELPERS
========================================================= */

function formatValue(value) {

  if (value == null) return "N/A";

  if (Math.abs(value) >= 1000) {
    return `₹${Math.round(value).toLocaleString("en-IN")}`;
  }

  return Number(value).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}


function formatLabel(value) {

  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase());
}