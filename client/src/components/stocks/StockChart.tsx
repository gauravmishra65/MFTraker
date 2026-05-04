import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { classNames } from "@/lib/format";

type Range = "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y" | "5y" | "max";
const ranges: { key: Range; label: string; interval: string }[] = [
  { key: "1d",  label: "1D",  interval: "5m"  },
  { key: "5d",  label: "1W",  interval: "30m" },
  { key: "1mo", label: "1M",  interval: "1d"  },
  { key: "3mo", label: "3M",  interval: "1d"  },
  { key: "6mo", label: "6M",  interval: "1d"  },
  { key: "1y",  label: "1Y",  interval: "1d"  },
  { key: "5y",  label: "5Y",  interval: "1wk" },
  { key: "max", label: "All", interval: "1mo" }
];

export default function StockChart({ symbol }: { symbol: string }) {
  const [range, setRange] = useState<Range>("1mo");
  const [withSMA, setWithSMA] = useState(true);
  const cur = ranges.find((r) => r.key === range)!;

  const { data, isLoading } = useQuery({
    queryKey: ["history", symbol, cur.key, cur.interval],
    queryFn: async () => {
      const { data } = await api.get(`/stocks/history/${encodeURIComponent(symbol)}?range=${cur.key}&interval=${cur.interval}`);
      return data.candles as { t: number; o: number; h: number; l: number; c: number; v: number }[];
    }
  });

  const chartData = useMemo(() => {
    if (!data) return [];
    const SMA = 20;
    const smas: (number | null)[] = data.map((_, i) => {
      if (i < SMA - 1) return null;
      const slice = data.slice(i - SMA + 1, i + 1);
      return slice.reduce((s, c) => s + c.c, 0) / SMA;
    });
    return data.map((c, i) => ({
      ts: c.t * 1000,
      label: new Date(c.t * 1000).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      close: c.c,
      sma: withSMA ? smas[i] : null
    }));
  }, [data, withSMA]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {ranges.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={classNames(
              "px-2.5 py-1 text-xs rounded-md font-medium",
              r.key === range
                ? "bg-brand-600 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
            )}
          >
            {r.label}
          </button>
        ))}
        <div className="flex-1" />
        <label className="text-xs flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={withSMA} onChange={(e) => setWithSMA(e.target.checked)} />
          SMA 20
        </label>
      </div>

      <div className="h-72">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-sm text-slate-500">Loading…</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="closeFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1c70de" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#1c70de" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.25)" />
              <XAxis dataKey="label" minTickGap={32} stroke="rgba(100,116,139,.7)" fontSize={11} />
              <YAxis domain={["auto", "auto"]} stroke="rgba(100,116,139,.7)" fontSize={11} width={48} />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", color: "#e2e8f0", fontSize: 12 }}
                formatter={(v: number) => v?.toFixed(2)}
              />
              <Area type="monotone" dataKey="close" stroke="#1c70de" strokeWidth={2} fill="url(#closeFill)" />
              {withSMA && <Area type="monotone" dataKey="sma" stroke="#f59e0b" strokeWidth={1.5} fill="transparent" dot={false} />}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
