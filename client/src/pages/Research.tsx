import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { changeColor, classNames, formatINR, formatPct } from "@/lib/format";
import ResearchPanel from "@/components/research/ResearchPanel";
import { FlaskConical, Search } from "lucide-react";

interface Holding {
  id: string;
  instrumentId: string;
  symbol: string;
  name: string;
  instrumentType: string;
  quantity: number;
  avgPrice: number;
  invested: number;
  ltp: number;
  currentValue: number;
  pnl: number;
  pnlPct: number;
  dayChange: number;
  sector: string | null;
  category: string | null;
  subCategory: string | null;
}

export default function Research() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["portfolio"],
    queryFn: async () => (await api.get("/portfolio")).data as { holdings: Holding[] },
    staleTime: 30_000,
  });

  const holdings = data?.holdings ?? [];

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return holdings.filter(
      (h) => !q || h.symbol.toLowerCase().includes(q) || h.name.toLowerCase().includes(q)
    );
  }, [holdings, query]);

  const selected = holdings.find((h) => h.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-brand-500" />
          Research
        </h1>
        <p className="text-sm text-slate-500 mt-1">Fundamentals, analyst consensus, and scenario projections for your holdings</p>
      </div>

      <div className="flex gap-4 min-h-[calc(100vh-200px)]">
        {/* Left rail — holdings list */}
        <aside className="w-[280px] shrink-0 flex flex-col gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter holdings…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          {/* Stock group */}
          <HoldingGroup
            label="Stocks"
            items={filtered.filter((h) => h.instrumentType === "STOCK")}
            selectedId={selected?.id ?? null}
            onSelect={(h) => setSelectedId(h.id)}
            isLoading={isLoading}
          />

          {/* MF group */}
          <HoldingGroup
            label="Mutual Funds"
            items={filtered.filter((h) => h.instrumentType === "MF")}
            selectedId={selected?.id ?? null}
            onSelect={(h) => setSelectedId(h.id)}
            isLoading={isLoading}
          />

          {!isLoading && holdings.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">No holdings yet. Add transactions to get started.</p>
          )}
        </aside>

        {/* Right side — research panel */}
        <div className="flex-1 min-w-0 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-y-auto">
          {selected ? (
            <div className="px-6 py-5">
              <div className="mb-5 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-lg">{selected.symbol}</span>
                  <span className={classNames(
                    "text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-medium",
                    selected.instrumentType === "MF"
                      ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  )}>
                    {selected.instrumentType === "MF" ? "MF" : "Stock"}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">{selected.name}</p>
                <div className="flex gap-4 mt-2 text-xs text-slate-500 flex-wrap">
                  <span>Value <span className="font-mono text-slate-700 dark:text-slate-200 ml-1">{formatINR(selected.currentValue, { compact: true })}</span></span>
                  <span>P&amp;L <span className={classNames("font-mono ml-1", changeColor(selected.pnl))}>{formatINR(selected.pnl, { compact: true })} ({formatPct(selected.pnlPct)})</span></span>
                </div>
              </div>
              <ResearchPanel
                type={selected.instrumentType === "MF" ? "mf" : "stock"}
                id={selected.instrumentId}
                name={selected.name}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-64 gap-3 text-slate-400">
              <FlaskConical className="w-10 h-10" />
              <p className="text-sm">Select a holding from the left to view research</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Holding group in left rail ────────────────────────────────────────────────

function HoldingGroup({
  label,
  items,
  selectedId,
  onSelect,
  isLoading,
}: {
  label: string;
  items: Holding[];
  selectedId: string | null;
  onSelect: (h: Holding) => void;
  isLoading: boolean;
}) {
  if (!isLoading && items.length === 0) return null;

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 px-1 mb-1">{label}</p>
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-3 py-2.5 space-y-1 animate-pulse">
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-16" />
                <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded w-28" />
              </div>
            ))
          : items.map((h) => (
              <button
                key={h.id}
                onClick={() => onSelect(h)}
                className={classNames(
                  "w-full text-left px-3 py-2.5 transition-colors",
                  h.id === selectedId
                    ? "bg-brand-50 dark:bg-brand-900/30"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={classNames(
                    "text-sm font-medium truncate",
                    h.id === selectedId ? "text-brand-700 dark:text-brand-300" : "text-slate-700 dark:text-slate-200"
                  )}>{h.symbol}</span>
                  <span className={classNames("text-xs font-mono shrink-0", changeColor(h.pnl))}>
                    {formatPct(h.pnlPct)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 truncate">{formatINR(h.currentValue, { compact: true })}</div>
              </button>
            ))}
      </div>
    </div>
  );
}
