import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import Badge from "../components/Badge";

import {
  Activity,
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Database,
  GitBranch,
  Layers3,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  X,
  Zap,
} from "lucide-react";

const METRIC_OPTIONS = [
  "revenue",
  "orders",
  "traffic",
  "conversion",
  "checkoutSuccessRate",
  "activeCustomers",
  "returnRate",
  "aov",
  "discountRate",
  "stockoutRate",
  "avgDeliveryDays",
  "slaBreachRate",
  "complaintRate",
  "sentimentScore",
  "churnRate",
];

export default function DriverTreeAdmin() {
  const { token, user } = useAuth();

  const [kpis, setKpis] = useState([]);
  const [kpiId, setKpiId] = useState("revenue");

  const [tree, setTree] = useState(null);
  const [hypotheses, setHypotheses] = useState(null);

  const [selectedNode, setSelectedNode] = useState(null);
  const [addingUnder, setAddingUnder] = useState(null);

  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);

  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [form, setForm] = useState({
    id: "",
    label: "",
    metricKey: METRIC_OPTIONS[0],
  });

  const canEdit =
    user?.role === "analyst" ||
    user?.role === "executive";

  /* -------------------------------------------------------
     DATA
  ------------------------------------------------------- */

  async function refresh() {
    setTree(null);
    setError(null);
    setRefreshing(true);

    try {
      const [treeData, hypothesisData] = await Promise.all([
        api.driverTree(token, kpiId),
        api.metaHypotheses(token, kpiId),
      ]);

      setTree(treeData);
      setHypotheses(hypothesisData);
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (!token) return;

    api.metaKpis(token)
      .then(setKpis)
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    refresh();
  }, [token, kpiId]);

  /* -------------------------------------------------------
     TREE HELPERS
  ------------------------------------------------------- */

  const nodeCount = useMemo(() => {
    function count(node) {
      if (!node) return 0;

      return 1 +
        (node.children || []).reduce(
          (sum, child) => sum + count(child),
          0
        );
    }

    return count(tree);
  }, [tree]);

  const leafCount = useMemo(() => {
    function count(node) {
      if (!node) return 0;

      if (!node.children?.length) return 1;

      return node.children.reduce(
        (sum, child) => sum + count(child),
        0
      );
    }

    return count(tree);
  }, [tree]);

  function nodeMatches(node) {
    if (!search.trim()) return true;

    const q = search.toLowerCase();

    return (
      node.label?.toLowerCase().includes(q) ||
      node.id?.toLowerCase().includes(q) ||
      node.metricKey?.toLowerCase().includes(q)
    );
  }

  /* -------------------------------------------------------
     ADD
  ------------------------------------------------------- */

  async function submitAdd(e) {
    e.preventDefault();

    setStatus({
      type: "loading",
      message: "Saving driver..."
    });

    try {
      await api.addDriverNode(
        token,
        kpiId,
        addingUnder,
        {
          id: form.id,
          label: form.label,
          metricKey: form.metricKey,
        }
      );

      setStatus({
        type: "success",
        message: `"${form.label}" added to the driver model.`
      });

      closeAddForm();
      await refresh();
    } catch (e) {
      setStatus({
        type: "error",
        message: e.message
      });
    }
  }

  function openAddForm(nodeId) {
    setAddingUnder(nodeId);
    setSelectedNode(null);

    setForm({
      id: "",
      label: "",
      metricKey: METRIC_OPTIONS[0],
    });

    setStatus(null);
  }

  function closeAddForm() {
    setAddingUnder(null);

    setForm({
      id: "",
      label: "",
      metricKey: METRIC_OPTIONS[0],
    });
  }

  /* -------------------------------------------------------
     DELETE
  ------------------------------------------------------- */

  async function deleteNode(nodeId, label) {
    const confirmed = window.confirm(
      `Delete "${label}" and any of its children?`
    );

    if (!confirmed) return;

    setStatus({
      type: "loading",
      message: `Deleting "${label}"...`
    });

    try {
      await api.deleteDriverNode(
        token,
        kpiId,
        nodeId
      );

      setSelectedNode(null);

      setStatus({
        type: "success",
        message: `"${label}" was removed from the driver model.`
      });

      await refresh();
    } catch (e) {
      setStatus({
        type: "error",
        message: e.message
      });
    }
  }

  /* -------------------------------------------------------
     RENAME
  ------------------------------------------------------- */

  async function renameNode(nodeId, currentLabel) {
    const label = window.prompt(
      "Enter the new driver name:",
      currentLabel
    );

    if (
      !label ||
      !label.trim() ||
      label.trim() === currentLabel
    ) {
      return;
    }

    try {
      await api.editDriverNode(
        token,
        kpiId,
        nodeId,
        {
          label: label.trim()
        }
      );

      setStatus({
        type: "success",
        message: `"${currentLabel}" renamed successfully.`
      });

      await refresh();
    } catch (e) {
      setStatus({
        type: "error",
        message: e.message
      });
    }
  }

  /* -------------------------------------------------------
     PERMISSION
  ------------------------------------------------------- */

  if (!canEdit) {
    return (
      <div className="mx-auto max-w-[1100px]">
        <PageTitle
          eyebrow="Governance"
          title="Driver Tree Administration"
          description="Manage the business-driver hierarchy used by the intelligence engine."
        />

        <div className="overflow-hidden rounded-lg border border-[var(--color-line)] bg-white">
          <div className="flex gap-4 border-b border-[var(--color-line)] bg-[var(--color-clay-soft)] p-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--color-clay)]/10 text-[var(--color-clay)]">
              <ShieldCheck size={18} />
            </div>

            <div>
              <div className="text-sm font-semibold text-[var(--color-clay)]">
                Permission required
              </div>

              <p className="mt-1 max-w-xl text-sm leading-relaxed text-[var(--color-clay)]/70">
                Driver-tree configuration is restricted to
                Analyst and Executive roles.
              </p>
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-start gap-3 rounded-md bg-[var(--color-canvas)] p-4">
              <CircleHelp
                size={16}
                className="mt-0.5 shrink-0 text-[var(--color-body)]/50"
              />

              <p className="text-xs leading-relaxed text-[var(--color-body)]/60">
                Your current role can view intelligence outputs
                but cannot modify the underlying driver model.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------
     ERROR
  ------------------------------------------------------- */

  if (error) {
    return (
      <div className="mx-auto max-w-[1200px]">
        <div className="rounded-lg border border-[var(--color-clay)]/20 bg-white p-6">
          <div className="flex items-start gap-3">
            <AlertCircle
              size={18}
              className="text-[var(--color-clay)]"
            />

            <div>
              <div className="font-semibold text-[var(--color-heading)]">
                Unable to load driver model
              </div>

              <p className="mt-1 text-sm text-[var(--color-body)]/60">
                {error}
              </p>

              <button
                onClick={refresh}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white"
              >
                <RefreshCw size={13} />
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------
     MAIN
  ------------------------------------------------------- */

  return (
    <div className="mx-auto max-w-[1500px]">

      {/* HEADER */}

      <PageTitle
        eyebrow="Intelligence Governance"
        title="Driver Tree Administration"
        description="Configure the business-driver model that powers investigation, hypothesis ranking, and decision intelligence."
        right={
          <div className="flex items-center gap-2">

            <div className="relative">
              <select
                value={kpiId}
                onChange={(e) => {
                  setKpiId(e.target.value);
                  setSelectedNode(null);
                  closeAddForm();
                }}
                className="h-10 min-w-[190px] appearance-none rounded-lg border border-[var(--color-line)] bg-white px-3 pr-9 text-sm font-semibold text-[var(--color-heading)] outline-none focus:border-[var(--color-primary)]/40 focus:ring-2 focus:ring-[var(--color-primary)]/10"
              >
                {kpis.map((kpi) => (
                  <option key={kpi.id} value={kpi.id}>
                    {kpi.name}
                  </option>
                ))}
              </select>

              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-body)]/40"
              />
            </div>

            <button
              onClick={refresh}
              disabled={refreshing}
              title="Refresh"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--color-line)] bg-white text-[var(--color-body)]/55 transition hover:border-[var(--color-primary)]/30 hover:text-[var(--color-primary)] disabled:opacity-50"
            >
              <RefreshCw
                size={15}
                className={refreshing ? "animate-spin" : ""}
              />
            </button>

          </div>
        }
      />

      {/* MODEL SUMMARY */}

      <div className="mb-6 grid grid-cols-2 border-y border-[var(--color-line)] bg-white sm:grid-cols-4">

        <SummaryMetric
          label="Model status"
          value="Active"
          icon={<CheckCircle2 size={15} />}
          positive
        />

        <SummaryMetric
          label="Driver nodes"
          value={nodeCount}
          icon={<GitBranch size={15} />}
        />

        <SummaryMetric
          label="Leaf drivers"
          value={leafCount}
          icon={<Layers3 size={15} />}
        />

        <SummaryMetric
          label="Hypotheses"
          value={hypotheses?.length ?? "N/A"}
          icon={<Layers3 size={15} />}
        />

      </div>

      {/* STATUS */}

      {status && (
        <StatusBanner
          status={status}
          onClose={() => setStatus(null)}
        />
      )}

      {/* TOOLBAR */}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

        <div>
          <div className="text-sm font-semibold text-[var(--color-heading)]">
            Business driver hierarchy
          </div>

          <div className="mt-0.5 text-xs text-[var(--color-body)]/50">
            Select a driver to inspect its configuration.
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-body)]/35"
          />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search drivers..."
            className="h-9 w-full rounded-lg border border-[var(--color-line)] bg-white pl-9 pr-3 text-xs outline-none placeholder:text-[var(--color-body)]/35 focus:border-[var(--color-primary)]/40"
          />
        </div>

      </div>

      {/* WORKSPACE */}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">

        {/* TREE */}

        <section className="min-w-0 overflow-hidden rounded-lg border border-[var(--color-line)] bg-white">

          <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-3.5">

            <div className="flex items-center gap-3">

              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                <GitBranch size={15} />
              </div>

              <div>
                <div className="text-xs font-bold text-[var(--color-heading)]">
                  {kpis.find((k) => k.id === kpiId)?.name || kpiId}
                </div>

                <div className="text-[10px] text-[var(--color-body)]/40">
                  Governed driver model
                </div>
              </div>

            </div>

            <div className="hidden items-center gap-3 sm:flex">
              <LegendItem
                icon={<Layers3 size={11} />}
                label="Composite"
              />

              <LegendItem
                icon={<CircleLeaf />}
                label="Leaf"
              />
            </div>

          </div>

          <div className="min-h-[650px] overflow-auto bg-[var(--color-paper)] p-5 sm:p-7">

            {!tree ? (
              <TreeSkeleton />
            ) : (
              <TreeNode
                node={tree}
                depth={0}
                isRoot
                search={search}
                onSelect={setSelectedNode}
                selectedNode={selectedNode}
                onAdd={openAddForm}
                onDelete={deleteNode}
                onRename={renameNode}
              />
            )}

          </div>

        </section>

        {/* INSPECTOR */}

        <aside className="space-y-5">

          {addingUnder ? (
            <AddDriverPanel
              addingUnder={addingUnder}
              form={form}
              setForm={setForm}
              onSubmit={submitAdd}
              onCancel={closeAddForm}
            />
          ) : selectedNode ? (
            <NodeInspector
              node={selectedNode}
              onAdd={() => openAddForm(selectedNode.id)}
              onRename={() =>
                renameNode(
                  selectedNode.id,
                  selectedNode.label
                )
              }
              onDelete={() =>
                deleteNode(
                  selectedNode.id,
                  selectedNode.label
                )
              }
            />
          ) : (
            <EmptyInspector />
          )}

          <HypothesisPanel
            hypotheses={hypotheses}
            kpiId={kpiId}
          />

          <GovernancePanel />

        </aside>

      </div>

    </div>
  );
}

