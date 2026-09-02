import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { Loading, ErrorPanel, cap } from "./Dashboard";
import Badge from "../components/Badge";

import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  GitBranch,
  Layers3,
  Search,
  ShieldAlert,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

export default function DriverTree() {
  const { token, region } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();

  const [kpis, setKpis] = useState([]);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");

  const kpiId = searchParams.get("kpi") || "revenue";

  /* ---------------------------------------------
     LOAD KPI LIST
  --------------------------------------------- */

  useEffect(() => {
    if (!token) return;

    api.metaKpis(token)
      .then(setKpis)
      .catch(() => {});
  }, [token]);

  /* ---------------------------------------------
     LOAD DRIVER TREE
  --------------------------------------------- */

  useEffect(() => {
    if (!token) return;

    setData(null);
    setSelected(null);
    setError(null);

    api.kpiStory(token, kpiId, region, "analyst")
      .then(setData)
      .catch((e) => setError(e.message));
  }, [token, region, kpiId]);

  /* ---------------------------------------------
     LOADING / ERROR
  --------------------------------------------- */

  if (error) {
    return (
      <div className="mx-auto max-w-[1500px] px-6 py-8">
        <ErrorPanel message={error} />
      </div>
    );
  }

  if (!data) {
    return <Loading />;
  }

  /* ---------------------------------------------
     SEARCH MATCHES
     
     This is NOT a hook, so it is safe here.
  --------------------------------------------- */

  let searchMatches = null;

  if (search.trim()) {
    searchMatches = new Set();

    function findMatches(node) {
      if (!node) return false;

      const query = search.toLowerCase();

      const label =
        node.node?.label?.toLowerCase() || "";

      const metric =
        node.node?.metricKey?.toLowerCase() || "";

      let childMatch = false;

      node.children?.forEach((child) => {
        if (findMatches(child)) {
          childMatch = true;
        }
      });

      const currentMatch =
        label.includes(query) ||
        metric.includes(query);

      if (currentMatch || childMatch) {
        searchMatches.add(node.node.id);
        return true;
      }

      return false;
    }

    findMatches(data.driverTree);
  }

  return (
    <div className="mx-auto max-w-[1500px] px-5 pb-12 sm:px-6 lg:px-8">

      {/* =========================================
          HEADER
      ========================================= */}

      <header className="border-b border-[var(--color-line)] pb-6 pt-3">

        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">

          <div>

            <div className="mb-3 flex items-center gap-2">

              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                <BrainCircuit size={15} />
              </span>

              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-body)]/45">
                Root Cause Investigation
              </span>

            </div>

            <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-heading)]">
              Driver Intelligence
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-body)]/60">
              Trace performance from the headline KPI to the operational
              drivers influencing the outcome.
            </p>

          </div>

          {/* KPI */}

          <div className="w-full xl:w-auto">

            <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--color-body)]/45">
              Investigating KPI
            </label>

            <div className="relative">

              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-body)]/35"
              />

              <select
                value={kpiId}
                onChange={(e) =>
                  setSearchParams({
                    kpi: e.target.value,
                  })
                }
                className="min-w-[230px] appearance-none rounded-lg border border-[var(--color-line)] bg-white py-2.5 pl-9 pr-10 text-sm font-semibold text-[var(--color-heading)] outline-none transition hover:border-[var(--color-primary)]/30 focus:border-[var(--color-primary)]/50 focus:ring-2 focus:ring-[var(--color-primary)]/10"
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
                size={14}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-body)]/40"
              />

            </div>

          </div>

        </div>

      </header>

      {/* =========================================
          CONTEXT BAR
      ========================================= */}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[var(--color-line)] py-4">

        <ContextItem
          icon={<Activity size={12} />}
          label="Region"
          value={
            data.region === "all"
              ? "All regions"
              : cap(data.region)
          }
        />

        <ContextItem
          icon={<Layers3 size={12} />}
          label="View"
          value="Analyst"
        />

        <ContextItem
          icon={<CheckCircle2 size={12} />}
          label="Status"
          value="Investigation ready"
          success
        />

      </div>

      {/* =========================================
          TOOLBAR
      ========================================= */}

      <div className="flex flex-col gap-3 border-b border-[var(--color-line)] py-4 sm:flex-row sm:items-center sm:justify-between">

        <div>

          <div className="text-xs font-bold text-[var(--color-heading)]">
            Driver model
          </div>

          <div className="mt-0.5 text-[10px] text-[var(--color-body)]/45">
            Select a driver to inspect its performance signals.
          </div>

        </div>

        <div className="relative w-full sm:w-64">

          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-body)]/35"
          />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a driver..."
            className="w-full rounded-lg border border-[var(--color-line)] bg-white py-2 pl-9 pr-3 text-xs outline-none transition placeholder:text-[var(--color-body)]/35 focus:border-[var(--color-primary)]/40 focus:ring-2 focus:ring-[var(--color-primary)]/10"
          />

        </div>

      </div>

      {/* =========================================
          WORKSPACE
      ========================================= */}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_390px]">

        {/* TREE */}

        <section className="min-w-0 border-b border-[var(--color-line)] xl:border-b-0 xl:border-r">

          <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-4">

            <div className="flex items-center gap-3">

              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-canvas)] text-[var(--color-primary)]">
                <GitBranch size={15} />
              </div>

              <div>

                <div className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--color-heading)]">
                  Driver tree
                </div>

                <div className="mt-0.5 text-[9px] text-[var(--color-body)]/40">
                  KPI dependency structure
                </div>

              </div>

            </div>

            <div className="hidden items-center gap-4 sm:flex">

              <Legend
                icon={<ArrowUpRight size={11} />}
                label="Improving"
                positive
              />

              <Legend
                icon={<ArrowDownRight size={11} />}
                label="Declining"
              />

              <Legend
                icon={<AlertTriangle size={11} />}
                label="Material"
                warning
              />

            </div>

          </div>

          <div className="min-h-[650px] overflow-x-auto px-3 py-5 sm:px-5">

            <TreeNode
              node={data.driverTree}
              depth={0}
              isRoot
              onSelect={setSelected}
              selectedId={selected?.node?.id}
              searchMatches={searchMatches}
            />

          </div>

        </section>

        {/* INTELLIGENCE */}

        <aside className="bg-[var(--color-canvas)]">

          {selected ? (
            <NodePanel intel={selected} />
          ) : (
            <EmptyNodePanel />
          )}

        </aside>

      </div>

    </div>
  );
}


