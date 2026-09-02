import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Crosshair,
  Gauge,
  Info,
  ShieldCheck,
  Target,
  UserRound,
  Zap,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { Loading, ErrorPanel, cap } from "./Dashboard";
import ConfidenceRing from "../components/ConfidenceRing";


/* =========================================================
   ACTION CENTER
========================================================= */

export default function ActionCenter() {
  const { token, region } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();

  const [kpis, setKpis] = useState([]);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const kpiId = searchParams.get("kpi") || "revenue";


  /* =======================================================
     LOAD KPI LIST
  ======================================================= */

  useEffect(() => {
    api
      .metaKpis(token)
      .then(setKpis)
      .catch(() => {});
  }, [token]);


  /* =======================================================
     LOAD ACTION DATA
     Backend endpoint remains unchanged.
  ======================================================= */

  useEffect(() => {
    setData(null);
    setError(null);

    api
      .actions(token, kpiId, region)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [token, region, kpiId]);


  /* =======================================================
     STATES
  ======================================================= */

  if (error) {
    return <ErrorPanel message={error} />;
  }

  if (!data) {
    return <Loading />;
  }


  const actions = data.actions || [];
  const hasActions = actions.length > 0;

  const regionLabel =
    data.region === "all"
      ? "All regions"
      : cap(data.region);


  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">

      {/* ===================================================
          HEADER
      =================================================== */}

      <PageIntro
        kpis={kpis}
        kpiId={kpiId}
        setSearchParams={setSearchParams}
        regionLabel={regionLabel}
      />


      {/* ===================================================
          DECISION SUMMARY
      =================================================== */}

      <DecisionOverview
        data={data}
        hasActions={hasActions}
      />


      {/* ===================================================
          ACTIONS
      =================================================== */}

      {hasActions ? (
        <ActionList actions={actions} />
      ) : (
        <NoActionState
          decision={data.decision}
          reason={data.decisionReason || data.note}
        />
      )}

    </div>
  );
}


/* =========================================================
   PAGE INTRO
========================================================= */

function PageIntro({
  kpis,
  kpiId,
  setSearchParams,
  regionLabel,
}) {
  return (
    <div className="mb-7">

      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

        <div>

          {/* eyebrow */}

          <div className="mb-3 flex items-center gap-2">

            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <Zap size={16} />
            </div>

            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-body)]/45">
              Decision intelligence
            </span>

          </div>


          <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-heading)] sm:text-4xl">
            Action Center
          </h1>


          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-body)]/60">
            Turn detected business drivers into clear,
            governed actions that teams can execute and monitor.
          </p>

        </div>


        {/* KPI CONTROL */}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">

          <div>

            <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.13em] text-[var(--color-body)]/40">
              Investigating KPI
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
                  min-w-[220px]
                  appearance-none
                  rounded-md
                  border
                  border-[var(--color-line)]
                  bg-white
                  py-2.5
                  pl-4
                  pr-10
                  text-sm
                  font-semibold
                  text-[var(--color-heading)]
                  shadow-sm
                  outline-none
                  transition
                  hover:border-[var(--color-primary)]/30
                  focus:border-[var(--color-primary)]/50
                  focus:ring-4
                  focus:ring-[var(--color-primary)]/10
                "
              >
                {kpis.map((k) => (
                  <option
                    key={k.id}
                    value={k.id}
                  >
                    {k.name}
                  </option>
                ))}
              </select>

              <ChevronDown
                size={15}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-body)]/40"
              />

            </div>

          </div>


          {/* REGION */}

          <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-2.5">

            <div className="text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--color-body)]/35">
              Region
            </div>

            <div className="mt-0.5 text-xs font-semibold text-[var(--color-heading)]">
              {regionLabel}
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}


/* =========================================================
   DECISION OVERVIEW
========================================================= */

