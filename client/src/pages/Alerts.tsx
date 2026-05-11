import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Trash2, Plus, BellRing } from "lucide-react";

import { api, marketApi } from "@/lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { classNames, formatINR, changeColor, formatPct } from "@/lib/format";

const TYPE_LABELS: Record<string, string> = {
  PRICE_ABOVE: "Price above",
  PRICE_BELOW: "Price below",
  PCT_CHANGE:  "Daily change %",
  VOLUME_SPIKE: "Volume spike (x)"
};

const SYMBOL_RE = /^[A-Z0-9.\-^]{1,20}$/;

interface AlertItem {
  id: string;
  symbol: string;
  type: string;
  threshold: number;
  active: boolean;
  triggeredAt: string | null;
}

export default function Alerts() {
  const qc = useQueryClient();

  const alerts = useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      const res = await api.get("/alerts");
      return (res.data as { alerts: AlertItem[] }).alerts;
    },
    staleTime: 30_000,
  });

  // Collect unique Yahoo-format symbols from active alerts for live price fetch
  const alertSymbols = useMemo(
    () => [...new Set((alerts.data ?? []).map((a) => a.symbol).filter(Boolean))].sort(),
    [alerts.data]
  );

  const liveQuotes = useQuery({
    queryKey: ["alert-quotes", alertSymbols.join(",")],
    queryFn: () => marketApi.getQuotes(alertSymbols),
    enabled: alertSymbols.length > 0,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const quotes = liveQuotes.data ?? {};

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/alerts/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["alerts"] }); toast.success("Alert deleted"); },
    onError: (e: Error) => toast.error(e.message ?? "Failed to delete")
  });

  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
          <p className="text-sm text-slate-500 mt-1">Get notified when price thresholds are crossed.</p>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> New alert</Button>
      </div>

      {alerts.isError && (
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md px-4 py-3">
          Failed to load alerts. Please try again.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Active alerts</CardTitle>
          {liveQuotes.isFetching && (
            <span className="ml-2 text-[10px] text-slate-400 animate-pulse">Updating prices…</span>
          )}
        </CardHeader>
        <CardBody>
          {alerts.isLoading ? (
            <div className="py-10 text-center text-sm text-slate-400 animate-pulse">Loading alerts...</div>
          ) : (alerts.data ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-sm text-slate-500">
              <BellRing className="w-8 h-8 mb-2 text-slate-300" />
              No alerts yet. Create one above.
            </div>
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="text-left px-5 py-2">Symbol</th>
                    <th className="text-left px-3 py-2">Condition</th>
                    <th className="text-right px-3 py-2">Current price</th>
                    <th className="text-right px-3 py-2">Day change</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="px-5 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.data!.map((a) => {
                    const q = quotes[a.symbol];
                    const price = q?.price;
                    const changePct = q?.changePct;
                    const isTriggered = !a.active || !!a.triggeredAt;
                    return (
                      <tr key={a.id} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-5 py-3">
                          <div className="font-medium font-mono">{a.symbol.replace(/\.(NS|BO)$/, "")}</div>
                          <div className="text-[10px] text-slate-400">{a.symbol}</div>
                        </td>
                        <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                          {TYPE_LABELS[a.type] ?? a.type}{" "}
                          <span className="font-mono font-medium text-slate-800 dark:text-slate-100">
                            {a.type.startsWith("PRICE") ? formatINR(a.threshold) : a.threshold}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-mono">
                          {price != null ? formatINR(price) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className={classNames("px-3 py-3 text-right font-mono", changeColor(changePct))}>
                          {changePct != null ? formatPct(changePct) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-3 py-3">
                          <span className={classNames(
                            "text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full",
                            isTriggered
                              ? "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
                              : "bg-up/10 text-up"
                          )}>
                            {isTriggered ? (a.triggeredAt ? "Triggered" : "Off") : "Watching"}
                          </span>
                          {a.triggeredAt && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {new Date(a.triggeredAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button onClick={() => remove.mutate(a.id)} className="text-slate-400 hover:text-red-600" aria-label="Delete alert">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {showForm && (
        <NewAlertModal
          onClose={() => setShowForm(false)}
          onCreated={() => { qc.invalidateQueries({ queryKey: ["alerts"] }); setShowForm(false); }}
        />
      )}
    </div>
  );
}

function NewAlertModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ symbol: "", type: "PRICE_ABOVE" as string, threshold: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    const sym = form.symbol.trim().toUpperCase();
    if (!sym) errs.symbol = "Symbol is required";
    else if (!SYMBOL_RE.test(sym)) errs.symbol = "Invalid symbol (e.g. RELIANCE.NS)";
    const threshold = Number(form.threshold);
    if (!form.threshold) errs.threshold = "Threshold is required";
    else if (!Number.isFinite(threshold) || threshold <= 0) errs.threshold = "Must be a positive number";
    else if (threshold > 1e9) errs.threshold = "Threshold is too large";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setLoading(true);
    try {
      await api.post("/alerts", {
        symbol: form.symbol.trim().toUpperCase(),
        type: form.type,
        threshold: Number(form.threshold)
      });
      toast.success("Alert created");
      onCreated();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create alert");
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-5">
        <h2 className="text-lg font-semibold">New alert</h2>
        <div className="mt-4 space-y-3">
          <Input
            label="Symbol"
            placeholder="RELIANCE.NS"
            value={form.symbol}
            onChange={(e) => setForm({ ...form, symbol: e.target.value })}
            error={errors.symbol}
            hint="Use NSE Yahoo format (e.g., RELIANCE.NS)"
          />
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Trigger</label>
            <select
              className="mt-1 w-full h-10 px-3 rounded-md text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <Input
            label="Threshold"
            type="number"
            step="0.01"
            min="0"
            value={form.threshold}
            onChange={(e) => setForm({ ...form, threshold: e.target.value })}
            error={errors.threshold}
            hint={form.type.startsWith("PRICE") ? "Enter price in ₹" : form.type === "PCT_CHANGE" ? "Enter % change" : "Enter multiplier"}
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={loading}>Create</Button>
        </div>
      </div>
    </div>
  );
}
