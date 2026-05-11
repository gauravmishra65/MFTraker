import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Search, Plus, Check, RefreshCw, X, Building2, TrendingUp } from "lucide-react";

import { stockSearchApi } from "@/lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { classNames } from "@/lib/format";

interface StockResult {
  symbol: string;
  yahooSymbol: string;
  name: string;
  exchange: "NSE" | "BSE";
  sector: string | null;
  industry: string | null;
  capCategory: string | null;
  isin: string | null;
}

export default function StockSearch() {
  const [query, setQuery] = useState("");
  const [exchange, setExchange] = useState<"" | "NSE" | "BSE">("");
  const [results, setResults] = useState<StockResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function doSearch(q: string, exch: string) {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setSearching(true);
    try {
      const data = await stockSearchApi.search(q.trim(), exch);
      setResults(data);
      setSearched(true);
    } catch (e: any) {
      toast.error(e.message ?? "Search failed");
    } finally {
      setSearching(false);
    }
  }

  function handleQueryChange(val: string) {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val, exchange), 400);
  }

  function handleExchangeChange(val: "" | "NSE" | "BSE") {
    setExchange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query, val), 200);
  }

  function toggleSelect(symbol: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(results.map((r) => r.symbol)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  const saveMutation = useMutation({
    mutationFn: async (stocks: StockResult[]) => stockSearchApi.save(stocks),
    onSuccess: (data, stocks) => {
      const symbols = new Set(stocks.map((s) => s.symbol));
      setSaved((prev) => new Set([...prev, ...symbols]));
      setSelected(new Set());
      toast.success(`${data.saved} stock${data.saved !== 1 ? "s" : ""} added to database`);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save stocks"),
  });

  function handleSaveSelected() {
    const toSave = results.filter((r) => selected.has(r.symbol));
    if (!toSave.length) return;
    saveMutation.mutate(toSave);
  }

  function handleSaveOne(stock: StockResult) {
    saveMutation.mutate([stock]);
  }

  const unsavedResults = results.filter((r) => !saved.has(r.symbol));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add stocks from NSE / BSE</h1>
        <p className="text-sm text-slate-500 mt-1">
          Search any listed company on NSE or BSE and save it to your database for tracking.
        </p>
      </div>

      {/* Search controls */}
      <Card>
        <CardBody className="pt-5">
          <div className="flex gap-3 flex-wrap items-end">
            <div className="flex-1 min-w-48">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Company name or ticker
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  placeholder="e.g. RELIANCE, Infosys, HDFC Bank…"
                  className="w-full h-10 pl-9 pr-9 rounded-md text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
                />
                {query && (
                  <button
                    onClick={() => { setQuery(""); setResults([]); setSearched(false); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <RefreshCw className="w-4 h-4 text-brand-500 animate-spin" />
                  </div>
                )}
              </div>
            </div>

            <div className="w-36">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Exchange
              </label>
              <select
                value={exchange}
                onChange={(e) => handleExchangeChange(e.target.value as "" | "NSE" | "BSE")}
                className="w-full h-10 px-3 rounded-md text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              >
                <option value="">All exchanges</option>
                <option value="NSE">NSE only</option>
                <option value="BSE">BSE only</option>
              </select>
            </div>

            <Button
              onClick={() => doSearch(query, exchange)}
              disabled={!query.trim() || searching}
              loading={searching}
            >
              Search
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Results */}
      {searched && (
        <Card>
          <CardHeader className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>
              Results
              {results.length > 0 && (
                <span className="text-slate-500 text-sm font-normal ml-2">
                  {results.length} found
                  {saved.size > 0 && `, ${saved.size} already added`}
                </span>
              )}
            </CardTitle>

            {unsavedResults.length > 0 && (
              <div className="flex items-center gap-2">
                {selected.size > 0 ? (
                  <>
                    <button
                      onClick={clearSelection}
                      className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                      Clear ({selected.size})
                    </button>
                    <Button
                      size="sm"
                      onClick={handleSaveSelected}
                      loading={saveMutation.isPending}
                      disabled={saveMutation.isPending}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add {selected.size} selected
                    </Button>
                  </>
                ) : (
                  <button
                    onClick={selectAll}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    Select all
                  </button>
                )}
              </div>
            )}
          </CardHeader>

          <CardBody>
            {results.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">
                No NSE/BSE stocks found for "{query}". Try a different name or ticker.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 -mx-5">
                {results.map((stock) => {
                  const isSaved = saved.has(stock.symbol);
                  const isSelected = selected.has(stock.symbol);

                  return (
                    <div
                      key={stock.symbol}
                      className={classNames(
                        "flex items-center gap-3 px-5 py-3 transition-colors",
                        isSaved
                          ? "opacity-60"
                          : isSelected
                          ? "bg-brand-50 dark:bg-brand-900/20"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      )}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => !isSaved && toggleSelect(stock.symbol)}
                        disabled={isSaved}
                        className={classNames(
                          "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                          isSaved
                            ? "bg-green-500 border-green-500"
                            : isSelected
                            ? "bg-brand-600 border-brand-600"
                            : "border-slate-300 dark:border-slate-600 hover:border-brand-400"
                        )}
                      >
                        {(isSaved || isSelected) && <Check className="w-3 h-3 text-white" />}
                      </button>

                      {/* Stock info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{stock.name}</span>
                          <span className={classNames(
                            "text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-medium",
                            stock.exchange === "NSE"
                              ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                              : "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                          )}>
                            {stock.exchange}
                          </span>
                          {stock.capCategory && (
                            <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                              {stock.capCategory}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                          <span className="font-mono">{stock.symbol}</span>
                          {stock.sector && (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {stock.sector}
                            </span>
                          )}
                          {stock.industry && stock.industry !== stock.sector && (
                            <span className="hidden sm:inline truncate max-w-[200px]">{stock.industry}</span>
                          )}
                        </div>
                      </div>

                      {/* Action */}
                      <div className="shrink-0">
                        {isSaved ? (
                          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                            <Check className="w-3.5 h-3.5" /> Added
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleSaveOne(stock)}
                            loading={saveMutation.isPending && !saveMutation.variables?.find?.((s: any) => s.symbol === stock.symbol) === false}
                            disabled={saveMutation.isPending}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Info panel */}
      {!searched && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: <Search className="w-5 h-5 text-brand-500" />,
              title: "Search live",
              desc: "Results are fetched directly from Yahoo Finance — no static lists, always up to date.",
            },
            {
              icon: <Building2 className="w-5 h-5 text-brand-500" />,
              title: "NSE & BSE",
              desc: "Search across both National Stock Exchange and Bombay Stock Exchange listings.",
            },
            {
              icon: <TrendingUp className="w-5 h-5 text-brand-500" />,
              title: "Instantly trackable",
              desc: "Once added, stocks appear in the Screener, Watchlist, Portfolio, and Alerts.",
            },
          ].map((item) => (
            <Card key={item.title}>
              <CardBody className="pt-5">
                <div className="mb-2">{item.icon}</div>
                <div className="font-medium text-sm mb-1">{item.title}</div>
                <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