function DecisionOverview({
  data,
  hasActions,
}) {
  return (
    <section
      className="
        relative
        mb-9
        overflow-hidden
        rounded-lg
        border
        border-[var(--color-line)]
        bg-white
        shadow-sm
      "
    >

      {/* top accent */}

      <div
        className={`
          h-1
          ${
            hasActions
              ? "bg-[var(--color-primary)]"
              : "bg-[var(--color-green)]"
          }
        `}
      />


      <div className="p-6 sm:p-7 lg:p-8">

        {/* =================================================
            DECISION HEADER
        ================================================= */}

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">

          <div className="flex min-w-0 gap-4">

            <div
              className={`
                flex
                h-12
                w-12
                shrink-0
                items-center
                justify-center
                rounded-lg
                ${
                  hasActions
                    ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                    : "bg-[var(--color-green-soft)] text-[var(--color-green)]"
                }
              `}
            >
              {hasActions ? (
                <Target size={22} />
              ) : (
                <CheckCircle2 size={22} />
              )}
            </div>


            <div className="min-w-0">

              <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--color-body)]/40">
                Investigation outcome
              </div>

              <h2 className="text-xl font-bold tracking-tight text-[var(--color-heading)] sm:text-2xl">
                {hasActions
                  ? "Action recommended"
                  : "No immediate action recommended"}
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-body)]/60">
                {data.decisionReason ||
                  data.note ||
                  "The investigation engine has not identified a sufficiently actionable driver."}
              </p>

            </div>

          </div>


          {/* DECISION BADGE */}

          <div
            className={`
              flex
              shrink-0
              items-center
              gap-2
              rounded-full
              px-4
              py-2
              text-[10px]
              font-bold
              ${
                hasActions
                  ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                  : "bg-[var(--color-green-soft)] text-[var(--color-green)]"
              }
            `}
          >

            {hasActions ? (
              <Zap size={13} />
            ) : (
              <CheckCircle2 size={13} />
            )}

            {data.decision || "Monitor"}

          </div>

        </div>


        {/* =================================================
            DECISION METRICS
        ================================================= */}

        <div className="mt-7 grid grid-cols-1 gap-3 border-t border-[var(--color-line)] pt-6 sm:grid-cols-3">

          <SummaryCard
            icon={<Crosshair size={16} />}
            label="Leading driver"
            value={data.driver || "None identified"}
          />

          <SummaryCard
            icon={<Activity size={16} />}
            label="Investigation scope"
            value={
              data.region === "all"
                ? "All regions"
                : cap(data.region)
            }
          />

          <SummaryCard
            icon={<Zap size={16} />}
            label="Recommended actions"
            value={data.actions?.length || 0}
          />

        </div>

      </div>

    </section>
  );
}


/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  icon,
  label,
  value,
}) {
  return (
    <div
      className="
        flex
        min-w-0
        items-center
        gap-3
        rounded-lg
        bg-[var(--color-paper)]
        px-4
        py-3.5
        transition
        hover:bg-[var(--color-canvas)]
      "
    >

      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-[var(--color-primary)] shadow-sm">
        {icon}
      </div>

      <div className="min-w-0">

        <div className="text-[8px] font-bold uppercase tracking-[0.11em] text-[var(--color-body)]/40">
          {label}
        </div>

        <div className="mt-0.5 truncate text-xs font-bold text-[var(--color-heading)]">
          {value}
        </div>

      </div>

    </div>
  );
}


/* =========================================================
   ACTION LIST
========================================================= */

function ActionList({ actions }) {
  return (
    <section>

      <div className="mb-5 flex items-end justify-between">

        <div>

          <div className="flex items-center gap-2">

            <Target
              size={16}
              className="text-[var(--color-primary)]"
            />

            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-heading)]">
              Recommended actions
            </h2>

          </div>

          <p className="mt-1 text-xs text-[var(--color-body)]/45">
            Prioritized interventions based on detected business drivers.
          </p>

        </div>


        <div className="hidden rounded-full bg-[var(--color-canvas)] px-3 py-1.5 text-[10px] font-semibold text-[var(--color-body)] sm:block">
          {actions.length}{" "}
          {actions.length === 1
            ? "recommendation"
            : "recommendations"}
        </div>

      </div>


      <div className="space-y-5">

        {actions.map((action, index) => (
          <ActionCard
            key={action.id}
            action={action}
            index={index}
          />
        ))}

      </div>

    </section>
  );
}


/* =========================================================
   ACTION CARD
========================================================= */

