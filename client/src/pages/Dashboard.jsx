import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Database,
  Zap,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";


/* =========================================================
   FORMATTING
========================================================= */

const UNIT_FMT = {
  currency: (v) =>
    `₹${Math.round(v).toLocaleString("en-IN")}`,

  count: (v) =>
    Math.round(v).toLocaleString("en-IN"),

  percent: (v) =>
    `${(v * 100).toFixed(1)}%`,
};


function formatValue(card) {
  if (UNIT_FMT[card.unit]) {
    return UNIT_FMT[card.unit](card.currentValue);
  }

  return card.currentValue;
}


function getTrend(card) {
  const change = Number(card.pctChange) || 0;

  return {
    change,
    negative: change < 0,
    icon: change < 0 ? ArrowDownRight : ArrowUpRight,
  };
}


/* =========================================================
   MAIN DASHBOARD
========================================================= */

export default function Dashboard() {

  const { token, region } = useAuth();

  const [data, setData] = useState(null);
  const [aiStatus, setAiStatus] = useState(null);
  const [error, setError] = useState(null);


  useEffect(() => {

    setData(null);
    setError(null);

    api
      .dashboard(token, region)
      .then(setData)
      .catch((e) => setError(e.message));

    api
      .aiEngineStatus(token)
      .then(setAiStatus)
      .catch(() => {});

  }, [token, region]);


  /*
   * Material KPIs are the primary attention signals.
   * We don't invent new backend logic.
   */
  const attention = useMemo(() => {

    if (!data?.cards) {
      return [];
    }

    return data.cards
      .filter((card) => card.materiality?.isMaterial)
      .sort(
        (a, b) =>
          Math.abs(Number(b.pctChange || 0)) -
          Math.abs(Number(a.pctChange || 0))
      )
      .slice(0, 3);

  }, [data]);


  if (error) {
    return <ErrorPanel message={error} />;
  }


  if (!data) {
    return <Loading />;
  }


  return (
    <div className="mx-auto max-w-7xl px-5 pb-16 sm:px-7 lg:px-8">

      {/* =====================================================
          HERO
      ===================================================== */}

      <header className="pb-8 pt-3">

        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">

          <div>

            <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--color-body)]/45">
              Operations · Revenue &amp; Growth
            </div>


            <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-heading)] sm:text-3xl">

              Executive Overview

            </h1>


            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--color-body)]/55">

              Understand what changed, where performance moved,
              and which signals deserve attention.

            </p>

          </div>


          <div className="flex items-center gap-3">

            <Provenance
              provenance={data.provenance}
            />

            <div className="h-4 w-px bg-[var(--color-line)]" />

            <div className="text-[10px] font-semibold text-[var(--color-body)]/50">

              {data.region === "all"
                ? "All regions"
                : cap(data.region)}

            </div>

          </div>

        </div>

      </header>


      {/* =====================================================
          HEALTH STRIP
      ===================================================== */}

      <BusinessHealth
        cards={data.cards}
        freshness={data.freshness}
        attentionCount={attention.length}
      />


      {/* =====================================================
          PERFORMANCE
      ===================================================== */}

      <section className="mt-10">

        <SectionHeading
          eyebrow="Performance"
          title="Business performance"
          description="How your key indicators are moving against their historical baseline."
        />


        <div className="mt-5 grid grid-cols-1 gap-x-5 sm:grid-cols-2 lg:grid-cols-3">

          {data.cards.map((card) => (

            <PerformanceCard
              key={card.kpiId}
              card={card}
            />

          ))}

        </div>

      </section>


      {/* =====================================================
          ATTENTION
      ===================================================== */}

      {attention.length > 0 && (

        <AttentionSection
          items={attention}
        />

      )}


      {/* =====================================================
          DATA HEALTH
      ===================================================== */}

      <section className="mt-12">

        <SectionHeading
          eyebrow="Reliability"
          title="Data health"
          description="Freshness and quality across your connected sources."
        />


        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">

          {data.freshness.details.map((detail) => (

            <DataHealthCard
              key={detail.source}
              detail={detail}
            />

          ))}

        </div>

      </section>


      {/* =====================================================
          AI ENGINE
      ===================================================== */}

      {aiStatus && (

        <section className="mt-12">

          <AiEngine
            status={aiStatus}
          />

        </section>

      )}

    </div>
  );
}