/* =========================================================
   CONTEXT ITEM
========================================================= */

function ContextItem({
  icon,
  label,
  value,
  success,
}) {
  return (
    <div className="flex items-center gap-2">

      <span
        className={
          success
            ? "text-[var(--color-green)]"
            : "text-[var(--color-primary)]"
        }
      >
        {icon}
      </span>

      <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--color-body)]/40">
        {label}
      </span>

      <span className="text-[10px] font-semibold text-[var(--color-heading)]">
        {value}
      </span>

    </div>
  );
}


/* =========================================================
   LEGEND
========================================================= */

function Legend({
  icon,
  label,
  positive,
  warning,
}) {
  return (
    <div className="flex items-center gap-1.5 text-[9px] font-medium text-[var(--color-body)]/50">

      <span
        className={
          positive
            ? "text-[var(--color-green)]"
            : warning
              ? "text-[var(--color-clay)]"
              : "text-[var(--color-clay)]"
        }
      >
        {icon}
      </span>

      {label}

    </div>
  );
}


/* =========================================================
   TREE NODE
========================================================= */

function TreeNode({
  node,
  depth,
  isRoot = false,
  onSelect,
  selectedId,
  searchMatches,
}) {

  const [open, setOpen] = useState(depth < 2);

  const hasChildren =
    node.children?.length > 0;

  const isSelected =
    selectedId === node.node.id;

  const isDeclining =
    Number(node.metrics?.pctChange) < 0;

  const isMaterial =
    node.materiality?.isMaterial;

  const isComposite =
    node.node?.composite;

  const searchHit =
    searchMatches?.has(node.node.id);

  /*
   * This hook is ALWAYS called.
   * It is inside the component and never after
   * a conditional return.
   */

  useEffect(() => {
    if (searchHit && hasChildren) {
      setOpen(true);
    }
  }, [searchHit, hasChildren]);

  return (
    <div className="relative">

      {depth > 0 && (
        <div
          className="pointer-events-none absolute bottom-0 top-0 border-l border-dashed border-[var(--color-line)]"
          style={{
            left: `${depth * 26 + 14}px`,
          }}
        />
      )}

      <div
        onClick={() => onSelect(node)}
        className={`
          group relative mb-1 flex min-w-[500px]
          cursor-pointer items-center gap-3
          border-l-2 px-3 py-2.5
          transition-colors

          ${
            isSelected
              ? "border-[var(--color-primary)] bg-[var(--color-primary)]/[0.055]"
              : "border-transparent hover:bg-[var(--color-canvas)]"
          }

          ${
            searchHit && !isSelected
              ? "bg-[var(--color-primary)]/[0.025]"
              : ""
          }
        `}
        style={{
          marginLeft: depth * 26,
        }}
      >

        {/* EXPAND */}

        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((value) => !value);
            }}
            className="flex h-6 w-6 shrink-0 items-center justify-center text-[var(--color-body)]/45 hover:text-[var(--color-heading)]"
          >
            {open ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
          </button>
        ) : (
          <span className="h-6 w-6 shrink-0" />
        )}

        {/* ICON */}

        <div
          className={`
            flex h-8 w-8 shrink-0
            items-center justify-center
            rounded-lg

            ${
              isMaterial
                ? "bg-[var(--color-clay-soft)] text-[var(--color-clay)]"
                : isDeclining
                  ? "bg-[var(--color-clay-soft)] text-[var(--color-clay)]"
                  : "bg-[var(--color-green-soft)] text-[var(--color-green)]"
            }
          `}
        >

          {isComposite ? (
            <GitBranch size={15} />
          ) : isMaterial ? (
            <AlertTriangle size={14} />
          ) : (
            <CircleDot size={13} />
          )}

        </div>

        {/* LABEL */}

        <div className="min-w-0 flex-1">

          <div
            className={`
              truncate text-sm font-semibold

              ${
                isSelected
                  ? "text-[var(--color-primary)]"
                  : "text-[var(--color-heading)]"
              }
            `}
          >
            {node.node.label}
          </div>

          <div className="mt-0.5 flex items-center gap-2 text-[9px] text-[var(--color-body)]/40">

            {isComposite ? (
              <span>
                Composite index
              </span>
            ) : (
              <span className="font-mono-num">
                {node.node.metricKey}
              </span>
            )}

            {isMaterial && (
              <>
                <span>·</span>

                <span className="text-[var(--color-clay)]">
                  Material driver
                </span>
              </>
            )}

          </div>

        </div>

        {/* CHANGE */}

        <div
          className={`
            flex shrink-0 items-center gap-1
            font-mono-num text-[10px] font-bold

            ${
              isDeclining
                ? "text-[var(--color-clay)]"
                : "text-[var(--color-green)]"
            }
          `}
        >

          {isDeclining ? (
            <ArrowDownRight size={11} />
          ) : (
            <ArrowUpRight size={11} />
          )}

          {node.metrics.pctChange > 0
            ? "+"
            : ""}

          {node.metrics.pctChange}

          {isComposite
            ? " pts"
            : "%"}

        </div>

        {/* BADGE */}

        {isMaterial && (
          <div className="hidden md:block">
            <Badge
              variant={node.materiality.level}
            >
              {node.materiality.level}
            </Badge>
          </div>
        )}

      </div>

      {/* CHILDREN */}

      {hasChildren &&
        open &&
        node.children.map((child) => (
          <TreeNode
            key={child.node.id}
            node={child}
            depth={depth + 1}
            onSelect={onSelect}
            selectedId={selectedId}
            searchMatches={searchMatches}
          />
        ))}

    </div>
  );
}


