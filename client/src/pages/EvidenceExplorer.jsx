import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { Loading, ErrorPanel, cap } from "./Dashboard";
import ConfidenceRing from "../components/ConfidenceRing";

import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Database,
  FileSearch,
  GitBranch,
  Info,
  Link2,
  Lock,
  ShieldCheck,
  Sparkles,
  Ticket,
  TrendingUp,
  XCircle,
} from "lucide-react";

export default function EvidenceExplorer() {
  const { token, region } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();

  const [kpis, setKpis] = useState([]);
  const [data, setData] = useState(null);
  const [recon, setRecon] = useState(null);
  const [error, setError] = useState(null);

  const [activeHypothesis, setActiveHypothesis] = useState(null);

  const kpiId = searchParams.get("kpi") || "revenue";

  /* ---------------------------------------------------------
     API, UNCHANGED
  --------------------------------------------------------- */

  useEffect(() => {
    api.metaKpis(token).then(setKpis).catch(() => {});
    api.reconciliation(token).then(setRecon).catch(() => {});
  }, [token]);

  useEffect(() => {
    setData(null);
    setError(null);
    setActiveHypothesis(null);

    api
      .evidence(token, kpiId, region)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [token, region, kpiId]);

  /* ---------------------------------------------------------
     DERIVED DATA
  --------------------------------------------------------- */

  const averageConfidence = useMemo(() => {
    if (!data?.hypotheses?.length) return 0;

    const total = data.hypotheses.reduce(
      (sum, h) => sum + Number(h.confidence?.overall || 0),
      0
    );

    return Math.round(total / data.hypotheses.length);
  }, [data]);

  const supportingCount = useMemo(() => {
    if (!data?.hypotheses) return 0;

    return data.hypotheses.reduce(
      (sum, h) => sum + (h.supporting?.length || 0),
      0
    );
  }, [data]);

  const contradictingCount = useMemo(() => {
    if (!data?.hypotheses) return 0;

    return data.hypotheses.reduce(
      (sum, h) => sum + (h.contradicting?.length || 0),
      0
    );
  }, [data]);

  const freshness = Number(data?.freshness?.overall || 0);

  if (error) {
    return (
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <ErrorPanel message={error} />
      </div>
    );
  }

  if (!data) {
    return <Loading />;
  }

  const regionLabel =
    data.region === "all" ? "All regions" : cap(data.region);

  return (
    <div className="min-h-full bg-[var(--color-canvas)]">
      <div className="mx-auto max-w-[1450px] px-5 pb-16 pt-4 sm:px-7 lg:px-9">

        {/* =====================================================
            TOP HEADER
        ===================================================== */}

        <header className="mb-6">

          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

            <div>

              <div className="mb-3 flex items-center gap-2">

                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                  <FileSearch size={15} strokeWidth={2} />
                </div>

                <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--color-body)]/40">
                  Evidence & Traceability
                </span>

              </div>

              <h1 className="font-display text-[28px] font-bold tracking-tight text-[var(--color-heading)]">
                Evidence Explorer
              </h1>

              <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-[var(--color-body)]/55">
                Trace the evidence behind the KPI, validate data quality,
                and inspect why each investigation hypothesis is ranked.
              </p>

            </div>

            {/* KPI SELECTOR */}

            <div className="min-w-[220px]">

              <label className="mb-1.5 block text-[8px] font-bold uppercase tracking-[0.14em] text-[var(--color-body)]/40">
                KPI under investigation
              </label>

              <div className="relative">

                <select
                  value={kpiId}
                  onChange={(e) =>
                    setSearchParams({
                      kpi: e.target.value,
                    })
                  }
                  className="
                    w-full appearance-none
                    rounded-lg
                    border border-[var(--color-line)]
                    bg-white
                    px-3.5 py-2.5 pr-9
                    text-[12px] font-semibold
                    text-[var(--color-heading)]
                    outline-none
                    transition
                    hover:border-[var(--color-primary)]/30
                    focus:border-[var(--color-primary)]/40
                    focus:ring-2
                    focus:ring-[var(--color-primary)]/10
                  "
                >
                  {kpis.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>

                <ChevronDown
                  size={13}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-body)]/40"
                />

              </div>

            </div>

          </div>

        </header>

        {/* =====================================================
            CONTEXT / STATUS BAR
        ===================================================== */}

        <div className="mb-5 flex flex-wrap items-center gap-2">

          <ContextItem
            icon={<Activity size={12} />}
            label="Region"
            value={regionLabel}
          />

          <ContextItem
            icon={<Database size={12} />}
            label="Data freshness"
            value={`${freshness}/100`}
            status={freshness >= 75 ? "good" : "warning"}
          />

          <ContextItem
            icon={<GitBranch size={12} />}
            label="Hypotheses"
            value={data.hypotheses?.length || 0}
          />

          <div className="ml-auto hidden items-center gap-1.5 text-[9px] text-[var(--color-body)]/40 md:flex">
            <ShieldCheck size={11} />
            Governed evidence pipeline
          </div>

        </div>

        {/* =====================================================
            EVIDENCE OVERVIEW
        ===================================================== */}

        <section className="mb-5 overflow-hidden rounded-md border border-[var(--color-line)] bg-white">

          <div className="grid grid-cols-2 divide-x divide-y divide-[var(--color-line)] md:grid-cols-4 md:divide-y-0">

            <OverviewMetric
              label="Evidence quality"
              value={`${freshness}/100`}
              description="Source freshness"
              icon={<ShieldCheck size={15} />}
              tone={freshness >= 75 ? "positive" : "warning"}
            />

            <OverviewMetric
              label="Avg. confidence"
              value={`${averageConfidence}%`}
              description="Across hypotheses"
              icon={<Activity size={15} />}
              tone={averageConfidence >= 75 ? "positive" : "neutral"}
            />

            <OverviewMetric
              label="Supporting signals"
              value={supportingCount}
              description="Signals supporting causes"
              icon={<CheckCircle2 size={15} />}
              tone="positive"
            />

            <OverviewMetric
              label="Contradicting signals"
              value={contradictingCount}
              description="Signals requiring caution"
              icon={<XCircle size={15} />}
              tone={contradictingCount ? "warning" : "neutral"}
            />

          </div>

        </section>

        {/* =====================================================
            MAIN INVESTIGATION WORKSPACE
        ===================================================== */}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">

          {/* LEFT */}

          <main className="min-w-0 space-y-5">

            {/* DATA SOURCES */}

            <section className="overflow-hidden rounded-md border border-[var(--color-line)] bg-white">

              <SectionHeader
                icon={<Database size={15} />}
                title="Source health"
                subtitle="Systems contributing evidence to this investigation"
              />

              <div className="divide-y divide-[var(--color-line)]">

                {data.freshness.details.map((source) => (
                  <SourceRow
                    key={source.source}
                    source={source}
                  />
                ))}

              </div>

              <div className="border-t border-[var(--color-line)] bg-[var(--color-paper)] px-5 py-3.5">

                <div className="mb-2 flex items-center gap-2">
                  <Info
                    size={11}
                    className="text-[var(--color-primary)]"
                  />

                  <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--color-body)]/40">
                    Evidence processing
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">

                  <PipelineStep
                    icon={<Database size={10} />}
                    label="Deterministic"
                  />

                  <PipelineStep
                    icon={<TrendingUp size={10} />}
                    label="Statistical"
                  />

                  <PipelineStep
                    icon={<CircleAlert size={10} />}
                    label="Anomaly detection"
                  />

                  <PipelineStep
                    icon={<GitBranch size={10} />}
                    label="Historical similarity"
                  />

                  <PipelineStep
                    icon={<Sparkles size={10} />}
                    label="Narrative"
                  />

                </div>

              </div>

            </section>

            {/* RECONCILIATION */}

            {recon?.available && (
              <section className="rounded-md border border-[var(--color-line)] bg-white">

                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">

                  <div className="flex items-start gap-3">

                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                      <Link2 size={14} />
                    </div>

                    <div>

                      <div className="text-[11px] font-bold text-[var(--color-heading)]">
                        Cross-system reconciliation
                      </div>

                      <p className="mt-1 max-w-xl text-[9px] leading-relaxed text-[var(--color-body)]/50">
                        Customer records across CRM and Support have been
                        reconciled before being used as investigation evidence.
                      </p>

                    </div>

                  </div>

                  <div className="flex items-center gap-3">

                    <div className="text-right">

                      <div className="font-mono-num text-lg font-bold text-[var(--color-heading)]">
                        {recon.customerReconciliation.matchRate}%
                      </div>

                      <div className="text-[8px] font-bold uppercase tracking-wide text-[var(--color-body)]/35">
                        customer match
                      </div>

                    </div>

                    <Link
                      to="/reconciliation"
                      className="
                        inline-flex items-center gap-1.5
                        rounded-lg
                        bg-[var(--color-heading)]
                        px-3 py-2
                        text-[9px] font-semibold text-white
                        transition hover:opacity-90
                      "
                    >
                      Inspect
                      <ArrowRight size={11} />
                    </Link>

                  </div>

                </div>

              </section>
            )}

            {/* LINEAGE */}

            <section className="overflow-hidden rounded-md border border-[var(--color-line)] bg-white">

              <SectionHeader
                icon={<GitBranch size={15} />}
                title="Calculation lineage"
                subtitle="How the reported KPI values are derived"
              />

              <div className="divide-y divide-[var(--color-line)]">

                {Object.entries(data.lineage).map(([key, value]) => (
                  <LineageRow
                    key={key}
                    name={key}
                    data={value}
                  />
                ))}

              </div>

            </section>

            {/* HYPOTHESES */}

            <section className="overflow-hidden rounded-md border border-[var(--color-line)] bg-white">

              <SectionHeader
                icon={<Database size={15} />}
                title="Investigation evidence"
                subtitle="Evidence supporting or challenging each possible driver"
                right={
                  <span className="rounded-full bg-[var(--color-primary)]/10 px-2.5 py-1 font-mono-num text-[8px] font-bold text-[var(--color-primary)]">
                    {data.hypotheses.length} hypotheses
                  </span>
                }
              />

              <div className="divide-y divide-[var(--color-line)]">

                {data.hypotheses.map((hypothesis, index) => (

                  <HypothesisRow
                    key={hypothesis.id}
                    hypothesis={hypothesis}
                    index={index}
                    detailedAccess={data.detailedAccess}
                    active={activeHypothesis === hypothesis.id}
                    onToggle={() =>
                      setActiveHypothesis(
                        activeHypothesis === hypothesis.id
                          ? null
                          : hypothesis.id
                      )
                    }
                  />

                ))}

              </div>

            </section>

          </main>

          {/* RIGHT SIDEBAR */}

          <aside className="space-y-5">

            {/* TRUST PANEL */}

            <section className="rounded-md border border-[var(--color-line)] bg-white p-5">

              <div className="mb-4 flex items-center gap-2">

                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-green-soft)] text-[var(--color-green)]">
                  <ShieldCheck size={13} />
                </div>

                <div>
                  <div className="text-[10px] font-bold text-[var(--color-heading)]">
                    Evidence integrity
                  </div>

                  <div className="text-[8px] text-[var(--color-body)]/40">
                    Current investigation
                  </div>
                </div>

              </div>

              <TrustRow
                label="Source freshness"
                value={`${freshness}/100`}
                good={freshness >= 75}
              />

              <TrustRow
                label="Calculation method"
                value="Deterministic"
                good
              />

              <TrustRow
                label="Historical evidence"
                value="Available"
                good
              />

              <TrustRow
                label="Narrative layer"
                value="Final step"
                good
              />

            </section>

            {/* EVIDENCE LEGEND */}

            <section className="rounded-md border border-[var(--color-line)] bg-white p-5">

              <div className="mb-3 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--color-body)]/40">
                Evidence interpretation
              </div>

              <LegendRow
                icon={<CheckCircle2 size={12} />}
                label="Supporting"
                description="Strengthens the hypothesis"
                tone="positive"
              />

              <LegendRow
                icon={<XCircle size={12} />}
                label="Contradicting"
                description="Weakens or qualifies it"
                tone="warning"
              />

              <LegendRow
                icon={<Lock size={12} />}
                label="Restricted"
                description="Requires analyst access"
                tone="neutral"
              />

            </section>

          </aside>

        </div>

      </div>
    </div>
  );
}

