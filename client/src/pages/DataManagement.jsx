import { useEffect, useState } from "react";
import { Database, PenLine, AlertTriangle, CheckCircle2, Trash2, Clock3, FileSpreadsheet } from "lucide-react";
import ExcelJS from "exceljs";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { PageHeader, Loading, ErrorPanel } from "./Dashboard";
import Badge from "../components/Badge";

// Mirrors server/data/validation/validateRecord.js's real schemas
// exactly, every field here maps 1:1 to a column the reconciliation
// layer actually reads (see data/csv/*.csv headers). Nothing here is
// invented; this is the same canonical schema the demo CSV files use.
const TABLE_SCHEMAS = {
  erp_orders: {
    group: "erp",
    label: "ERP: Orders",
    fields: [
      { key: "order_id", label: "Order ID", type: "text", required: true },
      { key: "product_id", label: "Product ID", type: "text", required: true },
      { key: "region_code", label: "Region", type: "region-code", required: true },
      { key: "date", label: "Date", type: "date", required: true },
      { key: "revenue", label: "Revenue", type: "number", required: true },
      { key: "discount", label: "Discount", type: "number" },
      { key: "refund", label: "Refund", type: "number" },
    ],
  },
  erp_ops: {
    group: "erp",
    label: "ERP: Operations",
    fields: [
      { key: "region_code", label: "Region", type: "region-code", required: true },
      { key: "date", label: "Date", type: "date", required: true },
      { key: "checkout_success_rate", label: "Checkout success rate (0–1)", type: "number" },
      { key: "stockout_rate", label: "Stockout rate (0–1)", type: "number" },
      { key: "delivery_days", label: "Delivery days", type: "number" },
      { key: "sla_breach_rate", label: "SLA breach rate (0–1)", type: "number" },
      { key: "inventory_on_hand_pct", label: "Inventory on hand (0–1)", type: "number" },
      { key: "complaint_rate", label: "Complaint rate (0–1)", type: "number" },
      { key: "sentiment_index", label: "Sentiment index (0–1)", type: "number" },
    ],
  },
  crm_customers: {
    group: "crm",
    label: "CRM: Customers",
    fields: [
      { key: "customer_id", label: "Customer ID", type: "text", required: true },
      { key: "customer_segment", label: "Segment", type: "text" },
      { key: "region_name", label: "Region", type: "region-name", required: true },
      { key: "signup_date", label: "Signup date", type: "date" },
    ],
  },
  crm_daily: {
    group: "crm",
    label: "CRM: Daily",
    fields: [
      { key: "region_name", label: "Region", type: "region-name", required: true },
      { key: "date", label: "Date", type: "date", required: true },
      { key: "traffic", label: "Traffic", type: "number", required: true },
      { key: "conversion_rate", label: "Conversion rate (0–1)", type: "number" },
      { key: "churn_rate", label: "Churn rate (0–1)", type: "number" },
      { key: "renewal_rate", label: "Renewal rate (0–1)", type: "number" },
      { key: "active_customers", label: "Active customers", type: "number" },
    ],
  },
  support_tickets: {
    group: "support",
    label: "Support: Tickets",
    fields: [
      { key: "ticket_id", label: "Ticket ID", type: "text", required: true },
      { key: "customer_id", label: "Customer ID", type: "text", required: true },
      { key: "region_label", label: "Region", type: "region-label", required: true },
      { key: "timestamp", label: "Timestamp (ISO)", type: "text", required: true, placeholder: "2026-08-30T14:00:00Z" },
      { key: "category", label: "Category", type: "text", required: true },
      { key: "sentiment", label: "Sentiment (-1 to 1)", type: "number" },
      { key: "issue_text", label: "Issue description", type: "text" },
    ],
  },
};

const REGION_OPTIONS = {
  "region-code": [["N", "North"], ["S", "South"], ["W", "West"]],
  "region-name": [["North", "North"], ["South", "South"], ["West", "West"]],
  "region-label": [["north-region", "North"], ["south-region", "South"], ["west-region", "West"]],
};

function emptyFormFor(table) {
  const out = {};
  for (const f of TABLE_SCHEMAS[table].fields) out[f.key] = "";
  return out;
}