/* =========================================================
   PAGE TITLE
========================================================= */

function PageTitle({
  eyebrow,
  title,
  description,
  right,
}) {
  return (
    <header className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

      <div>
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-primary)]">
          {eyebrow}
        </div>

        <h1 className="font-display text-[28px] font-bold tracking-tight text-[var(--color-heading)]">
          {title}
        </h1>

        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[var(--color-body)]/55">
          {description}
        </p>
      </div>

      {right}

    </header>
  );
}

/* =========================================================
   SUMMARY
========================================================= */

function SummaryMetric({
  label,
  value,
  icon,
  positive,
}) {
  return (
    <div className="flex items-center gap-3 border-r border-[var(--color-line)] px-4 py-4 last:border-r-0">

      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          positive
            ? "bg-[var(--color-green-soft)] text-[var(--color-green)]"
            : "bg-[var(--color-canvas)] text-[var(--color-primary)]"
        }`}
      >
        {icon}
      </div>

      <div className="min-w-0">
        <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--color-body)]/40">
          {label}
        </div>

        <div className="mt-0.5 font-mono-num text-base font-bold text-[var(--color-heading)]">
          {value}
        </div>
      </div>

    </div>
  );
}

/* =========================================================
   STATUS
========================================================= */

function StatusBanner({
  status,
  onClose,
}) {
  const loading = status.type === "loading";
  const error = status.type === "error";

  return (
    <div
      className={`mb-5 flex items-center gap-3 rounded-md border px-4 py-3 ${
        error
          ? "border-[var(--color-clay)]/20 bg-[var(--color-clay-soft)]"
          : loading
          ? "border-[var(--color-primary)]/20 bg-[var(--color-primary-soft)]"
          : "border-[var(--color-green)]/20 bg-[var(--color-green-soft)]"
      }`}
    >

      {loading ? (
        <RefreshCw
          size={14}
          className="animate-spin text-[var(--color-primary)]"
        />
      ) : error ? (
        <AlertCircle
          size={14}
          className="text-[var(--color-clay)]"
        />
      ) : (
        <CheckCircle2
          size={14}
          className="text-[var(--color-green)]"
        />
      )}

      <span className="flex-1 text-xs font-medium text-[var(--color-heading)]">
        {status.message}
      </span>

      {!loading && (
        <button onClick={onClose}>
          <X
            size={13}
            className="text-[var(--color-body)]/40 hover:text-[var(--color-body)]"
          />
        </button>
      )}

    </div>
  );
}

/* =========================================================
   TREE NODE
========================================================= */

function TreeNode({
  node,
  depth,
  isRoot,
  search,
  selectedNode,
  onSelect,
  onAdd,
  onDelete,
  onRename,
}) {
  const [open, setOpen] = useState(true);

  const hasChildren = node.children?.length > 0;
  const composite = Boolean(node.composite);

  const selected =
    selectedNode?.id === node.id;

  const matches = nodeMatchesRecursive(node, search);

  if (search && !matches) return null;

  return (
    <div className="relative">

      {depth > 0 && (
        <div
          className="pointer-events-none absolute bottom-0 top-0 border-l border-dashed border-[var(--color-line)]"
          style={{
            left: `${depth * 28 + 14}px`,
          }}
        />
      )}

      <div
        className={`group relative mb-1 flex items-center gap-2 rounded-md border px-2.5 py-2 transition ${
          selected
            ? "border-[var(--color-primary)]/30 bg-[var(--color-primary)]/[0.04]"
            : "border-transparent hover:border-[var(--color-line)] hover:bg-white"
        }`}
        style={{
          marginLeft: depth * 28,
        }}
        onClick={() => onSelect(node)}
      >

        {/* expand */}

        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--color-body)]/40 hover:bg-[var(--color-canvas)] hover:text-[var(--color-heading)]"
          >
            {open ? (
              <ChevronDown size={13} />
            ) : (
              <ChevronRight size={13} />
            )}
          </button>
        ) : (
          <div className="w-7 shrink-0" />
        )}

        {/* icon */}

        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            composite
              ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
              : "bg-[var(--color-green-soft)] text-[var(--color-green)]"
          }`}
        >
          {composite ? (
            <Layers3 size={14} />
          ) : (
            <CircleLeaf />
          )}
        </div>

        {/* content */}

        <div className="min-w-0 flex-1">

          <div className="flex items-center gap-2">

            <span className="truncate text-sm font-semibold text-[var(--color-heading)]">
              {node.label}
            </span>

            {isRoot && (
              <span className="rounded bg-[var(--color-primary)]/10 px-1.5 py-0.5 text-[8px] font-bold uppercase text-[var(--color-primary)]">
                root
              </span>
            )}

          </div>

          <div className="mt-0.5 flex items-center gap-2">

            <span className="font-mono-num text-[9px] text-[var(--color-body)]/35">
              {node.metricKey}
            </span>

            {hasChildren && (
              <span className="text-[9px] text-[var(--color-body)]/30">
                {node.children.length} child
                {node.children.length === 1 ? "" : "ren"}
              </span>
            )}

          </div>

        </div>

        {/* actions */}

        <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">

          <TreeAction
            title="Add child"
            onClick={(e) => {
              e.stopPropagation();
              onAdd(node.id);
            }}
          >
            <Plus size={13} />
          </TreeAction>

          {!isRoot && (
            <>
              <TreeAction
                title="Rename"
                onClick={(e) => {
                  e.stopPropagation();
                  onRename(node.id, node.label);
                }}
              >
                <Pencil size={12} />
              </TreeAction>

              <TreeAction
                danger
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(node.id, node.label);
                }}
              >
                <Trash2 size={12} />
              </TreeAction>
            </>
          )}

        </div>

      </div>

      {hasChildren && open && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedNode={selectedNode}
              onSelect={onSelect}
              onAdd={onAdd}
              onDelete={onDelete}
              onRename={onRename}
              search={search}
            />
          ))}
        </div>
      )}

    </div>
  );
}