/* =============================================================
   CONTEXT ITEM
============================================================= */

function ContextItem({ icon, label, value, status }) {

  const statusClass =
    status === "good"
      ? "text-[var(--color-green)]"
      : status === "warning"
        ? "text-[var(--color-clay)]"
        : "text-[var(--color-primary)]";

  return (
    <div className="flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-white px-3 py-1.5">

      <span className={statusClass}>
        {icon}
      </span>

      <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--color-body)]/35">
        {label}
      </span>

      <span className="font-mono-num text-[9px] font-bold text-[var(--color-heading)]">
        {value}
      </span>

    </div>
  );
}

/* =============================================================
   OVERVIEW METRIC
============================================================= */

function OverviewMetric({
  icon,
  label,
  value,
  description,
  tone = "neutral",
}) {

  const toneClass =
    tone === "positive"
      ? "bg-[var(--color-green-soft)] text-[var(--color-green)]"
      : tone === "warning"
        ? "bg-[var(--color-clay-soft)] text-[var(--color-clay)]"
        : "bg-[var(--color-primary)]/10 text-[var(--color-primary)]";

  return (
    <div className="p-4 sm:p-5">

      <div className="flex items-center justify-between">

        <div
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${toneClass}`}
        >
          {icon}
        </div>

      </div>

      <div className="mt-3">

        <div className="text-[8px] font-bold uppercase tracking-[0.11em] text-[var(--color-body)]/35">
          {label}
        </div>

        <div className="mt-1 font-mono-num text-xl font-bold text-[var(--color-heading)]">
          {value}
        </div>

        <div className="mt-0.5 text-[8px] text-[var(--color-body)]/35">
          {description}
        </div>

      </div>

    </div>
  );
}

/* =============================================================
   SECTION HEADER
============================================================= */

function SectionHeader({
  icon,
  title,
  subtitle,
  right,
}) {

  return (
    <div className="flex flex-col gap-3 border-b border-[var(--color-line)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">

      <div className="flex items-center gap-3">

        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          {icon}
        </div>

        <div>

          <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-heading)]">
            {title}
          </h2>

          {subtitle && (
            <p className="mt-0.5 text-[8px] text-[var(--color-body)]/40">
              {subtitle}
            </p>
          )}

        </div>

      </div>

      {right}

    </div>
  );
}

/* =============================================================
   SOURCE ROW
============================================================= */

function SourceRow({ source }) {

  const score = Number(source.score) || 0;

  const status =
    score >= 85
      ? "Healthy"
      : score >= 70
        ? "Good"
        : "Attention";

  const statusClass =
    score >= 85
      ? "bg-[var(--color-green-soft)] text-[var(--color-green)]"
      : score >= 70
        ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
        : "bg-[var(--color-clay-soft)] text-[var(--color-clay)]";

  return (
    <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-[1fr_180px_90px] sm:items-center">

      <div>

        <div className="text-[11px] font-bold text-[var(--color-heading)]">
          {source.source}
        </div>

        <div className="mt-0.5 text-[8px] text-[var(--color-body)]/40">
          {source.cadence}
        </div>

      </div>

      <div>

        <div className="mb-1.5 flex items-center justify-between">

          <span className="text-[8px] text-[var(--color-body)]/35">
            Quality score
          </span>

          <span className="font-mono-num text-[9px] font-bold text-[var(--color-heading)]">
            {score}/100
          </span>

        </div>

        <div className="h-1 overflow-hidden rounded-full bg-[var(--color-line)]">

          <div
            className={
              score >= 85
                ? "h-full rounded-full bg-[var(--color-green)]"
                : score >= 70
                  ? "h-full rounded-full bg-[var(--color-primary)]"
                  : "h-full rounded-full bg-[var(--color-clay)]"
            }
            style={{
              width: `${Math.min(score, 100)}%`,
            }}
          />

        </div>

      </div>

      <div className="sm:text-right">

        <span className={`rounded-full px-2 py-1 text-[8px] font-bold ${statusClass}`}>
          {status}
        </span>

        <div className="mt-1 text-[8px] text-[var(--color-body)]/35">
          {source.ageMinutes}m ago
        </div>

      </div>

    </div>
  );
}

/* =============================================================
   PIPELINE STEP
============================================================= */

function PipelineStep({ icon, label }) {

  return (
    <span className="flex items-center gap-1.5 rounded-md border border-[var(--color-line)] bg-white px-2 py-1.5 text-[8px] font-medium text-[var(--color-body)]/55">

      <span className="text-[var(--color-primary)]">
        {icon}
      </span>

      {label}

    </span>
  );
}

/* =============================================================
   LINEAGE ROW
============================================================= */

function LineageRow({ name, data }) {

  return (
    <div className="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-[170px_1fr] md:items-center">

      <div>

        <div className="text-[10px] font-bold text-[var(--color-heading)]">
          {cap(name)}
        </div>

        <div className="mt-1 flex items-center gap-1.5">

          <Database
            size={9}
            className="text-[var(--color-body)]/35"
          />

          <span className="font-mono-num text-[8px] text-[var(--color-body)]/40">
            {data.source}
          </span>

        </div>

      </div>

      <div className="rounded-lg bg-[var(--color-paper)] px-3.5 py-3">

        <div className="mb-1 text-[7px] font-bold uppercase tracking-[0.1em] text-[var(--color-body)]/30">
          Calculation
        </div>

        <code className="break-words font-mono-num text-[9px] leading-relaxed text-[var(--color-heading)]">
          {data.calculation}
        </code>

      </div>

    </div>
  );
}

/* =============================================================
   HYPOTHESIS ROW
============================================================= */

function HypothesisRow({
  hypothesis,
  index,
  detailedAccess,
  active,
  onToggle,
}) {

  const confidence = Number(
    hypothesis.confidence?.overall || 0
  );

  const supporting = hypothesis.supporting || [];
  const contradicting = hypothesis.contradicting || [];

  const ticketCount =
    hypothesis.evidence?.ticketCount || 0;

  return (
    <article>

      {/* HEADER */}

      <button
        type="button"
        onClick={onToggle}
        className="w-full px-5 py-5 text-left transition hover:bg-[var(--color-paper)]"
      >

        <div className="flex items-start gap-3">

          <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-paper)] font-mono-num text-[9px] font-bold text-[var(--color-body)]/30 sm:flex">
            {String(index + 1).padStart(2, "0")}
          </div>

          <div className="min-w-0 flex-1">

            <div className="flex flex-wrap items-center gap-2">

              <h3 className="text-[11px] font-bold text-[var(--color-heading)]">
                {hypothesis.label}
              </h3>

              <ConfidenceBadge
                confidence={confidence}
                tier={hypothesis.confidence?.tier}
              />

            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-[8px] text-[var(--color-body)]/35">

              <span>
                {hypothesis.lineage.source}
              </span>

              <span>·</span>

              <span>
                {hypothesis.lineage.metric}
              </span>

            </div>

          </div>

          <div className="hidden shrink-0 sm:block">

            <ConfidenceRing
              value={confidence}
              tier={hypothesis.confidence?.tier}
            />

          </div>

          <div className="mt-1 text-[var(--color-body)]/30">

            {active ? (
              <ChevronDown size={15} />
            ) : (
              <ChevronDown
                size={15}
                className="-rotate-90"
              />
            )}

          </div>

        </div>

      </button>

      {/* SUMMARY */}

      <div className="grid grid-cols-3 gap-2 px-5 pb-5 sm:ml-[52px] sm:pr-5">

        <EvidenceCount
          icon={<CheckCircle2 size={11} />}
          label="Supporting"
          count={supporting.length}
          positive
        />

        <EvidenceCount
          icon={<XCircle size={11} />}
          label="Contradicting"
          count={contradicting.length}
          warning={contradicting.length > 0}
        />

        <EvidenceCount
          icon={<Ticket size={11} />}
          label="Tickets"
          count={ticketCount}
        />

      </div>

      {/* EXPANDED */}

      {active && (

        <div className="space-y-4 border-t border-[var(--color-line)] bg-[var(--color-paper)] px-5 py-5 sm:ml-[52px] sm:mr-5">

          {/* LINEAGE */}

          <div>

            <div className="mb-2 flex items-center gap-2">

              <GitBranch
                size={11}
                className="text-[var(--color-primary)]"
              />

              <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--color-heading)]">
                Evidence lineage
              </span>

            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">

              <MiniEvidence
                label="Source"
                value={hypothesis.lineage.source}
              />

              <MiniEvidence
                label="Metric"
                value={hypothesis.lineage.metric}
              />

              <MiniEvidence
                label="Calculation"
                value={hypothesis.lineage.calculation}
              />

            </div>

          </div>

          {/* EVIDENCE */}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">

            <EvidenceList
              title="Supporting evidence"
              icon={<CheckCircle2 size={12} />}
              items={supporting}
              positive
              emptyText="No supporting evidence found."
            />

            <EvidenceList
              title="Contradicting evidence"
              icon={<XCircle size={12} />}
              items={contradicting}
              warning
              emptyText="No contradicting evidence found."
            />

          </div>

          {/* TICKETS */}

          {detailedAccess &&
            hypothesis.evidence?.sample?.length > 0 && (

              <div className="overflow-hidden rounded-lg border border-[var(--color-line)] bg-white">

                <div className="flex items-center gap-2 border-b border-[var(--color-line)] px-4 py-3">

                  <Ticket
                    size={12}
                    className="text-[var(--color-primary)]"
                  />

                  <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--color-heading)]">
                    Related support tickets
                  </span>

                  <span className="text-[8px] text-[var(--color-body)]/35">
                    Analyst detail
                  </span>

                </div>

                <div className="divide-y divide-[var(--color-line)]">

                  {hypothesis.evidence.sample.map((ticket) => (

                    <div
                      key={ticket.ticketId}
                      className="px-4 py-3"
                    >

                      <div className="flex flex-wrap items-center gap-2">

                        <span className="rounded-md bg-[var(--color-paper)] px-2 py-1 font-mono-num text-[8px] font-bold text-[var(--color-body)]/55">
                          {ticket.ticketId}
                        </span>

                        <span className="text-[8px] text-[var(--color-body)]/35">
                          {ticket.date}
                        </span>

                        <span className="text-[8px] text-[var(--color-body)]/35">
                          sentiment {ticket.sentiment}
                        </span>

                      </div>

                      <p className="mt-2 text-[9px] leading-relaxed text-[var(--color-body)]/70">
                        {ticket.issue}
                      </p>

                    </div>

                  ))}

                </div>

              </div>

            )}

          {!detailedAccess && ticketCount > 0 && (

            <div className="flex items-start gap-2.5 rounded-lg border border-[var(--color-line)] bg-white p-3.5">

              <Lock
                size={12}
                className="mt-0.5 shrink-0 text-[var(--color-primary)]"
              />

              <div>

                <div className="text-[9px] font-bold text-[var(--color-heading)]">
                  Analyst-level evidence
                </div>

                <p className="mt-1 text-[8px] leading-relaxed text-[var(--color-body)]/45">
                  {ticketCount} related tickets were found.
                  Raw ticket text is restricted to analyst access.
                </p>

              </div>

            </div>

          )}

        </div>

      )}

    </article>
  );
}

/* =============================================================
   CONFIDENCE BADGE
============================================================= */

function ConfidenceBadge({ confidence, tier }) {

  const positive = confidence >= 75;

  return (
    <span
      className={
        positive
          ? "rounded-full bg-[var(--color-green-soft)] px-2 py-1 text-[8px] font-bold text-[var(--color-green)]"
          : "rounded-full bg-[var(--color-clay-soft)] px-2 py-1 text-[8px] font-bold text-[var(--color-clay)]"
      }
    >
      {confidence}% · {tier}
    </span>
  );
}

/* =============================================================
   EVIDENCE COUNT
============================================================= */

function EvidenceCount({
  icon,
  label,
  count,
  positive,
  warning,
}) {

  const iconClass = positive
    ? "text-[var(--color-green)]"
    : warning
      ? "text-[var(--color-clay)]"
      : "text-[var(--color-primary)]";

  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--color-line)] bg-white px-2.5 py-2">

      <span className={iconClass}>
        {icon}
      </span>

      <div className="min-w-0">

        <div className="font-mono-num text-[10px] font-bold text-[var(--color-heading)]">
          {count}
        </div>

        <div className="truncate text-[7px] text-[var(--color-body)]/35">
          {label}
        </div>

      </div>

    </div>
  );
}

/* =============================================================
   EVIDENCE LIST
============================================================= */

function EvidenceList({
  title,
  icon,
  items,
  positive,
  warning,
  emptyText,
}) {

  const iconClass = positive
    ? "text-[var(--color-green)]"
    : warning
      ? "text-[var(--color-clay)]"
      : "text-[var(--color-primary)]";

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-line)] bg-white">

      <div className="flex items-center gap-2 border-b border-[var(--color-line)] px-3.5 py-2.5">

        <span className={iconClass}>
          {icon}
        </span>

        <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--color-heading)]">
          {title}
        </span>

      </div>

      <div className="p-3.5">

        {items.length > 0 ? (

          <ul className="space-y-2.5">

            {items.map((item, index) => (

              <li
                key={index}
                className="flex items-start gap-2"
              >

                <span
                  className={
                    positive
                      ? "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-green)]"
                      : "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-clay)]"
                  }
                />

                <span className="text-[9px] leading-relaxed text-[var(--color-body)]/65">
                  {item}
                </span>

              </li>

            ))}

          </ul>

        ) : (

          <div className="flex items-center gap-2 py-1 text-[8px] text-[var(--color-body)]/35">

            <CheckCircle2 size={11} />

            {emptyText}

          </div>

        )}

      </div>

    </div>
  );
}

/* =============================================================
   MINI EVIDENCE
============================================================= */

function MiniEvidence({ label, value }) {

  return (
    <div>

      <div className="text-[7px] font-bold uppercase tracking-[0.08em] text-[var(--color-body)]/30">
        {label}
      </div>

      <div className="mt-1 break-words text-[8px] font-semibold text-[var(--color-heading)]">
        {value}
      </div>

    </div>
  );
}

/* =============================================================
   TRUST ROW
============================================================= */

function TrustRow({ label, value, good }) {

  return (
    <div className="flex items-center justify-between border-t border-[var(--color-line)] py-2.5 first:border-t-0">

      <span className="text-[8px] text-[var(--color-body)]/45">
        {label}
      </span>

      <span
        className={
          good
            ? "flex items-center gap-1 text-[8px] font-semibold text-[var(--color-green)]"
            : "text-[8px] font-semibold text-[var(--color-clay)]"
        }
      >
        {good && <CheckCircle2 size={10} />}
        {value}
      </span>

    </div>
  );
}

/* =============================================================
   LEGEND
============================================================= */

function LegendRow({
  icon,
  label,
  description,
  tone,
}) {

  const toneClass =
    tone === "positive"
      ? "text-[var(--color-green)]"
      : tone === "warning"
        ? "text-[var(--color-clay)]"
        : "text-[var(--color-primary)]";

  return (
    <div className="flex items-start gap-2.5 border-t border-[var(--color-line)] py-2.5 first:border-t-0">

      <span className={`mt-0.5 ${toneClass}`}>
        {icon}
      </span>

      <div>

        <div className="text-[8px] font-semibold text-[var(--color-heading)]">
          {label}
        </div>

        <div className="mt-0.5 text-[7px] leading-relaxed text-[var(--color-body)]/35">
          {description}
        </div>

      </div>

    </div>
  );
}