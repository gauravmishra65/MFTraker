import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, mfApi } from "@/lib/api";

interface StockResult {
  kind: "stock";
  symbol: string;
  yahooSymbol: string;
  name: string;
  exchange?: string;
  capCategory?: string | null;
}

interface MFResult {
  kind: "mf";
  id: string;
  name: string;
  amc?: string;
  category?: string;
}

type Result = StockResult | MFResult;

export default function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  useEffect(() => {
    if (!q || q.length < 2) { setResults([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      try {
        const [stockRes, mfRes] = await Promise.allSettled([
          api.get(`/stocks/search?q=${encodeURIComponent(q)}`),
          mfApi.search(q),
        ]);

        const stocks: StockResult[] = (stockRes.status === "fulfilled"
          ? (stockRes.value.data.results ?? [])
          : []
        ).slice(0, 5).map((r: any) => ({ kind: "stock" as const, ...r }));

        const mfs: MFResult[] = (mfRes.status === "fulfilled"
          ? (mfRes.value ?? [])
          : []
        ).slice(0, 4).map((r: any) => ({ kind: "mf" as const, id: r.id, name: r.name, amc: r.amc, category: r.category }));

        const combined = [...stocks, ...mfs];
        setResults(combined);
        if (combined.length) setOpen(true);
      } catch { /* ignore */ }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function pick(r: Result) {
    setQ("");
    setOpen(false);
    if (r.kind === "stock") {
      nav(`/stocks/${encodeURIComponent(r.yahooSymbol ?? r.symbol)}`);
    } else {
      nav(`/mf/${encodeURIComponent(r.id)}`);
    }
  }

  const stocks  = results.filter((r): r is StockResult => r.kind === "stock");
  const mfs     = results.filter((r): r is MFResult    => r.kind === "mf");

  return (
    <div ref={ref} className="relative">
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        placeholder="Search stocks or mutual funds…"
        className="w-full h-10 pl-9 pr-3 rounded-md text-sm bg-slate-100 dark:bg-slate-800 border border-transparent focus:bg-white dark:focus:bg-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
      />
      {open && results.length > 0 && (
        <div className="absolute z-30 mt-1 left-0 right-0 max-h-[28rem] overflow-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg">
          {stocks.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800">
                Stocks
              </div>
              {stocks.map((r) => (
                <button
                  key={r.yahooSymbol ?? r.symbol}
                  onClick={() => pick(r)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{r.name}</div>
                    <div className="text-xs text-slate-500 truncate">{r.symbol} · {r.exchange ?? "NSE"}</div>
                  </div>
                  {r.capCategory && (
                    <span className="text-[10px] uppercase tracking-wide text-slate-500 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0">
                      {r.capCategory}
                    </span>
                  )}
                </button>
              ))}
            </>
          )}

          {mfs.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800 border-t border-slate-100 dark:border-slate-800">
                Mutual Funds
              </div>
              {mfs.map((r) => (
                <button
                  key={r.id}
                  onClick={() => pick(r)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{r.name}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {[r.amc, r.category].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <span className="text-[10px] uppercase tracking-wide text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/30 shrink-0">
                    MF
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
