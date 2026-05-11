import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { api, stocksApi, mfApi, watchlistsApi } from "@/lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { changeColor, classNames, formatINR, formatPct } from "@/lib/format";
import { Trash2, Plus, Search, X } from "lucide-react";

interface WatchlistItem {
  id: string;
  stock?: { id: string; symbol: string; yahooSymbol: string; name: string } | null;
  mf?: { id: string; schemeCode: string; name: string } | null;
}

interface WatchlistData {
  id: string;
  name: string;
  items: WatchlistItem[];
}

interface QuoteData {
  symbol: string;
  price: number;
  changePct: number;
  high?: number;
  low?: number;
}

interface SearchResult {
  id: string;
  symbol: string;
  yahooSymbol?: string;
  name: string;
  type: "stock" | "mf";
  schemeCode?: string;
}

export default function Watchlist() {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);

  const watchlists = useQuery({
    queryKey: ["watchlists"],
    queryFn: async () => {
      const res = await api.get("/watchlists");
      return (res.data as { watchlists: WatchlistData[] }).watchlists;
    }
  });

  // Set the first watchlist as active once loaded, without overriding user selection
  const firstId = watchlists.data?.[0]?.id ?? null;
  useEffect(() => {
    if (firstId && !activeId) setActiveId(firstId);
  }, [firstId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive the items for the active watchlist directly from the already-loaded cache
  const activeWatchlist = watchlists.data?.find((w) => w.id === activeId) ?? null;
  const items: WatchlistItem[] = activeWatchlist?.items ?? [];

  // Fetch only live quotes (no DB round-trip) for NSE symbols in the active list
  const yahooSymbols = useMemo(
    () => items.map((it) => it.stock?.yahooSymbol).filter((s): s is string => !!s),
    [items]
  );

  const live = useQuery({
    queryKey: ["watchlist-quotes", activeId, yahooSymbols.join(",")],
    queryFn: () => watchlistsApi.getQuotes(yahooSymbols),
    enabled: yahooSymbols.length > 0,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const create = useMutation({
    mutationFn: async (name: string) => (await api.post("/watchlists", { name })).data,
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["watchlists"] });
      toast.success("Watchlist created");
      if (data?.id) setActiveId(data.id);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to create watchlist")
  });

  const remove = useMutation({
    mutationFn: async (itemId: string) => api.delete(`/watchlists/items/${itemId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["watchlists"] });
      toast.success("Item removed");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to remove item")
  });

  const addItem = useMutation({
    mutationFn: async (result: SearchResult) => {
      if (!activeId) throw new Error("Select a watchlist first");
      await watchlistsApi.addItem(activeId, result.type === "stock" ? result.id : undefined, result.type === "mf" ? result.id : undefined);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["watchlists"] });
      toast.success("Added to watchlist");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to add item")
  });

  const quotes = useMemo(
    () => Object.fromEntries((live.data ?? []).map((q: QuoteData) => [q.symbol, q])),
    [live.data]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Watchlists</h1>
        <NewWatchlist onCreate={(name) => create.mutate(name)} />
      </div>

      {(watchlists.isError || live.isError) && !live.isLoading && (
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md px-4 py-3">
          Failed to load watchlist data. Please try again.
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {(watchlists.data ?? []).map((w) => (
          <button
            key={w.id}
            onClick={() => setActiveId(w.id)}
            className={classNames(
              "px-3 h-9 rounded-md text-sm font-medium border",
              w.id === activeId
                ? "bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-900/40 dark:border-brand-700/50 dark:text-brand-200"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
            )}
          >
            {w.name}
            <span className="ml-2 text-xs text-slate-500">{w.items?.length ?? 0}</span>
          </button>
        ))}
      </div>

      {activeId && (
        <AddToWatchlist
          onAdd={(result) => addItem.mutate(result)}
          isAdding={addItem.isPending}
        />
      )}

      {!activeId && !watchlists.isLoading && (
        <div className="text-sm text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-md px-4 py-6 text-center">
          Create a watchlist above to get started.
        </div>
      )}

      {activeId && (
        <Card>
          <CardHeader><CardTitle>Items</CardTitle></CardHeader>
          <CardBody>
            {live.isLoading ? (
              <div className="py-10 text-center text-sm text-slate-400 animate-pulse">Loading prices...</div>
            ) : (
              <div className="overflow-x-auto -mx-5">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="text-left px-5 py-2">Name</th>
                      <th className="text-right px-3 py-2">Price</th>
                      <th className="text-right px-3 py-2">Change</th>
                      <th className="text-right px-3 py-2">Day high/low</th>
                      <th className="px-5 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => {
                      const ySym = it.stock?.yahooSymbol;
                      const q = ySym ? quotes[ySym] : null;
                      const price = q?.price;
                      const ch = q?.changePct;
                      return (
                        <tr key={it.id} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="px-5 py-2">
                            <div className="font-medium">{it.stock?.name ?? it.mf?.name ?? "—"}</div>
                            <div className="text-xs text-slate-500">{it.stock?.symbol ?? it.mf?.schemeCode ?? ""}</div>
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{price != null ? formatINR(price) : "—"}</td>
                          <td className={classNames("px-3 py-2 text-right font-mono", changeColor(ch))}>
                            {ch != null ? formatPct(ch) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs text-slate-500">
                            {q?.high != null && q?.low != null ? `${q.high.toFixed(2)} / ${q.low.toFixed(2)}` : "—"}
                          </td>
                          <td className="px-5 py-2 text-right">
                            <button
                              onClick={() => remove.mutate(it.id)}
                              className="text-slate-500 hover:text-red-600"
                              aria-label="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {items.length === 0 && (
                      <tr><td colSpan={5} className="px-5 py-6 text-center text-slate-500 text-sm">Search for stocks or mutual funds above to add them here.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function AddToWatchlist({ onAdd, isAdding }: { onAdd: (r: SearchResult) => void; isAdding: boolean }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const [stocks, mfs] = await Promise.all([
          stocksApi.search(q),
          mfApi.search(q)
        ]);
        const combined: SearchResult[] = [
          ...stocks.map((s) => ({ id: s.id, symbol: s.symbol, yahooSymbol: s.yahooSymbol, name: s.name, type: "stock" as const })),
          ...mfs.slice(0, 5).map((m: any) => ({ id: m.id, symbol: m.scheme_code ?? m.id, name: m.name, type: "mf" as const, schemeCode: m.scheme_code }))
        ];
        setResults(combined);
        setOpen(combined.length > 0);
      } catch { /* ignore */ } finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function pick(r: SearchResult) {
    onAdd(r);
    setQ("");
    setResults([]);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Search stocks or mutual funds to add (e.g. RELIANCE, HDFC Mid Cap)…"
          className="w-full h-10 pl-9 pr-9 rounded-md text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
          disabled={isAdding}
        />
        {q && (
          <button
            onClick={() => { setQ(""); setResults([]); setOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-30 mt-1 left-0 right-0 max-h-80 overflow-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg">
          {results.map((r) => (
            <button
              key={`${r.type}-${r.id}`}
              onClick={() => pick(r)}
              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 last:border-0"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{r.name}</div>
                <div className="text-xs text-slate-500 truncate">{r.symbol}</div>
              </div>
              <span className={classNames(
                "text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0",
                r.type === "stock"
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
              )}>
                {r.type === "stock" ? "Stock" : "MF"}
              </span>
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="absolute right-10 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

function NewWatchlist({ onCreate }: { onCreate: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) { setError("Name is required"); return; }
    if (trimmed.length > 50) { setError("Name too long (max 50 chars)"); return; }
    setError("");
    onCreate(trimmed);
    setName("");
    setOpen(false);
  }

  if (!open) return <Button variant="secondary" onClick={() => setOpen(true)}><Plus className="w-4 h-4" /> New</Button>;
  return (
    <div className="flex gap-2 items-end">
      <Input label="Name" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder="Long-term" error={error} />
      <Button onClick={handleCreate}>Create</Button>
      <Button variant="ghost" onClick={() => { setOpen(false); setError(""); }}>Cancel</Button>
    </div>
  );
}