function ActionCard({
  action: a,
  index,
}) {
  const [expanded, setExpanded] = useState(false);

  const confidence = Math.max(
    0,
    Math.min(
      100,
      Number(a.confidence) || 0
    )
  );


  const confidenceTier =
    confidence >= 75
      ? "HIGH"
      : confidence >= 50
        ? "MEDIUM"
        : "LOW";


  const confidenceColor =
    confidence >= 75
      ? "var(--color-green)"
      : confidence >= 50
        ? "var(--color-primary)"
        : "var(--color-clay)";


  return (
    <article
      className="
        overflow-hidden
        rounded-lg
        border
        border-[var(--color-line)]
        bg-white
        shadow-sm
        transition
        duration-200
        hover:-translate-y-[1px]
        hover:border-[var(--color-primary)]/20
        hover:shadow-sm
      "
    >

      <div className="p-5 sm:p-7">

        {/* =================================================
            CARD HEADER
        ================================================= */}

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

          <div className="flex min-w-0 gap-4">

            {/* NUMBER */}

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--color-primary)]/10 font-mono-num text-xs font-bold text-[var(--color-primary)]">
              {String(index + 1).padStart(2, "0")}
            </div>


            <div className="min-w-0">

              <div className="mb-1.5 flex flex-wrap items-center gap-2">

                <h3 className="font-display text-lg font-bold tracking-tight text-[var(--color-heading)]">
                  {a.driver}
                </h3>

                <ConfidenceBadge
                  tier={confidenceTier}
                />

              </div>

              <p className="text-xs text-[var(--color-body)]/45">
                Identified business driver
              </p>

            </div>

          </div>


          {/* CONFIDENCE */}

          <ConfidenceScore
            value={confidence}
            color={confidenceColor}
          />

        </div>


        {/* =================================================
            RECOMMENDATION
        ================================================= */}

        {a.contextualRecommendation && (

          <div className="mt-7 rounded-lg border border-[var(--color-primary)]/10 bg-[var(--color-primary-soft)]/50 p-4 sm:p-5">

            <div className="flex gap-3">

              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-[var(--color-primary)] shadow-sm">

                <Zap size={15} />

              </div>


              <div className="min-w-0">

                <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--color-primary)]">
                  Recommended intervention
                </div>

                <p className="text-sm font-semibold leading-relaxed text-[var(--color-heading)]">
                  {a.contextualRecommendation}
                </p>

              </div>

            </div>

          </div>

        )}


        {/* =================================================
            EXECUTION CONTEXT
        ================================================= */}

        <div className="mt-6">

          <div className="mb-3 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--color-body)]/40">
            Execution context
          </div>


          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">

            <ExecutionCard
              icon={<Gauge size={15} />}
              label="Controllable lever"
              value={a.lever}
            />

            <ExecutionCard
              icon={<UserRound size={15} />}
              label="Owner"
              value={a.owner}
            />

            <ExecutionCard
              icon={<Activity size={15} />}
              label="Monitoring plan"
              value={
                a.monitoringPlan ||
                a.monitoring
              }
            />

          </div>

        </div>


        {/* =================================================
            GOVERNED ACTION
        ================================================= */}

        <div className="mt-5 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4 sm:p-5">

          <div className="mb-2 flex items-center gap-2">

            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[var(--color-primary)] shadow-sm">

              <ShieldCheck size={14} />

            </div>

            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--color-body)]/45">
              Governed action
            </span>

          </div>


          <p className="text-xs leading-relaxed text-[var(--color-body)]/75 sm:text-sm">
            {a.action || "No governed action specified."}
          </p>

        </div>


        {/* =================================================
            IMPACT
        ================================================= */}

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_180px]">

          <div className="rounded-lg border border-[var(--color-line)] bg-white p-4 sm:p-5">

            <div className="mb-2 flex items-center gap-2">

              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-green-soft)] text-[var(--color-green)]">

                <Target size={14} />

              </div>

              <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--color-body)]/45">
                Expected impact
              </span>

            </div>


            <p className="text-xs font-semibold leading-relaxed text-[var(--color-heading)] sm:text-sm">
              {a.expectedImpact ||
                "Impact estimate not available."}
            </p>

          </div>


          {/* CONFIDENCE BOX */}

          <div className="flex items-center justify-center rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-4">

            <div className="text-center">

              <div
                className="font-mono-num text-2xl font-bold"
                style={{
                  color: confidenceColor,
                }}
              >
                {confidence}%
              </div>

              <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--color-body)]/40">
                confidence
              </div>

              <div className="mt-1 text-[9px] text-[var(--color-body)]/40">
                Evidence-backed
              </div>

            </div>

          </div>

        </div>


        {/* =================================================
            IMPACT FORMULA
        ================================================= */}

        {a.impactDetail?.formula && (

          <div className="mt-4">

            <button
              type="button"
              onClick={() =>
                setExpanded((value) => !value)
              }
              className="
                flex
                min-h-[42px]
                items-center
                gap-2
                rounded-md
                px-3
                text-[10px]
                font-semibold
                text-[var(--color-primary)]
                transition
                hover:bg-[var(--color-primary)]/5
              "
            >

              <Info size={14} />

              {expanded
                ? "Hide impact calculation"
                : "View impact calculation"}

              <ChevronDown
                size={13}
                className={`
                  transition-transform
                  ${
                    expanded
                      ? "rotate-180"
                      : ""
                  }
                `}
              />

            </button>


            {expanded && (

              <div className="mt-2 overflow-hidden rounded-lg bg-[var(--color-ink)]">

                <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">

                  <Activity
                    size={13}
                    className="text-white/40"
                  />

                  <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/40">
                    Calculation logic
                  </span>

                </div>


                <div className="overflow-x-auto p-4">

                  <code className="block whitespace-pre-wrap font-mono-num text-[10px] leading-relaxed text-white/70">
                    {a.impactDetail.formula}
                  </code>

                </div>

              </div>

            )}

          </div>

        )}

      </div>


      {/* =================================================
          FOOTER
      ================================================= */}

      <div className="flex items-center justify-between border-t border-[var(--color-line)] bg-[var(--color-paper)] px-5 py-3 sm:px-7">

        <div className="flex items-center gap-2 text-[9px] text-[var(--color-body)]/45">

          <ShieldCheck
            size={12}
            className="text-[var(--color-green)]"
          />

          Governed recommendation

        </div>


        <ArrowRight
          size={14}
          className="text-[var(--color-body)]/25 transition-transform group-hover:translate-x-1"
        />

      </div>

    </article>
  );
}