export default function DataManagement() {
  const { token, dataMode, setDataMode } = useAuth();
  const [sources, setSources] = useState(null);
  const [health, setHealth] = useState(null);
  const [batches, setBatches] = useState([]);
  const [error, setError] = useState(null);

  const [table, setTable] = useState("erp_orders");
  const [inputMethod, setInputMethod] = useState("manual");
  const [form, setForm] = useState(() => emptyFormFor("erp_orders"));
  const [ingestResult, setIngestResult] = useState(null);
  const [ingestBusy, setIngestBusy] = useState(false);

  const [csvText, setCsvText] = useState("");
  const [csvPreview, setCsvPreview] = useState(null);
  const [csvBusy, setCsvBusy] = useState(false);

  function refresh() {
    api.dataSources(token).then(setSources).catch((e) => setError(e.message));
    api.dataHealth(token).then(setHealth).catch(() => {});
    api.dataBatches(token).then((d) => setBatches(d.batches)).catch(() => {});
  }

  useEffect(refresh, [token]);

  useEffect(() => {
    setForm(emptyFormFor(table));
    setIngestResult(null);
  }, [table]);

  async function submitManual(e) {
    e.preventDefault();
    setIngestBusy(true);
    setIngestResult(null);
    try {
      const record = { ...form };
      for (const f of TABLE_SCHEMAS[table].fields) {
        if (f.type === "number" && record[f.key] !== "") record[f.key] = Number(record[f.key]);
      }
      const result = await api.ingestData(token, table, [record], "manual");
      setIngestResult(result);
      if (result.success) {
        setForm(emptyFormFor(table));
        refresh();
      }
    } catch (err) {
      setIngestResult({ success: false, rejectedDetails: [{ errors: [err.message] }] });
    } finally {
      setIngestBusy(false);
    }
  }

  async function runCsvPreview() {
    setCsvBusy(true);
    setCsvPreview(null);
    try {
      const preview = await api.csvPreview(token, table, csvText);
      setCsvPreview(preview);
    } catch (err) {
      setCsvPreview({ error: err.message });
    } finally {
      setCsvBusy(false);
    }
  }

  async function confirmCsvIngest() {
    if (!csvPreview?.committable?.length) return;
    setCsvBusy(true);
    try {
      const result = await api.ingestData(token, table, csvPreview.committable, "csv");
      setIngestResult(result);
      setCsvText("");
      setCsvPreview(null);
      refresh();
    } catch (err) {
      setIngestResult({ success: false, rejectedDetails: [{ errors: [err.message] }] });
    } finally {
      setCsvBusy(false);
    }
  }

  // Converts a cell's parsed value back to plain text for the CSV
  // pipeline. Dates become YYYY-MM-DD to match this schema's date
  // fields exactly; rich-text/formula cells are unwrapped to their
  // displayed value.
  function cellToString(v) {
    if (v == null) return "";
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === "object" && Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("");
    if (typeof v === "object" && v.result !== undefined) return String(v.result);
    return String(v);
  }

  function csvEscape(s) {
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  // Reads the FIRST worksheet of an uploaded .xlsx/.xls file and
  // converts it to plain CSV text, then it flows through the exact
  // same preview/validate/ingest pipeline already used for CSV
  // uploads. No backend changes needed for Excel support.
  //
  // IMPORTANT: exceljs's .xlsx.load() only understands the modern
  // OOXML format (.xlsx, a zip file). The legacy Excel 97-2003
  // binary format (.xls, an OLE2/"Compound File" container) is a
  // completely different byte format and will fail here. We detect
  // that upfront by magic bytes and give a specific, actionable
  // error instead of exceljs's confusing "is this a zip file?"
  // message, this is a real, common failure mode worth catching
  // explicitly rather than letting it surface as "nothing happens."
  async function xlsxToCsvText(file) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer.slice(0, 8));
    const isOle2LegacyXls = bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b; // "PK"
    if (isOle2LegacyXls) {
      throw new Error('This is an older Excel format (.xls, Excel 97-2003). Please re-save it as .xlsx first, in Excel: File > Save As > "Excel Workbook (.xlsx)", then upload again.');
    }
    if (!isZip) {
      throw new Error("This file doesn't look like a valid .xlsx file (unrecognized format). If it's really an Excel file, try re-saving it as .xlsx and uploading again.");
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new Error("No worksheet found in this Excel file.");
    const lines = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values = row.values.slice(1); // exceljs rows are 1-indexed; index 0 is always undefined
      lines.push(values.map((v) => csvEscape(cellToString(v))).join(","));
    });
    if (lines.length === 0) throw new Error("The first worksheet has no data rows.");
    return lines.join("\n");
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);

    if (isExcel) {
      setCsvBusy(true);
      setCsvPreview(null);
      setCsvText("");
      xlsxToCsvText(file)
        .then((text) => setCsvText(text))
        .catch((err) => setCsvPreview({ error: `Could not read "${file.name}": ${err.message}` }))
        .finally(() => setCsvBusy(false));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result || ""));
    reader.onerror = () => setCsvPreview({ error: `Could not read "${file.name}". The browser reported a file read error.` });
    reader.readAsText(file);
  }

  if (error) return <ErrorPanel message={error} />;
  if (!sources) return <Loading />;

  const schema = TABLE_SCHEMAS[table];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Data Management"
        subtitle="Bring your own business data into the intelligence engine. Validated, stored, and used for real investigations, not a separate demo."
        right={
          <div className="flex overflow-hidden rounded-md border border-[var(--color-line)]">
            {[
              { id: "demo", label: "Demo data" },
              { id: "userdata", label: "My data" },
              { id: "combined", label: "Demo + my data" },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setDataMode(m.id)}
                className={`px-3 py-1.5 text-xs font-semibold ${dataMode === m.id ? "bg-[var(--color-ink)] text-white" : "bg-white text-[var(--color-body)] hover:bg-[var(--color-canvas)]"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        }
      />

      {dataMode !== "demo" && (
        <div className="mb-6 flex items-start gap-2 border border-[var(--color-primary)]/25 bg-white p-3 text-xs text-[var(--color-body)] shadow-sm">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
          Every page in this app is now reading from <strong className="text-[var(--color-heading)]">{dataMode === "userdata" ? "your ingested data only" : "your data blended with the demo dataset"}</strong>. Switch back to "Demo data" any time to return to the original prototype exactly as it was.
        </div>
      )}

      {/* Source health */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {["erp", "crm", "support"].map((g) => (
          <div key={g} className="border border-[var(--color-line)] bg-white p-4 shadow-sm">
            <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-[var(--color-body)]/45">
              <Database size={13} />
              {g.toUpperCase()}
            </div>
            <div className="text-2xl font-bold text-[var(--color-heading)]">{sources[g].recordCount}</div>
            <div className="text-xs text-[var(--color-body)]/55">records ingested</div>
          </div>
        ))}
      </div>

      {/* Add data */}
      <div className="mb-8 border border-[var(--color-line)] bg-white p-6 shadow-sm">
        <div className="mb-4 text-sm font-semibold text-[var(--color-heading)]">Add business data</div>

        <div className="mb-5 flex flex-wrap gap-3">
          <select value={table} onChange={(e) => setTable(e.target.value)} className="rounded-md border border-[var(--color-line)] px-3 py-1.5 text-sm">
            {Object.entries(TABLE_SCHEMAS).map(([key, s]) => (
              <option key={key} value={key}>{s.label}</option>
            ))}
          </select>

          <div className="flex overflow-hidden rounded-md border border-[var(--color-line)]">
            <button onClick={() => setInputMethod("manual")} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${inputMethod === "manual" ? "bg-[var(--color-ink)] text-white" : "text-[var(--color-body)]"}`}>
              <PenLine size={13} /> Manual entry
            </button>
            <button onClick={() => setInputMethod("csv")} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${inputMethod === "csv" ? "bg-[var(--color-ink)] text-white" : "text-[var(--color-body)]"}`}>
              <FileSpreadsheet size={13} /> CSV / Excel upload
            </button>
          </div>
        </div>

        {inputMethod === "manual" ? (
          <form onSubmit={submitManual} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {schema.fields.map((f) => (
              <label key={f.key} className="text-xs">
                <span className="mb-1 block font-medium text-[var(--color-body)]">
                  {f.label}{f.required && <span className="text-[var(--color-clay)]"> *</span>}
                </span>
                {f.type.startsWith("region-") ? (
                  <select
                    required={f.required}
                    value={form[f.key]}
                    onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                    className="w-full rounded-md border border-[var(--color-line)] px-2.5 py-1.5"
                  >
                    <option value="">Select region…</option>
                    {REGION_OPTIONS[f.type].map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                  </select>
                ) : (
                  <input
                    type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                    step={f.type === "number" ? "any" : undefined}
                    required={f.required}
                    placeholder={f.placeholder}
                    value={form[f.key]}
                    onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                    className="w-full rounded-md border border-[var(--color-line)] px-2.5 py-1.5"
                  />
                )}
              </label>
            ))}
            <div className="sm:col-span-2">
              <button type="submit" disabled={ingestBusy} className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
                {ingestBusy ? "Adding…" : "Add record"}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="mb-1 block text-xs" />
            <p className="mb-3 text-[10px] text-[var(--color-body)]/45">Accepts .csv, .xlsx, or .xls. For Excel files, the first worksheet is used.</p>
            <textarea
              value={csvText}
              onChange={(e) => { setCsvText(e.target.value); setCsvPreview(null); }}
              placeholder={`Paste CSV here, or upload a file above. Expected columns: ${schema.fields.map((f) => f.key).join(", ")}`}
              rows={5}
              className="w-full rounded-md border border-[var(--color-line)] p-2.5 font-mono-num text-xs"
            />
            <button onClick={runCsvPreview} disabled={!csvText || csvBusy} className="mt-3 rounded-md border border-[var(--color-line)] px-4 py-2 text-xs font-semibold text-[var(--color-heading)] disabled:opacity-50">
              {csvBusy ? "Reading file…" : "Preview & validate"}
            </button>

            {csvPreview?.error && <div className="mt-3 text-xs text-[var(--color-clay)]">{csvPreview.error}</div>}

            {csvPreview && !csvPreview.error && (
              <div className="mt-4 border border-[var(--color-line)] p-4">
                <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                  <span>{csvPreview.totalRows} rows</span>
                  <span className="text-[var(--color-green)]">{csvPreview.validCount} valid</span>
                  <span className="text-[var(--color-amber)]">{csvPreview.duplicateCount} duplicates</span>
                  <span className="text-[var(--color-clay)]">{csvPreview.invalidCount} invalid</span>
                </div>
                {csvPreview.rejectedDetails?.length > 0 && (
                  <ul className="mb-3 max-h-32 space-y-1 overflow-y-auto text-xs text-[var(--color-clay)]">
                    {csvPreview.rejectedDetails.map((r, i) => <li key={i}>Row {i + 1}: {r.errors.join("; ")}</li>)}
                  </ul>
                )}
                <div className="flex gap-2">
                  <button onClick={confirmCsvIngest} disabled={!csvPreview.validCount || csvBusy} className="rounded-md bg-[var(--color-primary)] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                    Confirm ingestion ({csvPreview.validCount})
                  </button>
                  <button onClick={() => setCsvPreview(null)} className="rounded-md border border-[var(--color-line)] px-4 py-1.5 text-xs font-semibold">Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {ingestResult && (
          <div className={`mt-4 flex items-start gap-2 border p-3 text-xs ${ingestResult.success ? "border-[var(--color-green)]/25 text-[var(--color-heading)]" : "border-[var(--color-clay)]/25 text-[var(--color-clay)]"}`}>
            {ingestResult.success ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[var(--color-green)]" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
            <div>
              {ingestResult.success ? (
                <>Inserted {ingestResult.inserted}, {ingestResult.duplicates} duplicate(s) skipped, {ingestResult.rejected} rejected.</>
              ) : (
                <ul className="space-y-0.5">
                  {ingestResult.rejectedDetails?.map((r, i) => <li key={i}>{r.errors?.join("; ")}</li>)}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Ingestion history */}
      <div className="border border-[var(--color-line)] bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--color-heading)]">
          <Clock3 size={15} />
          Recent ingestion
        </div>
        {batches.length === 0 ? (
          <p className="text-xs text-[var(--color-body)]/50">No data ingested yet.</p>
        ) : (
          <div className="space-y-2">
            {batches.map((b) => (
              <div key={b.id} className="flex items-center justify-between border-b border-[var(--color-line)] py-2 text-xs last:border-0">
                <div>
                  <span className="font-semibold text-[var(--color-heading)]">{TABLE_SCHEMAS[b.table]?.label || b.table}</span>
                  <span className="ml-2 text-[var(--color-body)]/50">{b.inserted} inserted · {b.duplicates} duplicate · {b.rejected} rejected</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-body)]/40">{new Date(b.createdAt).toLocaleString()}</span>
                  <Badge variant={b.rejected > 0 ? "MEDIUM" : "positive"}>{b.rejected > 0 ? "Partial" : "Completed"}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