/* =========================================================
   BUSINESS HEALTH
========================================================= */

function BusinessHealth({
  cards,
  freshness,
  attentionCount,
}) {

  const healthyCount =
    cards.filter(
      (card) =>
        !card.materiality?.isMaterial
    ).length;


  return (
    <div
      className="
        overflow-hidden
        rounded-lg
        border
        border-[var(--color-line)]
        bg-white
        shadow-sm
      "
    >

      <div className="flex flex-col divide-y divide-[var(--color-line)] sm:flex-row sm:divide-x sm:divide-y-0">

        {/* KPI COUNT */}

        <HealthMetric
          icon={Activity}
          label="Business signals"
          value={cards.length}
          suffix="tracked"
          description={`${healthyCount} currently stable`}
        />


        {/* ATTENTION */}

        <HealthMetric
          icon={AlertTriangle}
          label="Needs attention"
          value={attentionCount}
          suffix={attentionCount === 1 ? "signal" : "signals"}
          warning={attentionCount > 0}
          description={
            attentionCount > 0
              ? "Material performance signals"
              : "No material signals detected"
          }
        />


        {/* DATA */}

        <HealthMetric
          icon={Database}
          label="Data quality"
          value={`${freshness.overall ?? "N/A"}`}
          suffix="/100"
          description="Overall source reliability"
        />

      </div>

    </div>
  );
}


function HealthMetric({
  icon: Icon,
  label,
  value,
  suffix,
  description,
  warning = false,
}) {

  return (
    <div className="flex flex-1 items-center gap-3 px-4 py-4 sm:px-5">

      <div
        className={`
          flex
          h-9
          w-9
          shrink-0
          items-center
          justify-center
          rounded-md
          ${
            warning
              ? "bg-[var(--color-clay-soft)] text-[var(--color-clay)]"
              : "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
          }
        `}
      >

        <Icon className="h-4 w-4" />

      </div>


      <div className="min-w-0">

        <div className="text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--color-body)]/40">
          {label}
        </div>


        <div className="mt-0.5 flex items-baseline gap-1">

          <span className="font-mono-num text-lg font-bold text-[var(--color-heading)]">
            {value}
          </span>

          <span className="text-[9px] font-medium text-[var(--color-body)]/40">
            {suffix}
          </span>

        </div>


        <div className="mt-0.5 truncate text-[8px] text-[var(--color-body)]/35">
          {description}
        </div>

      </div>

    </div>
  );
}


/* =========================================================
   SECTION HEADING
========================================================= */

function SectionHeading({
  eyebrow,
  title,
  description,
  warning = false,
}) {

  return (
    <div>

      <div
        className={`
          text-[9px]
          font-bold
          uppercase
          tracking-[0.16em]
          ${
            warning
              ? "text-[var(--color-clay)]"
              : "text-[var(--color-primary)]"
          }
        `}
      >
        {eyebrow}
      </div>


      <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-[var(--color-heading)]">
        {title}
      </h2>


      <p className="mt-1 text-[10px] text-[var(--color-body)]/45">
        {description}
      </p>

    </div>
  );
}


/* =========================================================
   PERFORMANCE CARD
========================================================= */

