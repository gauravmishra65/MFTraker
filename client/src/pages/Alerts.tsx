import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Trash2, Plus, BellRing } from "lucide-react";

import { api } from "@/lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { classNames, formatINR } from "@/lib/format";

const TYPE_LABELS: Record<string, string> = {
  PRICE_ABOVE: "Price above",
  PRICE_BELOW: "Price below",
  PCT_CHANGE:  "Daily change %",
  VOLUME_SPIKE: "Volume spike (×)"
};

export default function Alerts() {
  const qc = useQueryClient();
  const alerts = useQuery({
    queryKey: ["alerts"],
    queryFn: async () => (await api.get("/alerts")).data.alerts as any[]
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/alerts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] })
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

      <Card>
        <CardHeader><CardTitle>Active alerts</CardTitle></CardHeader>
        <CardBody>
          {(alerts.data ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-sm text-slate-500">
              <BellRing className="w-8 h-8 mb-2 text-slate-300" />
              No alerts yet. Create one above.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {alerts.data!.map((a) => (
                <li key={a.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{a.symbol}</div>
                    <div className="text-xs text-slate-500">
                      {TYPE_LABELS[a.type]} {a.type.startsWith("PRICE") ? formatINR(a.threshold) : `${a.threshold}`}
                      {a.triggeredAt && <span className="ml-2 text-amber-500">• Triggered {new Date(a.triggeredAt).toLocaleString("en-IN")}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={classNames(
                      "text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full",
                      a.active ? "bg-up/10 text-up" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    )}>
                      {a.active ? "Active" : "Off"}
                    </span>
                    <button onClick={() => remove.mutate(a.id)} className="text-slate-500 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
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
  const [form, setForm] = useState({ symbol: "", type: "PRICE_ABOVE" as keyof typeof TYPE_LABELS, threshold: "" });
  const [loading, setLoading] = useState(false);
  async function save() {
    if (!form.symbol || !form.threshold) return toast.error("Fill all fields");
    setLoading(true);
    try {
      await api.post("/alerts", {
        symbol: form.symbol.toUpperCase(),
        type: form.type,
        threshold: Number(form.threshold)
      });
      toast.success("Alert created");
      onCreated();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally { setLoading(false); }
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-5">
        <h2 className="text-lg font-semibold">New alert</h2>
        <div className="mt-4 space-y-3">
          <Input
            label="Symbol"
            placeholder="RELIANCE.NS"
            value={form.symbol}
            onChange={(e) => setForm({ ...form, symbol: e.target.value })}
            hint="Use NSE Yahoo format (e.g., RELIANCE.NS)"
          />
          <div>
            <label className="text-sm">Trigger</label>
            <select
              className="mt-1 w-full h-10 px-3 rounded-md text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as any })}
            >
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <Input
            label="Threshold"
            type="number"
            step="0.01"
            value={form.threshold}
            onChange={(e) => setForm({ ...form, threshold: e.target.value })}
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
