import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

import { api } from "@/lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { changeColor, classNames, formatINR, formatPct } from "@/lib/format";
import { Download, Plus } from "lucide-react";

const SECTOR_COLORS = ["#2f8df8", "#16a34a", "#f59e0b", "#dc2626", "#9333ea", "#0ea5e9", "#65a30d", "#475569", "#ec4899"];

export default function Portfolio() {
  const qc = useQueryClient();
  const portfolio = useQuery({
    queryKey: ["portfolio"],
    queryFn: async () => (await api.get("/portfolio")).data as { holdings: any[]; summary: any },
    refetchInterval: 15_000
  });

  const sectorData = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of portfolio.data?.holdings ?? []) {
      const key = h.sector ?? "Other";
      m.set(key, (m.get(key) ?? 0) + h.currentValue);
    }
    return [...m.entries()].map(([sector, value]) => ({ sector, value }));
  }, [portfolio.data]);

  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
          <p className="text-sm text-slate-500 mt-1">Holdings, allocation and live P&amp;L</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAdd(true)} variant="primary"><Plus className="w-4 h-4" /> Add transaction</Button>
          <DownloadButton label="CSV" data={portfolio.data?.holdings ?? []} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Invested"      value={formatINR(portfolio.data?.summary?.invested, { compact: true })} />
        <Stat label="Current value" value={formatINR(portfolio.data?.summary?.currentValue, { compact: true })} />
        <Stat label="P&L"           value={formatINR(portfolio.data?.summary?.pnl, { compact: true })} sub={formatPct(portfolio.data?.summary?.pnlPct)} subClass={changeColor(portfolio.data?.summary?.pnl)} />
        <Stat label="Day's change"  value={formatINR(portfolio.data?.summary?.dayChange, { compact: true })} subClass={changeColor(portfolio.data?.summary?.dayChange)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Holdings</CardTitle></CardHeader>
          <CardBody>
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="text-left px-5 py-2">Symbol</th>
                    <th className="text-right px-3 py-2">Qty</th>
                    <th className="text-right px-3 py-2">Avg</th>
                    <th className="text-right px-3 py-2">LTP</th>
                    <th className="text-right px-3 py-2">Invested</th>
                    <th className="text-right px-3 py-2">Value</th>
                    <th className="text-right px-5 py-2">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {(portfolio.data?.holdings ?? []).map((h) => (
                    <tr key={h.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-5 py-2">
                        <div className="font-medium">{h.symbol}</div>
                        <div className="text-xs text-slate-500 truncate max-w-xs">{h.name}</div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{h.quantity}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatINR(h.avgPrice)}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatINR(h.ltp)}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatINR(h.invested, { compact: true })}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatINR(h.currentValue, { compact: true })}</td>
                      <td className={classNames("px-5 py-2 text-right font-mono", changeColor(h.pnl))}>
                        {formatINR(h.pnl, { compact: true })}
                        <div className="text-xs">{formatPct(h.pnlPct)}</div>
                      </td>
                    </tr>
                  ))}
                  {!portfolio.data?.holdings?.length && (
                    <tr><td colSpan={7} className="px-5 py-6 text-center text-slate-500 text-sm">No holdings yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Sector allocation</CardTitle></CardHeader>
          <CardBody>
            <div className="h-72">
              {sectorData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-500">No data.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sectorData} dataKey="value" nameKey="sector" innerRadius={50} outerRadius={90} paddingAngle={2}>
                      {sectorData.map((_, i) => <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatINR(v, { compact: true })} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {showAdd && <AddTransactionModal onClose={() => setShowAdd(false)} onSuccess={() => qc.invalidateQueries({ queryKey: ["portfolio"] })} />}
    </div>
  );
}

/** Client-side CSV download from portfolio data. */
function DownloadButton({ label, data }: { label: string; data: any[] }) {
  const [loading, setLoading] = useState(false);
  async function go() {
    setLoading(true);
    try {
      const header = "Symbol,Name,Type,Quantity,AvgPrice,Invested,LTP,CurrentValue,P&L,P&L %\n";
      const rows = data.map((h) =>
        [h.symbol, `"${(h.name ?? "").replace(/"/g, '""')}"`, h.instrumentType ?? "STOCK", h.quantity, h.avgPrice?.toFixed(2), h.invested?.toFixed(2), h.ltp?.toFixed(2), h.currentValue?.toFixed(2), h.pnl?.toFixed(2), h.pnlPct?.toFixed(2)].join(",")
      );
      const csv = header + rows.join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "portfolio.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message ?? "Download failed");
    } finally { setLoading(false); }
  }
  return (
    <Button variant="secondary" onClick={go} loading={loading}>
      <Download className="w-4 h-4" /> {label}
    </Button>
  );
}

function Stat({ label, value, sub, subClass }: { label: string; value: string; sub?: string; subClass?: string }) {
  return (
    <Card>
      <CardBody className="pt-5">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="mt-2 font-semibold text-2xl tracking-tight">{value}</div>
        {sub && <div className={classNames("mt-1 text-xs font-mono", subClass)}>{sub}</div>}
      </CardBody>
    </Card>
  );
}

function AddTransactionModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    symbolQuery: "",
    stockId: "",
    type: "BUY" as "BUY" | "SELL" | "SIP" | "LUMPSUM" | "REDEEM",
    date: new Date().toISOString().slice(0, 10),
    quantity: "",
    price: "",
    brokerage: "0"
  });
  const [results, setResults] = useState<any[]>([]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!form.stockId) throw new Error("Pick a stock");
      await api.post("/portfolio/transactions", {
        stockId: form.stockId,
        type: form.type,
        date: new Date(form.date),
        quantity: Number(form.quantity),
        price: Number(form.price),
        brokerage: Number(form.brokerage)
      });
    },
    onSuccess: () => { toast.success("Transaction added"); onSuccess(); onClose(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed")
  });

  async function search(q: string) {
    setForm((f) => ({ ...f, symbolQuery: q }));
    if (!q) return setResults([]);
    const { data } = await api.get(`/stocks/search?q=${encodeURIComponent(q)}`);
    setResults((data.results ?? []).filter((r: any) => r.local).slice(0, 5));
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-5">
        <h2 className="text-lg font-semibold">Add transaction</h2>
        <div className="mt-4 space-y-3">
          <div className="relative">
            <Input
              label="Stock"
              placeholder="Search by symbol or name…"
              value={form.symbolQuery}
              onChange={(e) => search(e.target.value)}
            />
            {results.length > 0 && (
              <div className="absolute z-10 mt-1 left-0 right-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg">
                {results.map((r) => (
                  <button
                    key={r.symbol}
                    onClick={() => { setForm((f) => ({ ...f, stockId: r.id ?? "", symbolQuery: r.name })); setResults([]); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {r.name} <span className="text-xs text-slate-500">({r.symbol})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm">Type</label>
              <select
                className="mt-1 w-full h-10 px-3 rounded-md text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as any }))}
              >
                <option value="BUY">Buy</option>
                <option value="SELL">Sell</option>
                <option value="SIP">SIP</option>
                <option value="LUMPSUM">Lumpsum</option>
                <option value="REDEEM">Redeem</option>
              </select>
            </div>
            <Input label="Date" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            <Input label="Quantity" type="number" step="0.0001" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
            <Input label="Price (per unit)" type="number" step="0.01" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
            <Input label="Brokerage" type="number" step="0.01" value={form.brokerage} onChange={(e) => setForm((f) => ({ ...f, brokerage: e.target.value }))} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => submit.mutate()} loading={submit.isPending}>Save</Button>
        </div>
      </div>
    </div>
  );
}