function nodeMatchesRecursive(node, search) {
  if (!search.trim()) return true;

  const q = search.toLowerCase();

  if (
    node.label?.toLowerCase().includes(q) ||
    node.id?.toLowerCase().includes(q) ||
    node.metricKey?.toLowerCase().includes(q)
  ) {
    return true;
  }

  return node.children?.some((child) =>
    nodeMatchesRecursive(child, search)
  );
}

/* =========================================================
   INSPECTOR
========================================================= */

function NodeInspector({
  node,
  onAdd,
  onRename,
  onDelete,
}) {
  const composite = Boolean(node.composite);

  return (
    <section className="overflow-hidden rounded-lg border border-[var(--color-line)] bg-white">

      <div className="border-b border-[var(--color-line)] px-5 py-4">

        <div className="mb-3 flex items-center gap-3">

          <div
            className={`flex h-10 w-10 items-center justify-center rounded-md ${
              composite
                ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                : "bg-[var(--color-green-soft)] text-[var(--color-green)]"
            }`}
          >
            {composite ? (
              <Layers3 size={17} />
            ) : (
              <CircleLeaf />
            )}
          </div>

          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-[var(--color-heading)]">
              {node.label}
            </div>

            <div className="mt-0.5 font-mono-num text-[9px] text-[var(--color-body)]/40">
              {node.id}
            </div>
          </div>

        </div>

        <div className="flex gap-2">

          <Badge variant={composite ? "primary" : "positive"}>
            {composite ? "Composite driver" : "Leaf driver"}
          </Badge>

          {node.children?.length > 0 && (
            <Badge variant="neutral">
              {node.children.length} children
            </Badge>
          )}

        </div>

      </div>

      <div className="space-y-4 p-5">

        <InspectorRow
          icon={<Database size={13} />}
          label="Backing metric"
          value={node.metricKey}
        />

        <InspectorRow
          icon={<GitBranch size={13} />}
          label="Node ID"
          value={node.id}
          mono
        />

        <InspectorRow
          icon={<Activity size={13} />}
          label="Model role"
          value={
            composite
              ? "Aggregates child drivers"
              : "Feeds hypothesis generation"
          }
        />

      </div>

      <div className="flex gap-2 border-t border-[var(--color-line)] bg-[var(--color-paper)] p-4">

        <button
          onClick={onAdd}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
        >
          <Plus size={13} />
          Add child
        </button>

        <button
          onClick={onRename}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-line)] bg-white text-[var(--color-body)]/50 hover:text-[var(--color-heading)]"
          title="Rename"
        >
          <Pencil size={13} />
        </button>

        <button
          onClick={onDelete}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-clay)]/20 bg-white text-[var(--color-clay)] hover:bg-[var(--color-clay-soft)]"
          title="Delete"
        >
          <Trash2 size={13} />
        </button>

      </div>

    </section>
  );
}

