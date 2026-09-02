import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { PageHeader, Loading, ErrorPanel } from "./Dashboard";
import Badge from "../components/Badge";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Info,
  Package,
  TrendingUp,
} from "lucide-react";

export default function SparseProduct() {
  const { token } = useAuth();

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setError(null);

    api
      .sparseProduct(token)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [token]);

  if (error) return <ErrorPanel message={error} />;
  if (!data) return <Loading />;

  const series = data.series || [];

  const maxOrders = Math.max(
    ...series.map((d) => Number(d.orders) || 0),
    1
  );

  const latestOrders =
    series.length > 0 ? Number(series[series.length - 1].orders) || 0 : 0;

  const totalOrders = series.reduce(
    (sum, d) => sum + (Number(d.orders) || 0),
    0
  );

  const historyProgress = Math.min(
    ((data.daysOfHistory || 0) / (data.minHistoryRequired || 1)) * 100,
    100
  );

  const confidenceTier = data.confidence?.tier || "LOW";

  return (
    <div className="mx-auto w-full max-w-[1400px] pb-12">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <PageHeader
        title="New Product Monitor"
        subtitle={`${data.product} · West · launched ${data.launchDate}`}
        right={
          <div className="flex items-center gap-2 rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-[9px] font-medium text-[var(--color-body)]/60">
            <Package size={13} />
            Early-stage product
          </div>
        }
      />


      {/* =====================================================
          DECISION BANNER
      ===================================================== */}

      <DecisionBanner
        confidence={data.confidence?.overall}
        tier={confidenceTier}
        reason={data.decisionReason}
      />


      {/* =====================================================
          TOP SIGNALS
      ===================================================== */}

      <section className="mt-5">

        <SectionHeading
          number="01"
          title="Current signals"
          description="What the available product history tells us today"
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">

          <SignalCard
            icon={<Clock3 size={15} />}
            label="History available"
            value={`${data.daysOfHistory}`}
            suffix={`/ ${data.minHistoryRequired} days`}
            progress={historyProgress}
          />

          <SignalCard
            icon={<TrendingUp size={15} />}
            label="Early adoption growth"
            value={`${data.earlyAdoptionGrowthPct}%`}
            positive={data.earlyAdoptionGrowthPct >= 0}
          />

          <SignalCard
            icon={<BarChart3 size={15} />}
            label="Peer benchmark growth"
            value={`${data.peerBenchmarkGrowthPct}%`}
            positive={data.peerBenchmarkGrowthPct >= 0}
          />

          <SignalCard
            icon={<CheckCircle2 size={15} />}
            label="Confidence"
            value={`${data.confidence?.overall ?? "N/A"}%`}
            badge={
              <Badge variant={confidenceTier}>
                {confidenceTier}
              </Badge>
            }
          />

        </div>

      </section>


      {/* =====================================================
          PRODUCT CONTEXT
      ===================================================== */}

      <section className="mt-8">

        <SectionHeading
          number="02"
          title="Decision context"
          description="Why the system is withholding a stronger conclusion"
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_0.6fr]">

          {/* NARRATIVE */}

          <div className="rounded-md border border-[var(--color-line)] bg-white p-5">

            <div className="flex items-center gap-2">

              <Info
                size={14}
                className="text-[var(--color-primary)]"
              />

              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-body)]/40">
                Analyst narrative
              </span>

            </div>

            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-heading)]">
              {data.narrative}
            </p>

          </div>


          {/* DATA COVERAGE */}

          <div className="rounded-md border border-[var(--color-line)] bg-white p-5">

            <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--color-body)]/40">
              Coverage status
            </div>

            <div className="mt-3">

              <div className="flex items-end justify-between">

                <span className="font-mono-num text-2xl font-semibold text-[var(--color-heading)]">
                  {data.daysOfHistory}
                </span>

                <span className="text-[9px] text-[var(--color-body)]/40">
                  days observed
                </span>

              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-canvas)]">

                <div
                  className="h-full rounded-full bg-[var(--color-primary)] transition-all"
                  style={{
                    width: `${historyProgress}%`,
                  }}
                />

              </div>

              <div className="mt-2 flex justify-between text-[8px] text-[var(--color-body)]/35">

                <span>Launch</span>

                <span>
                  Required: {data.minHistoryRequired} days
                </span>

              </div>

            </div>

            <div className="mt-5 border-t border-[var(--color-line)] pt-4">

              <div className="flex items-center gap-2 text-[9px] text-[var(--color-body)]/50">

                <CalendarDays size={12} />

                Launched {data.launchDate}

              </div>

            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          BENCHMARK COMPARISON
      ===================================================== */}

      <section className="mt-8">

        <SectionHeading
          number="03"
          title="Adoption benchmark"
          description="Early product trajectory compared with the peer benchmark"
        />

        <div className="rounded-md border border-[var(--color-line)] bg-white">

          <div className="grid grid-cols-1 md:grid-cols-2">

            <BenchmarkRow
              label="This product"
              value={data.earlyAdoptionGrowthPct}
              icon={<Package size={14} />}
            />

            <BenchmarkRow
              label="Peer benchmark"
              value={data.peerBenchmarkGrowthPct}
              icon={<BarChart3 size={14} />}
              border
            />

          </div>

          <div className="border-t border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-3">

            <div className="flex items-center gap-2">

              <ArrowUpRight
                size={12}
                className="text-[var(--color-primary)]"
              />

              <span className="text-[9px] text-[var(--color-body)]/55">

                Benchmark comparison is directional because historical
                coverage is still below the required threshold.

              </span>

            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          DAILY ORDERS
      ===================================================== */}

      <section className="mt-8">

        <SectionHeading
          number="04"
          title="Adoption trajectory"
          description="Daily order volume since product launch"
          right={
            <div className="flex items-center gap-3 text-[8px] text-[var(--color-body)]/40">

              <span>
                {series.length} observations
              </span>

              <span className="h-1 w-1 rounded-full bg-[var(--color-body)]/25" />

              <span>
                {totalOrders.toLocaleString("en-IN")} total orders
              </span>

            </div>
          }
        />

        <div className="rounded-md border border-[var(--color-line)] bg-white p-5">

          {series.length === 0 ? (

            <div className="flex h-48 items-center justify-center text-xs text-[var(--color-body)]/40">
              No order history available.
            </div>

          ) : (

            <div>

              {/* CHART */}

              <div className="relative h-[250px]">

                {/* Y AXIS */}

                <div className="absolute inset-y-0 left-0 flex w-9 flex-col justify-between text-right">

                  <span className="font-mono-num text-[8px] text-[var(--color-body)]/30">
                    {maxOrders}
                  </span>

                  <span className="font-mono-num text-[8px] text-[var(--color-body)]/30">
                    {Math.round(maxOrders * 0.5)}
                  </span>

                  <span className="font-mono-num text-[8px] text-[var(--color-body)]/30">
                    0
                  </span>

                </div>


                {/* GRAPH AREA */}

                <div className="absolute inset-y-0 left-12 right-0">

                  {/* GRID */}

                  <div className="absolute inset-0 flex flex-col justify-between">

                    <div className="border-t border-[var(--color-line)]" />
                    <div className="border-t border-dashed border-[var(--color-line)]" />
                    <div className="border-t border-[var(--color-line)]" />

                  </div>


                  {/* BARS */}

                  <div className="absolute inset-x-0 bottom-0 top-2 flex items-end gap-1">

                    {series.map((d, index) => {

                      const orders = Number(d.orders) || 0;

                      const height =
                        Math.max(
                          (orders / maxOrders) * 210,
                          orders > 0 ? 4 : 1
                        );

                      const isLatest =
                        index === series.length - 1;

                      return (

                        <div
                          key={d.date}
                          className="group relative flex h-full flex-1 items-end"
                        >

                          {/* TOOLTIP */}

                          <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--color-ink)] px-2.5 py-1.5 text-[8px] text-white shadow-lg group-hover:block">

                            <div className="font-semibold">
                              {d.date}
                            </div>

                            <div className="mt-0.5 text-white/60">
                              {orders} orders
                            </div>

                          </div>


                          {/* BAR */}

                          <div
                            className={`w-full rounded-t-[3px] transition-all ${
                              isLatest
                                ? "bg-[var(--color-primary)]"
                                : "bg-[var(--color-primary)]/45"
                            } group-hover:bg-[var(--color-primary)]`}
                            style={{
                              height: `${height}px`,
                            }}
                          />

                        </div>

                      );

                    })}

                  </div>

                </div>

              </div>


              {/* X AXIS */}

              <div className="ml-12 mt-2 flex justify-between border-t border-[var(--color-line)] pt-2">

                <span className="font-mono-num text-[8px] text-[var(--color-body)]/35">
                  {series[0]?.date?.slice(5)}
                </span>

                <span className="font-mono-num text-[8px] text-[var(--color-body)]/35">
                  {series[Math.floor(series.length / 2)]?.date?.slice(5)}
                </span>

                <span className="font-mono-num text-[8px] text-[var(--color-body)]/35">
                  {series[series.length - 1]?.date?.slice(5)}
                </span>

              </div>


              {/* LATEST VALUE */}

              <div className="mt-5 flex flex-col gap-3 border-t border-[var(--color-line)] pt-4 sm:flex-row sm:items-center sm:justify-between">

                <div>

                  <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[var(--color-body)]/35">
                    Latest observed volume
                  </div>

                  <div className="mt-1 font-mono-num text-xl font-semibold text-[var(--color-heading)]">
                    {latestOrders.toLocaleString("en-IN")}
                    <span className="ml-1 text-[9px] font-normal text-[var(--color-body)]/40">
                      orders
                    </span>
                  </div>

                </div>

                <div className="flex items-center gap-2 text-[9px] text-[var(--color-body)]/45">

                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]" />

                  Latest observation highlighted

                </div>

              </div>

            </div>

          )}

        </div>

      </section>


      {/* =====================================================
          INTERPRETATION
      ===================================================== */}

      <section className="mt-8">

        <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-5 py-4">

          <div className="flex gap-3">

            <AlertTriangle
              size={15}
              className="mt-0.5 shrink-0 text-[var(--color-amber)]"
            />

            <div>

              <div className="text-[10px] font-semibold text-[var(--color-heading)]">
                Decision guardrail
              </div>

              <p className="mt-1 text-[9px] leading-5 text-[var(--color-body)]/55">

                The system is intentionally conservative while the product
                has insufficient historical coverage. Growth signals can
                be monitored, but they should not yet be treated as a
                stable long-term performance pattern.

              </p>

            </div>

          </div>

        </div>

      </section>


      {/* FOOTNOTE */}

      <div className="mt-8 border-t border-[var(--color-line)] pt-4 text-[9px] text-[var(--color-body)]/35">

        Sparse-history analysis · {data.product} · West region

      </div>

    </div>
  );
}


