import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { api } from "@/lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { changeColor, classNames, formatINR, formatPct } from "@/lib/format";
import StockChart from "@/components/stocks/StockChart";

const SHAREHOLDING_COLORS = ["#2f8df8", "#16a34a", "#f59e0b", "#9333ea"];

export default function StockDetail() {
  const { symbol = "" } = useParams();
  const qc = useQueryClient();

  const quote = useQuery({
    queryKey: ["quote", symbol],
    queryFn: async () => {
      const { data } = await api.get(`/stocks/quote/${encodeURIComponent(symbol)}`);
      return data as { stock: any; quote: any };
    },
    refetchInterval: 5_000
  });

  const peers = useQuery({
    queryKey: ["peers", symbol],
    queryFn: async () => (await api.get(`/stocks/${encodeURIComponent(symbol)}/similar`)).data.peers as any[],
    enabled: !!quote.data?.stock
  });

  const shareholding = useQuery({
    queryKey: ["shareholding", symbol],
    queryFn: async () => (await api.get(`/stocks/${encodeURIComponent(symbol)}/shareholding`)).data,
    enabled: !!quote.data?.stock
  });

  const watchlists = useQuery({
    queryKey: ["watchlists"],
    queryFn: async () => (await api.get("/watchlists")).data.watchlists as any[]
  });

  const addToWatch = useMutation({
    mutationFn: async () => {
      const wl = watchlists.data?.[0];
      if (!wl) throw new Error("No watchlist found. Create one first.");
      if (!quote.data?.stock?.id) throw new Error("Stock not in DB — open it from screener instead.");
      await api.post("/watchlists/items", { watchListId: wl.id, stockId: quote.data.stock.id });
    },
    onSuccess: () => { toast.success("Added to watchlist"); qc.invalidateQueries({ queryKey: ["watchlists"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed")
  });

  const q = quote.data?.quote;
  const s = quote.data?.stock;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{s?.name ?? symbol}</h1>
          <div className="text-sm text-slate-500 mt-0.5">
            {s?.symbol ?? symbol} · {s?.exchange ?? "NSE"} {s?.sector && `· ${s.sector}`}
          </div>
        </div>
        <div className="flex items-end gap-4">
          <div className="text-right">
            <div className="font-mono text-3xl font-semibold">
              {q?.price?.toLocaleString("en-IN", { maximumFractionDigits: 2 }) ?? "—"}
            </div>
            <div className={classNames("font-mono text-sm", changeColor(q?.changePct))}>
              {q?.change?.toFixed(2)} ({formatPct(q?.changePct)})
            </div>
          </div>
          <Button onClick={() => addToWatch.mutate()} loading={addToWatch.isPending}>+ Watchlist</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Price chart</CardTitle></CardHeader>
        <CardBody><StockChart symbol={symbol} /></CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Key metrics</CardTitle></CardHeader>
          <CardBody className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <Metric label="Open" value={formatINR(q?.open)} />
            <Metric label="High" value={formatINR(q?.high)} />
            <Metric label="Low"  value={formatINR(q?.low)} />
            <Metric label="Prev close" value={formatINR(q?.previousClose)} />
            <Metric label="52W high" value={formatINR(q?.fiftyTwoWeekHigh)} />
            <Metric label="52W low"  value={formatINR(q?.fiftyTwoWeekLow)} />
            <Metric label="Volume"   value={q?.volume?.toLocaleString("en-IN") ?? "—"} />
            <Metric label="Market cap" value={formatINR(q?.marketCap, { compact: true })} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Shareholding pattern</CardTitle>
          </CardHeader>
          <CardBody>
            {shareholding.data?.pattern ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={shareholding.data.pattern} dataKey="weight" nameKey="group" innerRadius={40} outerRadius={75} paddingAngle={2}>
                      {shareholding.data.pattern.map((_: any, i: number) => (
                        <Cell key={i} fill={SHAREHOLDING_COLORS[i % SHAREHOLDING_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-sm text-slate-500">Loading…</div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Similar stocks</CardTitle></CardHeader>
        <CardBody>
          {peers.data?.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {peers.data.map((p) => (
                <a
                  key={p.id}
                  href={`/stocks/${p.yahooSymbol}`}
                  className="flex items-center justify-between p-3 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.symbol} · {p.sector}</div>
                  </div>
                  <span className="text-xs text-brand-600">→</span>
                </a>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500">No peers in DB.</div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-mono">{value}</div>
    </div>
  );
}
