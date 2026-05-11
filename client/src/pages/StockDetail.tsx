import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAuthStore } from "@/store/auth";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { api } from "@/lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { changeColor, classNames, formatINR, formatPct } from "@/lib/format";
import StockChart from "@/components/stocks/StockChart";

const SHAREHOLDING_COLORS = ["#2f8df8", "#16a34a", "#f59e0b", "#9333ea"];

interface StockData {
  id: string;
  symbol: string;
  yahoo_symbol: string;
  name: string;
  exchange: string;
  sector: string | null;
  cap_category: string | null;
  isin: string | null;
}

interface QuoteData {
  price: number;
  change: number;
  changePct: number;
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  volume?: number;
  marketCap?: number;
}

interface PeerData {
  id: string;
  symbol: string;
  yahooSymbol: string;
  name: string;
  sector: string | null;
}

interface ShareholdingPattern {
  group: string;
  weight: number;
}

export default function StockDetail() {
  const { symbol = "" } = useParams();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const quote = useQuery({
    queryKey: ["quote", symbol],
    queryFn: async () => {
      const { data } = await api.get(`/stocks/quote/${encodeURIComponent(symbol)}`);
      return data as { stock: StockData | null; quote: QuoteData | null };
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const peers = useQuery({
    queryKey: ["peers", symbol],
    queryFn: async () => {
      const res = await api.get(`/stocks/${encodeURIComponent(symbol)}/similar`);
      return (res.data as { peers: PeerData[] }).peers;
    },
    enabled: !!quote.data?.stock
  });

  const shareholding = useQuery({
    queryKey: ["shareholding", symbol],
    queryFn: async () => {
      const res = await api.get(`/stocks/${encodeURIComponent(symbol)}/shareholding`);
      return res.data as { pattern: ShareholdingPattern[]; asOf: string; symbol: string };
    },
    enabled: !!quote.data?.stock
  });

  const watchlists = useQuery({
    queryKey: ["watchlists"],
    queryFn: async () => {
      const res = await api.get("/watchlists");
      return (res.data as { watchlists: { id: string; name: string }[] }).watchlists;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const addToWatch = useMutation({
    mutationFn: async () => {
      const wl = watchlists.data?.[0];
      if (!wl) throw new Error("No watchlist found. Create one first.");
      if (!quote.data?.stock?.id) throw new Error("Stock not found in database. Try searching from the screener.");
      await api.post("/watchlists/items", { watchListId: wl.id, stockId: quote.data.stock.id });
    },
    onSuccess: () => { toast.success("Added to watchlist"); qc.invalidateQueries({ queryKey: ["watchlists"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to add to watchlist")
  });

  const q = quote.data?.quote;
  const s = quote.data?.stock;

  return (
    <div className="space-y-6">
      {quote.isError && (
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md px-4 py-3">
          Failed to load stock data. Please try again.
        </div>
      )}

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
            {shareholding.isLoading ? (
              <div className="h-56 flex items-center justify-center text-sm text-slate-400 animate-pulse">Loading...</div>
            ) : shareholding.data?.pattern ? (
              <div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={shareholding.data.pattern} dataKey="weight" nameKey="group" innerRadius={40} outerRadius={75} paddingAngle={2}>
                        {shareholding.data.pattern.map((_, i) => (
                          <Cell key={i} fill={SHAREHOLDING_COLORS[i % SHAREHOLDING_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => `${v}%`} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 text-center">Estimated pattern (as of {shareholding.data.asOf})</p>
              </div>
            ) : (
              <div className="text-sm text-slate-500">No shareholding data available.</div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Similar stocks</CardTitle></CardHeader>
        <CardBody>
          {peers.isLoading ? (
            <div className="text-sm text-slate-400 animate-pulse">Loading peers...</div>
          ) : peers.data?.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {peers.data.map((p) => (
                <a
                  key={p.id}
                  href={`/stocks/${p.yahooSymbol}`}
                  className="flex items-center justify-between p-3 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.symbol} · {p.sector ?? "—"}</div>
                  </div>
                  <span className="text-xs text-brand-600">&rarr;</span>
                </a>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500">No similar stocks found in the database.</div>
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