/* =========================================================
   DECISION BANNER
========================================================= */

function DecisionBanner({
  confidence,
  tier,
  reason,
}) {

  return (
    <div className="rounded-md border border-[var(--color-amber)]/20 bg-[var(--color-amber-soft)]/35 px-4 py-4">

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

        <div className="flex gap-3">

          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-amber-soft)] text-[var(--color-amber)]">

            <AlertTriangle size={16} />

          </div>

          <div>

            <div className="text-xs font-semibold text-[var(--color-heading)]">
              Insufficient historical coverage
            </div>

            <p className="mt-1 max-w-3xl text-[10px] leading-5 text-[var(--color-body)]/60">
              {reason}
            </p>

          </div>

        </div>

        <div className="flex items-center gap-2">

          <Badge variant={tier}>
            {confidence ?? "N/A"}% confidence
          </Badge>

        </div>

      </div>

    </div>
  );
}


/* =========================================================
   SIGNAL CARD
========================================================= */

function SignalCard({
  icon,
  label,
  value,
  suffix,
  progress,
  positive,
  badge,
}) {

  return (
    <div className="rounded-md border border-[var(--color-line)] bg-white p-4">

      <div className="flex items-center justify-between">

        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-canvas)] text-[var(--color-body)]/50">
          {icon}
        </div>

        {badge}

      </div>

      <div className="mt-4">

        <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-[var(--color-body)]/35">
          {label}
        </div>

        <div className="mt-1 flex items-baseline gap-1">

          <span
            className={`font-mono-num text-2xl font-semibold ${
              positive === false
                ? "text-[var(--color-clay)]"
                : "text-[var(--color-heading)]"
            }`}
          >
            {value}
          </span>

          {suffix && (
            <span className="text-[9px] text-[var(--color-body)]/40">
              {suffix}
            </span>
          )}

        </div>

      </div>

      {progress != null && (

        <div className="mt-4">

          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-canvas)]">

            <div
              className="h-full rounded-full bg-[var(--color-primary)]"
              style={{
                width: `${progress}%`,
              }}
            />

          </div>

        </div>

      )}

    </div>
  );
}


/* =========================================================
   BENCHMARK
========================================================= */

function BenchmarkRow({
  label,
  value,
  icon,
  border,
}) {

  return (
    <div
      className={`p-5 ${
        border
          ? "border-t border-[var(--color-line)] md:border-l md:border-t-0"
          : ""
      }`}
    >

      <div className="flex items-center gap-2">

        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-canvas)] text-[var(--color-body)]/50">
          {icon}
        </div>

        <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-body)]/40">
          {label}
        </span>

      </div>

      <div className="mt-4 flex items-baseline gap-1">

        <span className="font-mono-num text-3xl font-semibold text-[var(--color-heading)]">
          {value}%
        </span>

        <span className="text-[9px] text-[var(--color-body)]/40">
          growth
        </span>

      </div>

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
  right,
}) {

  return (
    <div className="mb-3 flex items-end justify-between gap-4">

      <div className="flex items-start gap-3">

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

      {right}

    </div>
  );
}