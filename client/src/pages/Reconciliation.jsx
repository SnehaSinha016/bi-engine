import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { PageHeader, Loading, ErrorPanel } from "./Dashboard";
import {
  ArrowRight,
  CheckCircle2,
  Database,
  FileCheck2,
  GitMerge,
  MapPin,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Users,
  Ticket,
  ShoppingCart,
} from "lucide-react";
import Badge from "../components/Badge";

export default function Reconciliation() {
  const { token } = useAuth();

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  async function loadData(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    setError(null);

    try {
      const result = await api.reconciliation(token);
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [token]);

  if (error) return <ErrorPanel message={error} />;
  if (!data) return <Loading />;

  if (!data.available) {
    return <UnavailableState data={data} />;
  }

  const cr = data.customerReconciliation;
  const rr = data.regionReconciliation;

  const lowMatch = cr.matchRate < 60;
  const unresolvedRegions = rr.unresolved?.length || 0;

  const overallStatus =
    lowMatch || unresolvedRegions > 0
      ? "attention"
      : "healthy";

  return (
    <div className="mx-auto w-full max-w-[1400px] pb-12">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <PageHeader
        title="Data Reconciliation"
        subtitle="Canonical data quality across ERP, CRM and Support"
        right={
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-[10px] font-semibold text-[var(--color-body)] transition hover:border-[var(--color-primary)]/30 hover:text-[var(--color-primary)] disabled:opacity-50"
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
          STATUS BAR
      ===================================================== */}

      <StatusBanner
        status={overallStatus}
        matchRate={cr.matchRate}
        unresolvedRegions={unresolvedRegions}
      />

      {/* =====================================================
          SOURCE OVERVIEW
      ===================================================== */}

      <section className="mt-5">

        <SectionHeading
          number="01"
          title="Source inventory"
          description="Raw systems contributing records to the canonical model"
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">

          <SourceCard
            title="ERP"
            description="Order-line data"
            icon={<ShoppingCart size={17} />}
            count={data.rawSourceCounts?.erpOrders}
            countLabel="orders"
            mapping='region_code → canonical region'
          />

          <SourceCard
            title="CRM"
            description="Customer records"
            icon={<Users size={17} />}
            count={data.rawSourceCounts?.crmCustomers}
            countLabel="customer records"
            mapping='region_name → canonical region'
          />

          <SourceCard
            title="Support"
            description="Ticket data"
            icon={<Ticket size={17} />}
            count={data.rawSourceCounts?.supportTickets}
            countLabel="tickets"
            mapping='region_label → canonical region'
          />

        </div>

      </section>


      {/* =====================================================
          RECONCILIATION PIPELINE
      ===================================================== */}

      <section className="mt-8">

        <SectionHeading
          number="02"
          title="Reconciliation pipeline"
          description="How heterogeneous source records are normalized"
        />

        <div className="rounded-md border border-[var(--color-line)] bg-white">

          {/* PIPELINE */}

          <div className="grid grid-cols-1 divide-y divide-[var(--color-line)] md:grid-cols-[1fr_auto_1fr_auto_1fr] md:divide-x md:divide-y-0">

            <PipelineStep
              number="01"
              icon={<Database size={16} />}
              title="Raw sources"
              description="ERP, CRM and Support records"
            />

            <PipelineArrow />

            <PipelineStep
              number="02"
              icon={<GitMerge size={16} />}
              title="Identity matching"
              description="CRM ↔ Support customer reconciliation"
              status={
                lowMatch
                  ? "Needs attention"
                  : "Matched"
              }
              negative={lowMatch}
            />

            <PipelineArrow />

            <PipelineStep
              number="03"
              icon={<MapPin size={16} />}
              title="Canonical model"
              description="Normalized region and customer dimensions"
              status={
                unresolvedRegions
                  ? `${unresolvedRegions} unresolved`
                  : "Complete"
              }
              negative={unresolvedRegions > 0}
            />

          </div>

        </div>

      </section>


      {/* =====================================================
          CUSTOMER RECONCILIATION
      ===================================================== */}

      <section className="mt-8">

        <SectionHeading
          number="03"
          title="Customer identity reconciliation"
          description="CRM records matched against Support ticket identities"
          right={
            <StatusBadge
              healthy={!lowMatch}
              label={
                lowMatch
                  ? "Low match quality"
                  : "Healthy"
              }
            />
          }
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">

          {/* MATCH RATE */}

          <div className="rounded-md border border-[var(--color-line)] bg-white p-5">

            <div className="flex items-start justify-between">

              <div>

                <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--color-body)]/40">
                  Customer match rate
                </div>

                <div className="mt-2 flex items-end gap-2">

                  <span className="font-mono-num text-4xl font-semibold tracking-tight text-[var(--color-heading)]">
                    {cr.matchRate}%
                  </span>

                  <span className="mb-1 text-[10px] text-[var(--color-body)]/40">
                    matched
                  </span>

                </div>

              </div>

              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                  lowMatch
                    ? "bg-[var(--color-clay-soft)] text-[var(--color-clay)]"
                    : "bg-[var(--color-green-soft)] text-[var(--color-green)]"
                }`}
              >
                {lowMatch ? (
                  <AlertTriangle size={17} />
                ) : (
                  <CheckCircle2 size={17} />
                )}
              </div>

            </div>


            {/* PROGRESS */}

            <div className="mt-5">

              <div className="h-2 overflow-hidden rounded-full bg-[var(--color-canvas)]">

                <div
                  className={`h-full rounded-full ${
                    lowMatch
                      ? "bg-[var(--color-clay)]"
                      : "bg-[var(--color-green)]"
                  }`}
                  style={{
                    width: `${Math.min(
                      Math.max(cr.matchRate, 0),
                      100
                    )}%`,
                  }}
                />

              </div>

            </div>


            <div className="mt-4 grid grid-cols-2 divide-x divide-[var(--color-line)]">

              <Metric
                label="Matched"
                value={cr.matchedCount}
              />

              <Metric
                label="Unmatched"
                value={cr.unmatchedCount}
              />

            </div>

          </div>


          {/* MAPPING QUALITY */}

          <div className="rounded-md border border-[var(--color-line)] bg-white p-5">

            <div className="flex items-center gap-2">

              <ShieldCheck
                size={15}
                className="text-[var(--color-body)]/45"
              />

              <div className="text-[10px] font-semibold text-[var(--color-heading)]">
                Mapping quality
              </div>

            </div>


            <div className="mt-5">

              <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--color-body)]/40">
                Mapping confidence
              </div>

              <div className="mt-1 font-mono-num text-2xl font-semibold text-[var(--color-heading)]">
                {cr.mappingConfidence}
              </div>

            </div>


            <div className="mt-5 border-t border-[var(--color-line)] pt-4">

              <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--color-body)]/40">
                Reconciliation rule
              </div>

              <p className="mt-1 text-[10px] leading-relaxed text-[var(--color-body)]/55">
                Customer identities are matched across CRM and Support
                records before downstream KPI calculations are performed.
              </p>

            </div>

          </div>

        </div>


        {/* UNMATCHED IDS */}

        {cr.unmatchedSample?.length > 0 && (

          <div className="mt-3 rounded-md border border-[var(--color-line)] bg-white">

            <div className="border-b border-[var(--color-line)] px-4 py-3">

              <div className="text-[10px] font-semibold text-[var(--color-heading)]">
                Unmatched customer sample
              </div>

              <div className="mt-0.5 text-[9px] text-[var(--color-body)]/45">
                Support identities without a corresponding CRM record
              </div>

            </div>

            <div className="flex flex-wrap gap-1.5 p-4">

              {cr.unmatchedSample.map((id) => (

                <span
                  key={id}
                  className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-2 py-1 font-mono-num text-[9px] text-[var(--color-body)]"
                >
                  {id}
                </span>

              ))}

            </div>

          </div>

        )}

      </section>


      {/* =====================================================
          REGION NORMALIZATION
      ===================================================== */}

      <section className="mt-8">

        <SectionHeading
          number="04"
          title="Canonical region mapping"
          description="Normalization rules applied across source-specific region fields"
          right={
            <StatusBadge
              healthy={!unresolvedRegions}
              label={rr.status}
            />
          }
        />

        <div className="rounded-md border border-[var(--color-line)] bg-white">

          <div className="border-b border-[var(--color-line)] px-4 py-3">

            <div className="grid grid-cols-[1fr_40px_1fr] text-[8px] font-semibold uppercase tracking-[0.1em] text-[var(--color-body)]/35">

              <span>Source value</span>

              <span />

              <span>Canonical value</span>

            </div>

          </div>


          <div className="divide-y divide-[var(--color-line)]">

            {rr.mappingsApplied?.map((mapping) => (

              <div
                key={mapping.raw}
                className="grid grid-cols-[1fr_40px_1fr] items-center px-4 py-3"
              >

                <div className="font-mono-num text-[10px] text-[var(--color-body)]">
                  {mapping.raw}
                </div>

                <div className="flex justify-center">
                  <ArrowRight
                    size={13}
                    className="text-[var(--color-body)]/25"
                  />
                </div>

                <div className="text-[10px] font-semibold uppercase text-[var(--color-heading)]">
                  {mapping.canonical}
                </div>

              </div>

            ))}

          </div>


          {unresolvedRegions > 0 && (

            <div className="border-t border-[var(--color-clay)]/15 bg-[var(--color-clay-soft)]/30 px-4 py-3">

              <div className="flex gap-2">

                <AlertTriangle
                  size={13}
                  className="mt-0.5 shrink-0 text-[var(--color-clay)]"
                />

                <div>

                  <div className="text-[10px] font-semibold text-[var(--color-clay)]">
                    Unresolved region values
                  </div>

                  <p className="mt-0.5 text-[9px] leading-relaxed text-[var(--color-body)]/60">

                    {rr.unresolved
                      .map(
                        (u) =>
                          `${u.source}: "${u.rawValue}"`
                      )
                      .join(", ")}

                  </p>

                </div>

              </div>

            </div>

          )}

        </div>

      </section>


      {/* =====================================================
          PROCESSING SUMMARY
      ===================================================== */}

      <section className="mt-8">

        <SectionHeading
          number="05"
          title="Processing summary"
          description="Latest reconciliation run"
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

          <ProcessingMetric
            icon={<FileCheck2 size={14} />}
            label="Records processed"
            value={formatRecords(data.recordsProcessed)}
          />

          <ProcessingMetric
            icon={<ClockIcon />}
            label="Generated"
            value={
              data.generatedAt
                ? data.generatedAt
                    .slice(0, 19)
                    .replace("T", " ")
                : "N/A"
            }
          />

          <ProcessingMetric
            icon={<ShieldCheck size={14} />}
            label="Pipeline status"
            value={
              overallStatus === "healthy"
                ? "Healthy"
                : "Attention required"
            }
          />

        </div>

      </section>


      {/* =====================================================
          FOOTNOTE
      ===================================================== */}

      <div className="mt-8 border-t border-[var(--color-line)] pt-4 text-[9px] leading-5 text-[var(--color-body)]/35">

        Reconciliation is performed against the actual loaded dataset.
        Canonical mappings are applied before downstream KPI calculations
        and investigation logic.

      </div>

    </div>
  );
}


/* =========================================================
   STATUS BANNER
========================================================= */

function StatusBanner({
  status,
  matchRate,
  unresolvedRegions,
}) {

  const healthy = status === "healthy";

  return (
    <div
      className={`flex flex-col gap-3 rounded-md border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
        healthy
          ? "border-[var(--color-green)]/20 bg-[var(--color-green-soft)]/35"
          : "border-[var(--color-clay)]/20 bg-[var(--color-clay-soft)]/35"
      }`}
    >

      <div className="flex items-start gap-3">

        {healthy ? (
          <CheckCircle2
            size={16}
            className="mt-0.5 text-[var(--color-green)]"
          />
        ) : (
          <AlertTriangle
            size={16}
            className="mt-0.5 text-[var(--color-clay)]"
          />
        )}

        <div>

          <div
            className={`text-xs font-semibold ${
              healthy
                ? "text-[var(--color-green)]"
                : "text-[var(--color-clay)]"
            }`}
          >
            {healthy
              ? "Data reconciliation healthy"
              : "Data reconciliation requires attention"}
          </div>

          <div className="mt-0.5 text-[9px] text-[var(--color-body)]/55">

            Customer match rate: {matchRate}%{" "}
            ·{" "}
            Region exceptions: {unresolvedRegions}

          </div>

        </div>

      </div>

      <Badge variant={healthy ? "positive" : "LOW"}>
        {healthy ? "Healthy" : "Review required"}
      </Badge>

    </div>
  );
}


/* =========================================================
   SOURCE CARD
========================================================= */

function SourceCard({
  title,
  description,
  icon,
  count,
  countLabel,
  mapping,
}) {

  return (
    <div className="rounded-md border border-[var(--color-line)] bg-white p-4 transition hover:border-[var(--color-primary)]/20">

      <div className="flex items-center gap-3">

        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-canvas)] text-[var(--color-body)]/55">
          {icon}
        </div>

        <div>

          <div className="text-xs font-semibold text-[var(--color-heading)]">
            {title}
          </div>

          <div className="text-[9px] text-[var(--color-body)]/45">
            {description}
          </div>

        </div>

      </div>


      {count != null && (

        <div className="mt-5">

          <span className="font-mono-num text-2xl font-semibold text-[var(--color-heading)]">
            {Number(count).toLocaleString("en-IN")}
          </span>

          <span className="ml-1 text-[9px] text-[var(--color-body)]/40">
            {countLabel}
          </span>

        </div>

      )}


      <div className="mt-4 border-t border-[var(--color-line)] pt-3">

        <div className="text-[8px] font-semibold uppercase tracking-[0.08em] text-[var(--color-body)]/35">
          Normalization
        </div>

        <div className="mt-1 font-mono-num text-[9px] text-[var(--color-body)]/55">
          {mapping}
        </div>

      </div>

    </div>
  );
}


/* =========================================================
   PIPELINE
========================================================= */

function PipelineStep({
  number,
  icon,
  title,
  description,
  status,
  negative,
}) {

  return (
    <div className="p-5">

      <div className="flex items-center gap-3">

        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-canvas)] text-[var(--color-body)]/55">
          {icon}
        </div>

        <div>

          <div className="text-[8px] font-mono-num text-[var(--color-body)]/30">
            STEP {number}
          </div>

          <div className="text-xs font-semibold text-[var(--color-heading)]">
            {title}
          </div>

        </div>

      </div>

      <p className="mt-3 text-[9px] leading-relaxed text-[var(--color-body)]/50">
        {description}
      </p>

      {status && (

        <div
          className={`mt-3 inline-flex rounded-md px-2 py-1 text-[8px] font-semibold ${
            negative
              ? "bg-[var(--color-clay-soft)] text-[var(--color-clay)]"
              : "bg-[var(--color-green-soft)] text-[var(--color-green)]"
          }`}
        >
          {status}
        </div>

      )}

    </div>
  );
}


function PipelineArrow() {

  return (
    <div className="hidden items-center justify-center md:flex">
      <ArrowRight
        size={15}
        className="text-[var(--color-body)]/20"
      />
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


/* =========================================================
   STATUS BADGE
========================================================= */

function StatusBadge({
  healthy,
  label,
}) {

  return (
    <Badge variant={healthy ? "positive" : "LOW"}>
      {label}
    </Badge>
  );
}


/* =========================================================
   METRIC
========================================================= */

function Metric({
  label,
  value,
}) {

  return (
    <div className="px-3 first:pl-0 last:pr-0">

      <div className="text-[8px] font-semibold uppercase tracking-[0.08em] text-[var(--color-body)]/35">
        {label}
      </div>

      <div className="mt-1 font-mono-num text-sm font-semibold text-[var(--color-heading)]">
        {Number(value).toLocaleString("en-IN")}
      </div>

    </div>
  );
}


/* =========================================================
   PROCESSING METRIC
========================================================= */

function ProcessingMetric({
  icon,
  label,
  value,
}) {

  return (
    <div className="flex items-center gap-3 rounded-md border border-[var(--color-line)] bg-white p-4">

      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-canvas)] text-[var(--color-body)]/50">
        {icon}
      </div>

      <div className="min-w-0">

        <div className="text-[8px] font-semibold uppercase tracking-[0.08em] text-[var(--color-body)]/35">
          {label}
        </div>

        <div className="mt-1 truncate font-mono-num text-xs font-semibold text-[var(--color-heading)]">
          {value}
        </div>

      </div>

    </div>
  );
}


/* =========================================================
   UNAVAILABLE
========================================================= */

function UnavailableState({
  data,
}) {

  return (
    <div className="mx-auto w-full max-w-[1100px]">

      <PageHeader
        title="Data Reconciliation"
        subtitle="Canonical data quality across ERP, CRM and Support"
      />

      <div className="rounded-md border border-[var(--color-line)] bg-white p-8">

        <div className="flex items-start gap-4">

          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-canvas)] text-[var(--color-body)]/50">
            <Database size={18} />
          </div>

          <div>

            <h2 className="text-sm font-semibold text-[var(--color-heading)]">
              Reconciliation data unavailable
            </h2>

            <p className="mt-1 max-w-xl text-xs leading-6 text-[var(--color-body)]/55">
              {data.note}
            </p>

          </div>

        </div>

      </div>

    </div>
  );
}


/* =========================================================
   HELPERS
========================================================= */

function formatRecords(records) {

  if (!records) return "N/A";

  if (typeof records === "object") {

    return Object.entries(records)
      .map(
        ([key, value]) =>
          `${key}: ${Number(value).toLocaleString("en-IN")}`
      )
      .join(" · ");

  }

  return Number(records).toLocaleString("en-IN");
}


function ClockIcon() {
  return (
    <span className="text-[11px]">
      UTC
    </span>
  );
}