/* =========================================================
   NODE PANEL
========================================================= */

function NodePanel({ intel }) {

  const {
    node,
    metrics,
    materiality,
    contributions,
  } = intel;

  const declining =
    Number(metrics.pctChange) < 0;

  const changeLabel =
    node.composite
      ? "Index-point change"
      : "% change";

  const changeValue =
    node.composite
      ? `${metrics.pctChange} pts`
      : `${metrics.pctChange}%`;

  return (
    <div>

      {/* HEADER */}

      <div className="border-b border-[var(--color-line)] bg-white px-5 py-5">

        <div className="mb-4 flex items-center justify-between">

          <div className="flex items-center gap-2">

            <BrainCircuit
              size={14}
              className="text-[var(--color-primary)]"
            />

            <span className="text-[9px] font-bold uppercase tracking-[0.13em] text-[var(--color-body)]/45">
              Node intelligence
            </span>

          </div>

          <div
            className={`
              flex items-center gap-1.5
              text-[9px] font-bold uppercase

              ${
                declining
                  ? "text-[var(--color-clay)]"
                  : "text-[var(--color-green)]"
              }
            `}
          >

            {declining ? (
              <TrendingDown size={12} />
            ) : (
              <TrendingUp size={12} />
            )}

            {metrics.trend}

          </div>

        </div>

        <h2 className="font-display text-xl font-bold text-[var(--color-heading)]">
          {node.label}
        </h2>

        <div className="mt-2 flex items-center gap-2 text-[9px] text-[var(--color-body)]/40">

          <span className="font-mono-num">
            {node.metricKey}
          </span>

          {node.composite && (
            <>
              <span>·</span>
              <span>Composite index</span>
            </>
          )}

        </div>

      </div>

      {/* PERFORMANCE */}

      <div className="border-b border-[var(--color-line)] px-5 py-5">

        <SectionLabel
          icon={<BarChart3 size={13} />}
          title="Performance"
        />

        <div className="grid grid-cols-2 gap-px overflow-hidden border border-[var(--color-line)] bg-[var(--color-line)]">

          <MetricCell
            label="Current"
            value={metrics.currentValue}
            primary
          />

          <MetricCell
            label="Baseline"
            value={metrics.historicalBaseline}
          />

          <MetricCell
            label={changeLabel}
            value={changeValue}
            trend={
              declining
                ? "negative"
                : "positive"
            }
          />

          <MetricCell
            label="Z-score"
            value={metrics.zScore}
          />

          <MetricCell
            label="Volatility"
            value={`${metrics.volatility}%`}
          />

          <MetricCell
            label="Anomaly score"
            value={metrics.anomalyScore}
            warning={
              Number(metrics.anomalyScore) > 0.7
            }
          />

        </div>

      </div>

      {/* MATERIALITY */}

      <div className="border-b border-[var(--color-line)] px-5 py-5">

        <SectionLabel
          icon={<ShieldAlert size={13} />}
          title="Materiality"
        />

        <div
          className={`
            border-l-2 px-3 py-3

            ${
              materiality.isMaterial
                ? "border-[var(--color-clay)] bg-[var(--color-clay-soft)]/30"
                : "border-[var(--color-green)] bg-[var(--color-green-soft)]/30"
            }
          `}
        >

          <div className="flex items-center gap-2">

            {materiality.isMaterial ? (
              <AlertTriangle
                size={13}
                className="text-[var(--color-clay)]"
              />
            ) : (
              <CheckCircle2
                size={13}
                className="text-[var(--color-green)]"
              />
            )}

            <span
              className={`
                text-xs font-bold

                ${
                  materiality.isMaterial
                    ? "text-[var(--color-clay)]"
                    : "text-[var(--color-green)]"
                }
              `}
            >
              {materiality.isMaterial
                ? "Material driver"
                : "Not material"}
            </span>

          </div>

          <p className="mt-2 text-[10px] leading-5 text-[var(--color-body)]/65">
            {materiality.rationale}
          </p>

        </div>

      </div>

      {/* CONTRIBUTION */}

      {contributions?.length > 0 && (

        <div className="px-5 py-5">

          <SectionLabel
            icon={<Target size={13} />}
            title="Contribution"
          />

          <p className="mb-4 text-[9px] text-[var(--color-body)]/45">
            Relative influence among child drivers
          </p>

          <div className="space-y-4">

            {contributions.map(
              (contribution, index) => (
                <ContributionRow
                  key={contribution.metricKey}
                  contribution={contribution}
                  rank={index + 1}
                />
              )
            )}

          </div>

        </div>

      )}

    </div>
  );
}