function InspectorRow({
  icon,
  label,
  value,
  mono,
}) {
  return (
    <div className="flex items-start gap-3">

      <div className="mt-0.5 text-[var(--color-body)]/35">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--color-body)]/40">
          {label}
        </div>

        <div
          className={`mt-1 break-words text-xs font-semibold text-[var(--color-heading)] ${
            mono ? "font-mono-num" : ""
          }`}
        >
          {value}
        </div>
      </div>

    </div>
  );
}

/* =========================================================
   ADD DRIVER
========================================================= */

function AddDriverPanel({
  addingUnder,
  form,
  setForm,
  onSubmit,
  onCancel,
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-[var(--color-primary)]/20 bg-white">

      <div className="bg-[var(--color-primary)] px-5 py-4 text-white">

        <div className="flex items-center justify-between">

          <div className="flex items-center gap-3">

            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
              <Plus size={15} />
            </div>

            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/50">
                New driver
              </div>

              <div className="mt-0.5 text-sm font-bold">
                Add under {addingUnder}
              </div>
            </div>

          </div>

          <button
            type="button"
            onClick={onCancel}
            className="text-white/50 hover:text-white"
          >
            <X size={15} />
          </button>

        </div>

      </div>

      <form onSubmit={onSubmit} className="space-y-4 p-5">

        <FormField
          label="Node ID"
          hint="Unique identifier"
        >
          <input
            required
            value={form.id}
            onChange={(e) =>
              setForm({
                ...form,
                id: e.target.value
                  .replace(/\s+/g, "_")
                  .toLowerCase(),
              })
            }
            placeholder="warehouse_capacity"
            className={inputClass}
          />
        </FormField>

        <FormField
          label="Display name"
          hint="Shown in the UI"
        >
          <input
            required
            value={form.label}
            onChange={(e) =>
              setForm({
                ...form,
                label: e.target.value,
              })
            }
            placeholder="Warehouse Capacity"
            className={inputClass}
          />
        </FormField>

        <FormField
          label="Backing metric"
          hint="Source field"
        >
          <div className="relative">

            <select
              value={form.metricKey}
              onChange={(e) =>
                setForm({
                  ...form,
                  metricKey: e.target.value,
                })
              }
              className={`${inputClass} appearance-none pr-8`}
            >
              {METRIC_OPTIONS.map((metric) => (
                <option key={metric} value={metric}>
                  {metric}
                </option>
              ))}
            </select>

            <ChevronDown
              size={13}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-body)]/40"
            />

          </div>
        </FormField>

        <div className="flex gap-2 rounded-md bg-[var(--color-paper)] p-3">

          <Database
            size={13}
            className="mt-0.5 shrink-0 text-[var(--color-primary)]"
          />

          <p className="text-[9px] leading-relaxed text-[var(--color-body)]/55">
            The driver is linked directly to the selected
            metric. The intelligence engine will use this
            field when generating downstream hypotheses.
          </p>

        </div>

        <div className="flex gap-2 pt-1">

          <button
            type="submit"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-xs font-bold text-white hover:opacity-90"
          >
            <Save size={13} />
            Save driver
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[var(--color-line)] px-4 py-2.5 text-xs font-semibold text-[var(--color-body)] hover:bg-[var(--color-canvas)]"
          >
            Cancel
          </button>

        </div>

      </form>

    </section>
  );
}