function PerformanceCard({
  card,
}) {

  const {
    change,
    negative,
    icon: TrendIcon,
  } = getTrend(card);


  return (
    <Link
      to={`/story/${card.kpiId}`}
      className="group"
    >

      <article
        className="
          relative
          mt-3
          overflow-hidden
          rounded-lg
          border
          border-[var(--color-line)]
          bg-white
          p-5
          shadow-sm
          transition-all
          duration-200
          hover:-translate-y-0.5
          hover:border-[var(--color-primary)]/25
          hover:shadow-sm
        "
      >

        {/* colored top accent */}

        <div
          className={`
            absolute
            left-0
            top-0
            h-0.5
            w-full
            ${
              negative
                ? "bg-[var(--color-clay)]/70"
                : "bg-[var(--color-green)]/60"
            }
          `}
        />


        {/* HEADER */}

        <div className="flex items-start justify-between gap-3">

          <div>

            <div className="text-[8px] font-bold uppercase tracking-[0.12em] text-[var(--color-body)]/35">
              KPI
            </div>

            <h3 className="mt-1 text-sm font-semibold text-[var(--color-heading)]">
              {card.name}
            </h3>

          </div>


          {card.materiality?.isMaterial && (

            <span
              className={`
                text-[8px]
                font-bold
                uppercase
                tracking-[0.1em]
                ${
                  negative
                    ? "text-[var(--color-clay)]"
                    : "text-[var(--color-primary)]"
                }
              `}
            >
              {card.priority}
            </span>

          )}

        </div>


        {/* VALUE */}

        <div className="mt-7">

          <div className="font-mono-num text-[30px] font-bold leading-none tracking-[-0.03em] text-[var(--color-heading)]">
            {formatValue(card)}
          </div>


          <div className="mt-3 flex items-center justify-between">

            <div
              className={`
                flex
                items-center
                gap-1.5
                text-[10px]
                font-bold
                ${
                  negative
                    ? "text-[var(--color-clay)]"
                    : "text-[var(--color-green)]"
                }
              `}
            >

              <TrendIcon className="h-3.5 w-3.5" />

              {change > 0 ? "+" : ""}
              {change}%

              <span className="font-normal text-[var(--color-body)]/35">
                vs baseline
              </span>

            </div>


            <ArrowRight
              className="
                h-3.5
                w-3.5
                text-[var(--color-primary)]
                opacity-0
                transition-all
                group-hover:translate-x-1
                group-hover:opacity-100
              "
            />

          </div>

        </div>


        {/* BOTTOM */}

        <div className="mt-5 flex items-center justify-between border-t border-[var(--color-line)] pt-3">

          <span className="text-[8px] capitalize text-[var(--color-body)]/35">
            {card.trend || "flat"} trend
          </span>


          <span className="text-[8px] font-semibold text-[var(--color-primary)] opacity-0 transition-opacity group-hover:opacity-100">
            View analysis
          </span>

        </div>

      </article>

    </Link>
  );
}


/* =========================================================
   ATTENTION SECTION
========================================================= */

function AttentionSection({
  items,
}) {

  return (
    <section className="mt-12">

      <div className="flex items-end justify-between">

        <SectionHeading
          eyebrow="Priority signals"
          title="What needs your attention"
          description="Material changes that may require investigation."
          warning
        />

        <div className="mb-0.5 hidden items-center gap-1.5 text-[9px] font-semibold text-[var(--color-clay)] sm:flex">

          <AlertTriangle className="h-3 w-3" />

          {items.length} signals

        </div>

      </div>


      <div className="mt-5 overflow-hidden rounded-lg border border-[var(--color-clay)]/15 bg-white shadow-sm">

        {items.map((card, index) => (

          <AttentionRow
            key={card.kpiId}
            card={card}
            index={index}
            last={index === items.length - 1}
          />

        ))}

      </div>

    </section>
  );
}


/* =========================================================
   ATTENTION ROW
========================================================= */