/* =========================================================
   SECTION LABEL
========================================================= */

function SectionLabel({
  icon,
  title,
}) {
  return (
    <div className="mb-3 flex items-center gap-2">

      <span className="text-[var(--color-primary)]">
        {icon}
      </span>

      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--color-heading)]">
        {title}
      </span>

    </div>
  );
}


/* =========================================================
   METRIC CELL
========================================================= */

function MetricCell({
  label,
  value,
  primary,
  trend,
  warning,
}) {
  return (
    <div
      className={`
        min-h-[74px] bg-white p-3
        ${primary
          ? "bg-[var(--color-primary)]/[0.035]"
          : ""}
      `}
    >

      <div className="text-[8px] font-bold uppercase tracking-[0.08em] text-[var(--color-body)]/40">
        {label}
      </div>

      <div
        className={`
          mt-2 break-words
          font-mono-num text-sm font-bold

          ${
            warning
              ? "text-[var(--color-clay)]"
              : trend === "negative"
                ? "text-[var(--color-clay)]"
                : trend === "positive"
                  ? "text-[var(--color-green)]"
                  : "text-[var(--color-heading)]"
          }
        `}
      >
        {value}
      </div>

    </div>
  );
}


/* =========================================================
   CONTRIBUTION
========================================================= */

function ContributionRow({
  contribution,
  rank,
}) {

  const percentage = Math.min(
    Math.max(
      Number(
        contribution.contributionPct
      ) || 0,
      0
    ),
    100
  );

  return (
    <div>

      <div className="mb-1.5 flex items-center gap-2">

        <span className="w-5 font-mono-num text-[8px] font-bold text-[var(--color-body)]/30">
          {String(rank).padStart(2, "0")}
        </span>

        <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-[var(--color-body)]">
          {contribution.label}
        </span>

        <span className="font-mono-num text-[10px] font-bold text-[var(--color-heading)]">
          {contribution.contributionPct}%
        </span>

      </div>

      <div className="ml-5 h-1.5 overflow-hidden bg-[var(--color-line)]">

        <div
          className="h-full bg-[var(--color-primary)] transition-all duration-500"
          style={{
            width: `${percentage}%`,
          }}
        />

      </div>

    </div>
  );
}


/* =========================================================
   EMPTY PANEL
========================================================= */

function EmptyNodePanel() {
  return (
    <div className="flex min-h-[650px] flex-col items-center justify-center px-8 text-center">

      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-md bg-white text-[var(--color-primary)] shadow-sm">
        <GitBranch size={24} />
      </div>

      <div className="text-sm font-bold text-[var(--color-heading)]">
        Select a driver
      </div>

      <p className="mt-2 max-w-[250px] text-[10px] leading-5 text-[var(--color-body)]/50">
        Choose a node from the driver model to inspect
        its performance, anomaly signals, materiality,
        and contribution.
      </p>

      <div className="mt-5 flex items-center gap-2 text-[9px] font-semibold text-[var(--color-body)]/40">

        <CircleDot size={10} />

        Click any driver to investigate

      </div>

    </div>
  );
}