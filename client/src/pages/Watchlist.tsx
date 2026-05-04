import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { api } from "@/lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { changeColor, classNames, formatINR, formatPct } from "@/lib/format";
import { Trash2, Plus } from "lucide-react";

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

  useEffect(() => {
    if (watchlists.data && watchlists.data.length && !activeId) setActiveId(watchlists.data[0].id);
  }, [watchlists.data, activeId]);

  const live = useQuery({
    queryKey: ["watchlist-live", activeId],
    queryFn: async () => activeId ? (await api.get(`/watchlists/live?watchListId=${activeId}`)).data : null,
    enabled: !!activeId,
    refetchInterval: 15_000
  });

  const create = useMutation({
    mutationFn: async (name: string) => (await api.post("/watchlists", { name })).data,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["watchlists"] }); toast.success("Watchlist created"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to create watchlist")
  });

  const remove = useMutation({
    mutationFn: async (itemId: string) => api.delete(`/watchlists/items/${itemId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["watchlist-live", activeId] }); toast.success("Item removed"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to remove item")
  });

  const items: WatchlistItem[] = live.data?.items ?? [];
  const quotes: Record<string, QuoteData> = {};
  for (const q of (live.data?.quotes ?? [])) quotes[q.symbol] = q;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Watchlists</h1>
        <NewWatchlist onCreate={(name) => create.mutate(name)} />
      </div>

      {(watchlists.isError || live.isError) && (
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
                    <tr><td colSpan={5} className="px-5 py-6 text-center text-slate-500 text-sm">Empty — add stocks from search.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
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
