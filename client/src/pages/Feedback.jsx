import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { PageHeader, Loading, ErrorPanel } from "./Dashboard";
import { StatCard } from "../components/UI";

export default function Feedback() {
  const { token } = useAuth();
  // P3: KPIs, regions, and hypotheses all come from the backend's
  // dynamic metadata endpoints now, this form no longer hardcodes
  // any of them, so it can never drift from the actual driver trees.
  const [kpis, setKpis] = useState([]);
  const [regions, setRegions] = useState([]);
  const [hypotheses, setHypotheses] = useState([]);
  const [form, setForm] = useState({ kpi: "revenue", region: "", hypothesisId: "", verdict: "correct", actualOutcome: "" });
  const [history, setHistory] = useState(null);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    api.metaKpis(token).then(setKpis);
    api.metaRegions(token).then((rs) => {
      setRegions(rs);
      setForm((f) => ({ ...f, region: f.region || rs[0] }));
    });
  }, [token]);

  useEffect(() => {
    if (!form.kpi) return;
    api.metaHypotheses(token, form.kpi).then((hs) => {
      setHypotheses(hs);
      setForm((f) => ({ ...f, hypothesisId: hs.some((h) => h.id === f.hypothesisId) ? f.hypothesisId : hs[0]?.id || "" }));
    });
  }, [token, form.kpi]);

  function refresh() {
    api.listFeedback(token).then(setHistory);
  }
  useEffect(refresh, [token]);

  async function submit(e) {
    e.preventDefault();
    setStatus("saving");
    try {
      await api.submitFeedback(token, form);
      setStatus("saved");
      refresh();
    } catch (e) {
      setStatus("error: " + e.message);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Feedback" subtitle="Analyst corrections feed back into future hypothesis ranking (no retraining needed for this demo)" />

      <form onSubmit={submit} className="mb-10 rounded-md bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldSelect
            label="KPI"
            value={form.kpi}
            onChange={(v) => setForm({ ...form, kpi: v })}
            options={kpis.map((k) => k.id)}
            labels={kpis.map((k) => k.name)}
          />
          <FieldSelect label="Region" value={form.region} onChange={(v) => setForm({ ...form, region: v })} options={regions} />
          <FieldSelect
            label="Hypothesis"
            value={form.hypothesisId}
            onChange={(v) => setForm({ ...form, hypothesisId: v })}
            options={hypotheses.map((h) => h.id)}
            labels={hypotheses.map((h) => h.label)}
          />
        </div>
        <div className="mt-4 flex gap-2">
          {["correct", "incorrect"].map((v) => (
            <button
              type="button"
              key={v}
              onClick={() => setForm({ ...form, verdict: v })}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${form.verdict === v ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]" : "border-[var(--color-line)] text-[var(--color-body)]"}`}
            >
              {v === "correct" ? "Correct / useful" : "Incorrect / not useful"}
            </button>
          ))}
        </div>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block font-medium text-[var(--color-heading)]">Actual outcome (optional)</span>
          <textarea
            value={form.actualOutcome}
            onChange={(e) => setForm({ ...form, actualOutcome: e.target.value })}
            className="w-full rounded-lg border border-[var(--color-line)] p-2 text-sm"
            rows={2}
            placeholder="What actually happened, if known"
          />
        </label>
        <button type="submit" className="mt-4 rounded-full bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold text-white">
          Submit feedback
        </button>
        {status && <span className="ml-3 text-xs text-[var(--color-body)]">{status}</span>}
      </form>

      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-body)]/50">Feedback history</div>
      {!history ? (
        <Loading />
      ) : history.length === 0 ? (
        <p className="text-sm text-[var(--color-body)]/50">No feedback submitted yet.</p>
      ) : (
        <div className="divide-y divide-[var(--color-line)]">
          {history.slice().reverse().map((f) => (
            <div key={f.id} className="py-2.5 text-sm">
              <span className="font-mono-num text-xs text-[var(--color-body)]/50">{f.createdAt.slice(0, 16)}</span>, {f.kpi}/{f.region} / {f.hypothesisId}:{" "}
              <span className={f.verdict === "correct" ? "font-medium text-[var(--color-green)]" : "font-medium text-[var(--color-clay)]"}>{f.verdict}</span>
              {f.actualOutcome && <div className="text-xs text-[var(--color-body)]/60">{f.actualOutcome}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FieldSelect({ label, value, onChange, options, labels }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block font-medium text-[var(--color-heading)]">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-[var(--color-line)] p-2">
        {options.map((o, i) => (
          <option key={o} value={o}>
            {labels ? labels[i] : o}
          </option>
        ))}
      </select>
    </label>
  );
}
