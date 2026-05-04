import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";

interface Result {
  symbol: string;
  yahooSymbol: string;
  name: string;
  exchange?: string;
  capCategory?: string | null;
}

export default function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();

  useEffect(() => {
    if (!q) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/stocks/search?q=${encodeURIComponent(q)}`);
        setResults(data.results ?? []);
        setOpen(true);
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
    nav(`/stocks/${encodeURIComponent(r.yahooSymbol ?? r.symbol)}`);
  }

  return (
    <div ref={ref} className="relative">
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        placeholder="Search stocks (e.g., RELIANCE, TCS, Infosys)…"
        className="w-full h-10 pl-9 pr-3 rounded-md text-sm bg-slate-100 dark:bg-slate-800 border border-transparent focus:bg-white dark:focus:bg-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
      />
      {open && results.length > 0 && (
        <div className="absolute z-30 mt-1 left-0 right-0 max-h-96 overflow-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg">
          {results.map((r) => (
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
                <span className="text-[10px] uppercase tracking-wide text-slate-500 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                  {r.capCategory}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