function AttentionRow({
  card,
  index,
  last,
}) {

  const {
    change,
    negative,
    icon: TrendIcon,
  } = getTrend(card);


  return (
    <Link
      to={`/story/${card.kpiId}`}
      className={`
        group
        flex
        items-center
        gap-4
        px-4
        py-4
        transition-colors
        hover:bg-[var(--color-canvas)]/60
        sm:px-5
        ${
          !last
            ? "border-b border-[var(--color-line)]"
            : ""
        }
      `}
    >

      {/* NUMBER */}

      <span className="hidden w-5 font-mono-num text-[9px] text-[var(--color-body)]/25 sm:block">
        0{index + 1}
      </span>


      {/* ICON */}

      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--color-clay-soft)] text-[var(--color-clay)]">

        <AlertTriangle className="h-4 w-4" />

      </div>


      {/* CONTENT */}

      <div className="min-w-0 flex-1">

        <div className="flex items-center gap-2">

          <span className="truncate text-xs font-bold text-[var(--color-heading)] sm:text-sm">
            {card.name}
          </span>


          {card.priority && (

            <span className="hidden text-[8px] font-bold uppercase tracking-wider text-[var(--color-clay)] sm:inline">
              {card.priority}
            </span>

          )}

        </div>


        <p className="mt-1 truncate text-[9px] text-[var(--color-body)]/40">
          Material performance signal · investigation recommended
        </p>

      </div>


      {/* CHANGE */}

      <div
        className={`
          hidden
          items-center
          gap-1
          text-xs
          font-bold
          sm:flex
          ${
            negative
              ? "text-[var(--color-clay)]"
              : "text-[var(--color-green)]"
          }
        `}
      >

        <TrendIcon className="h-3.5 w-3.5" />

        {change > 0 ? "+" : ""}
        {change}%

      </div>


      {/* CTA */}

      <div className="flex items-center gap-1 text-[9px] font-bold text-[var(--color-primary)]">

        <span className="hidden sm:inline">
          Investigate
        </span>

        <ArrowRight
          className="
            h-3.5
            w-3.5
            transition-transform
            group-hover:translate-x-1
          "
        />

      </div>

    </Link>
  );
}


/* =========================================================
   DATA HEALTH CARD
========================================================= */

function DataHealthCard({
  detail,
}) {

  const score = Math.max(
    0,
    Math.min(
      100,
      Number(detail.score) || 0
    )
  );


  const healthy = score >= 80;


  return (
    <div className="rounded-md border border-[var(--color-line)] bg-white p-4">

      <div className="flex items-center justify-between">

        <div className="flex items-center gap-2">

          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-canvas)]">

            <Database className="h-3.5 w-3.5 text-[var(--color-body)]/50" />

          </div>


          <span className="text-xs font-bold text-[var(--color-heading)]">
            {detail.source}
          </span>

        </div>


        <div className="flex items-center gap-1.5">

          <span
            className={`
              h-1.5
              w-1.5
              rounded-full
              ${
                healthy
                  ? "bg-[var(--color-green)]"
                  : "bg-[var(--color-clay)]"
              }
            `}
          />

          <span className="text-[8px] font-semibold text-[var(--color-body)]/45">
            {healthy ? "Healthy" : "Review"}
          </span>

        </div>

      </div>


      <div className="mt-4 flex items-end justify-between">

        <div>

          <span className="font-mono-num text-xl font-bold text-[var(--color-heading)]">
            {score}
          </span>

          <span className="ml-1 text-[8px] text-[var(--color-body)]/35">
            /100
          </span>

        </div>


        <div className="text-right">

          <div className="text-[9px] font-semibold text-[var(--color-body)]/45">
            {detail.ageMinutes}m ago
          </div>

          <div className="mt-0.5 text-[8px] text-[var(--color-body)]/30">
            {detail.cadence}
          </div>

        </div>

      </div>


      <div className="mt-3 h-1 overflow-hidden rounded-full bg-[var(--color-line)]">

        <div
          className={`
            h-full rounded-full
            ${
              healthy
                ? "bg-[var(--color-green)]"
                : "bg-[var(--color-clay)]"
            }
          `}
          style={{
            width: `${score}%`,
          }}
        />

      </div>

    </div>
  );
}


/* =========================================================
   AI ENGINE
========================================================= */