/* =========================================================
   HYPOTHESIS PANEL
========================================================= */

function HypothesisPanel({
  hypotheses,
  kpiId,
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-[var(--color-line)] bg-white">

      <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-4">

        <div className="flex items-center gap-3">

          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            <Layers3 size={14} />
          </div>

          <div>
            <div className="text-xs font-bold text-[var(--color-heading)]">
              Hypothesis coverage
            </div>

            <div className="mt-0.5 text-[9px] text-[var(--color-body)]/40">
              Leaf drivers currently available
            </div>
          </div>

        </div>

        <span className="rounded-full bg-[var(--color-canvas)] px-2.5 py-1 font-mono-num text-[9px] font-bold text-[var(--color-primary)]">
          {hypotheses?.length ?? "N/A"}
        </span>

      </div>

      <div className="p-4">

        <div className="mb-3 flex gap-2 rounded-lg bg-[var(--color-paper)] p-3">

          <Activity
            size={12}
            className="mt-0.5 shrink-0 text-[var(--color-primary)]"
          />

          <p className="text-[9px] leading-relaxed text-[var(--color-body)]/50">
            Leaf drivers from the active model become the
            candidate explanations used during investigation.
          </p>

        </div>

        <div className="mb-3 font-mono-num text-[8px] text-[var(--color-body)]/30">
          KPI / {kpiId}
        </div>

        {hypotheses?.length ? (
          <div className="space-y-1.5">
            {hypotheses.map((h, index) => (
              <div
                key={h.id}
                className="flex items-center gap-2 rounded-lg border border-[var(--color-line)] px-3 py-2"
              >
                <span className="font-mono-num text-[8px] font-bold text-[var(--color-body)]/25">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-[10px] font-semibold text-[var(--color-heading)]">
                    {h.label}
                  </div>

                  <div className="truncate font-mono-num text-[8px] text-[var(--color-body)]/30">
                    {h.id}
                  </div>
                </div>

                <Check
                  size={11}
                  className="shrink-0 text-[var(--color-green)]"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="py-5 text-center">
            <div className="text-xs font-semibold text-[var(--color-heading)]">
              No hypotheses
            </div>

            <p className="mt-1 text-[9px] text-[var(--color-body)]/45">
              Add leaf drivers to populate investigation hypotheses.
            </p>
          </div>
        )}

      </div>

    </section>
  );
}

/* =========================================================
   GOVERNANCE
========================================================= */

function GovernancePanel() {
  return (
    <section className="rounded-lg bg-[var(--color-ink)] p-5">

      <div className="flex items-center gap-3">

        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white">
          <ShieldCheck size={14} />
        </div>

        <div>
          <div className="text-xs font-bold text-white">
            Governed configuration
          </div>

          <div className="text-[9px] text-white/35">
            Intelligence model controls
          </div>
        </div>

      </div>

      <div className="mt-4 space-y-2 border-t border-white/10 pt-4">

        <GovernanceRow
          icon={<Database size={11} />}
          text="API-backed configuration"
        />

        <GovernanceRow
          icon={<ShieldCheck size={11} />}
          text="Role-based editing"
        />

        <GovernanceRow
          icon={<Zap size={11} />}
          text="Changes propagate automatically"
        />

      </div>

    </section>
  );
}

function GovernanceRow({
  icon,
  text,
}) {
  return (
    <div className="flex items-center gap-2 text-[9px] text-white/50">
      <span className="text-[var(--color-green)]">
        {icon}
      </span>
      {text}
    </div>
  );
}

/* =========================================================
   EMPTY INSPECTOR
========================================================= */

function EmptyInspector() {
  return (
    <section className="rounded-lg border border-dashed border-[var(--color-line)] bg-white p-8 text-center">

      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-canvas)] text-[var(--color-body)]/35">
        <GitBranch size={17} />
      </div>

      <div className="mt-3 text-xs font-semibold text-[var(--color-heading)]">
        Select a driver
      </div>

      <p className="mx-auto mt-1 max-w-[220px] text-[9px] leading-relaxed text-[var(--color-body)]/45">
        Select a node in the hierarchy to inspect its
        metric, role, and available actions.
      </p>

    </section>
  );
}

/* =========================================================
   FORM
========================================================= */

function FormField({
  label,
  hint,
  children,
}) {
  return (
    <label className="block">

      <div className="mb-1.5 flex items-center justify-between">

        <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--color-body)]/45">
          {label}
        </span>

        {hint && (
          <span className="text-[8px] text-[var(--color-body)]/30">
            {hint}
          </span>
        )}

      </div>

      {children}

    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2.5 text-xs text-[var(--color-heading)] outline-none transition placeholder:text-[var(--color-body)]/25 focus:border-[var(--color-primary)]/40 focus:bg-white focus:ring-2 focus:ring-[var(--color-primary)]/10";

/* =========================================================
   SMALL UI
========================================================= */

function LegendItem({
  icon,
  label,
}) {
  return (
    <span className="flex items-center gap-1.5 text-[9px] font-medium text-[var(--color-body)]/45">
      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--color-canvas)] text-[var(--color-primary)]">
        {icon}
      </span>
      {label}
    </span>
  );
}

function TreeAction({
  children,
  onClick,
  title,
  danger,
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
        danger
          ? "text-[var(--color-clay)] hover:bg-[var(--color-clay-soft)]"
          : "text-[var(--color-body)]/45 hover:bg-[var(--color-canvas)] hover:text-[var(--color-heading)]"
      }`}
    >
      {children}
    </button>
  );
}

function CircleLeaf() {
  return (
    <span className="relative flex h-3 w-3 items-center justify-center">
      <span className="h-2.5 w-2.5 rounded-full border-2 border-current" />
      <span className="absolute h-1 w-1 rounded-full bg-current" />
    </span>
  );
}

function TreeSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">

      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3"
          style={{
            marginLeft: `${i % 3 * 28}px`,
          }}
        >
          <div className="h-7 w-7 rounded-md bg-[var(--color-line)]/40" />
          <div className="h-8 w-8 rounded-lg bg-[var(--color-line)]/40" />
          <div className="h-3 w-48 rounded bg-[var(--color-line)]/40" />
        </div>
      ))}

    </div>
  );
}