/* =========================================================
   EXECUTION CARD
========================================================= */

function ExecutionCard({
  icon,
  label,
  value,
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-lg border border-[var(--color-line)] bg-white p-3.5 transition hover:border-[var(--color-primary)]/15">

      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--color-canvas)] text-[var(--color-primary)]">
        {icon}
      </div>


      <div className="min-w-0">

        <div className="text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--color-body)]/40">
          {label}
        </div>

        <div className="mt-1 break-words text-xs font-semibold leading-relaxed text-[var(--color-heading)]">
          {value || "Not specified"}
        </div>

      </div>

    </div>
  );
}


/* =========================================================
   CONFIDENCE BADGE
========================================================= */

function ConfidenceBadge({ tier }) {

  const config = {
    HIGH: {
      label: "High confidence",
      className:
        "bg-[var(--color-green-soft)] text-[var(--color-green)]",
    },

    MEDIUM: {
      label: "Medium confidence",
      className:
        "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",
    },

    LOW: {
      label: "Low confidence",
      className:
        "bg-[var(--color-clay-soft)] text-[var(--color-clay)]",
    },
  };


  const item =
    config[tier] || config.MEDIUM;


  return (
    <span
      className={`
        rounded-full
        px-2.5
        py-1
        text-[9px]
        font-bold
        ${item.className}
      `}
    >
      {item.label}
    </span>
  );
}


/* =========================================================
   CONFIDENCE SCORE
========================================================= */

function ConfidenceScore({
  value,
  color,
}) {
  return (
    <div className="flex shrink-0 items-center gap-3">

      <ConfidenceRing
        value={value}
        tier={value >= 75 ? "HIGH" : value >= 50 ? "MEDIUM" : "LOW"}
        size={56}
      />

      <div className="hidden sm:block">

        <div className="text-[8px] font-bold uppercase tracking-[0.1em] text-[var(--color-body)]/40">
          Confidence
        </div>

        <div className="mt-0.5 text-[10px] font-semibold text-[var(--color-heading)]">
          {value >= 75
            ? "High"
            : value >= 50
              ? "Medium"
              : "Low"}
        </div>

        <div className="text-[9px] text-[var(--color-body)]/40">
          Evidence-backed
        </div>

      </div>

    </div>
  );
}


/* =========================================================
   NO ACTION STATE
========================================================= */

function NoActionState({
  decision,
  reason,
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-[var(--color-green)]/20 bg-white shadow-sm">

      <div className="flex flex-col items-center px-6 py-16 text-center">

        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-[var(--color-green-soft)] text-[var(--color-green)]">

          <CheckCircle2 size={28} />

        </div>


        <h2 className="mt-5 text-xl font-bold tracking-tight text-[var(--color-heading)]">
          No action recommended yet
        </h2>


        <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--color-body)]/60">
          {reason ||
            "The available evidence does not currently support a sufficiently strong intervention."}
        </p>


        {decision && (

          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--color-paper)] px-4 py-2 text-[9px] font-bold uppercase tracking-wide text-[var(--color-body)]/50">

            <AlertCircle size={12} />

            Decision: {decision}

          </div>

        )}

      </div>

    </section>
  );
}