function AiEngine({
  status,
}) {

  const [open, setOpen] = useState(false);


  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-line)] bg-white">

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >

        <div className="flex items-center gap-3">

          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary-soft)]">

            <BrainCircuit className="h-4 w-4 text-[var(--color-primary)]" />

          </div>


          <div>

            <div className="flex items-center gap-2">

              <span className="text-xs font-bold text-[var(--color-heading)]">
                Intelligence engine
              </span>


              <span className="flex items-center gap-1.5 text-[8px] font-bold text-[var(--color-green)]">

                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-green)]" />

                {status.status}

              </span>

            </div>


            <div className="mt-0.5 max-w-lg truncate text-[8px] text-[var(--color-body)]/35">
              {status.architecture}
            </div>

          </div>

        </div>


        <ChevronDown
          className={`
            h-4
            w-4
            text-[var(--color-body)]/30
            transition-transform
            ${
              open
                ? "rotate-180"
                : ""
            }
          `}
        />

      </button>


      {open && (

        <div className="border-t border-[var(--color-line)] p-5">

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">

            {status.components?.map((component) => (

              <div
                key={component.name}
                className="rounded-md bg-[var(--color-canvas)] p-3"
              >

                <div className="flex items-center gap-2">

                  <CheckCircle2 className="h-3 w-3 text-[var(--color-green)]" />

                  <span className="text-[9px] font-bold text-[var(--color-heading)]">
                    {component.name}
                  </span>

                </div>


                <p className="mt-2 text-[8px] leading-relaxed text-[var(--color-body)]/45">
                  {component.role}
                </p>

              </div>

            ))}

          </div>

        </div>

      )}

    </div>
  );
}


/* =========================================================
   PROVENANCE
========================================================= */

function Provenance({
  provenance,
}) {

  if (!provenance) {
    return null;
  }


  const live =
    Object.values(provenance).some(
      (value) =>
        typeof value === "string" &&
        value.includes("live")
    );


  return (
    <div className="flex items-center gap-2 text-[9px] font-semibold text-[var(--color-body)]/50">

      <span
        className={`
          h-1.5
          w-1.5
          rounded-full
          ${
            live
              ? "bg-[var(--color-green)]"
              : "bg-[var(--color-body)]/25"
          }
        `}
      />

      {live
        ? "Live data"
        : provenance.erp === "csv"
          ? "CSV data"
          : "Demo data"}

    </div>
  );
}


/* =========================================================
   SHARED PAGE HEADER
   Used by other existing pages
========================================================= */

export function PageHeader({
  title,
  subtitle,
  right,
}) {

  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-[var(--color-line)] pb-6 sm:flex-row sm:items-end sm:justify-between">

      <div>

        <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-heading)]">
          {title}
        </h1>


        {subtitle && (

          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-[var(--color-body)]/55 sm:text-sm">
            {subtitle}
          </p>

        )}

      </div>


      {right && (

        <div className="shrink-0">
          {right}
        </div>

      )}

    </div>
  );
}


/* =========================================================
   LOADING
========================================================= */

export function Loading() {

  return (
    <div className="flex min-h-[400px] items-center justify-center">

      <div className="text-center">

        <div className="mx-auto mb-4 h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-line)] border-t-[var(--color-primary)]" />

        <p className="text-xs font-semibold text-[var(--color-heading)]">
          Loading intelligence…
        </p>

        <p className="mt-1 text-[9px] text-[var(--color-body)]/35">
          Preparing your business view
        </p>

      </div>

    </div>
  );
}


/* =========================================================
   ERROR
========================================================= */

export function ErrorPanel({
  message,
}) {

  return (
    <div className="mx-auto max-w-6xl px-5 sm:px-7 lg:px-8">

      <div className="rounded-md border border-[var(--color-clay)]/20 bg-[var(--color-clay-soft)] p-4">

        <div className="flex items-start gap-3">

          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-clay)]" />

          <div>

            <div className="text-xs font-bold text-[var(--color-clay)]">
              Unable to load this page
            </div>

            <p className="mt-1 text-xs text-[var(--color-clay)]/70">
              {message}
            </p>

          </div>

        </div>

      </div>

    </div>
  );
}


/* =========================================================
   CAPITALIZE
========================================================= */

export function cap(value) {

  if (!value) {
    return value;
  }

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}