import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { api } from "@/lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { changeColor, classNames, formatINR, formatPct } from "@/lib/format";

const SECTORS = ["Energy", "IT", "Financials", "FMCG", "Telecom", "Construction", "Auto", "Consumer", "Pharma", "Cement", "Diversified"];

interface ScreenerResult {
  id: string;
  symbol: string;
  yahooSymbol: string;
  name: string;
  sector: string | null;
  capCategory: string | null;
  exchange: string;
  quote?: { price: number; changePct: number } | null;
}

export default function Screener() {
  const [filters, setFilters] = useState({ sector: "", capCategory: "", minPrice: "", maxPrice: "", page: 1, pageSize: 25 });
  const [priceError, setPriceError] = useState("");

  function updateFilters(patch: Partial<typeof filters>) {
    setFilters((f) => {
      const next = { ...f, ...patch, page: patch.page ?? 1 };
      // Validate price range
      const min = Number(next.minPrice);
      const max = Number(next.maxPrice);
      if (next.minPrice && next.maxPrice && Number.isFinite(min) && Number.isFinite(max) && min > max) {
        setPriceError("Min price cannot exceed max price");
      } else if (next.minPrice && Number(min) < 0) {
        setPriceError("Min price cannot be negative");
      } else if (next.maxPrice && Number(max) < 0) {
        setPriceError("Max price cannot be negative");
      } else {
        setPriceError("");
      }
      return next;
    });
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ["screener", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.sector)      params.set("sector", filters.sector);
      if (filters.capCategory) params.set("capCategory", filters.capCategory);
      if (filters.minPrice)    params.set("minPrice", filters.minPrice);
      if (filters.maxPrice)    params.set("maxPrice", filters.maxPrice);
      params.set("page", String(filters.page));
      params.set("pageSize", String(filters.pageSize));
      const res = await api.get(`/stocks/screener?${params}`);
      return res.data as { results: ScreenerResult[]; total: number };
    },
    enabled: !priceError
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Stock screener</h1>

      <Card>
        <CardBody className="pt-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Sector</label>
              <select
                className="mt-1 w-full h-10 px-3 rounded-md text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                value={filters.sector}
                onChange={(e) => updateFilters({ sector: e.target.value })}
              >
                <option value="">All</option>
                {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Market cap</label>
              <select
                className="mt-1 w-full h-10 px-3 rounded-md text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                value={filters.capCategory}
                onChange={(e) => updateFilters({ capCategory: e.target.value })}
              >
                <option value="">Any</option>
                <option value="LARGE">Large cap</option>
                <option value="MID">Mid cap</option>
                <option value="SMALL">Small cap</option>
              </select>
            </div>
            <Input label="Min price" type="number" min="0" step="0.01" value={filters.minPrice} onChange={(e) => updateFilters({ minPrice: e.target.value })} error={priceError && filters.minPrice ? priceError : undefined} />
            <Input label="Max price" type="number" min="0" step="0.01" value={filters.maxPrice} onChange={(e) => updateFilters({ maxPrice: e.target.value })} error={priceError && filters.maxPrice ? priceError : undefined} />
          </div>
        </CardBody>
      </Card>

      {isError && (
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md px-4 py-3">
          Failed to load stocks. Please try again.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Results {data ? <span className="text-slate-500 text-sm font-normal">({data.results.length} of {data.total})</span> : null}</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-left px-5 py-2">Stock</th>
                  <th className="text-left px-3 py-2">Sector</th>
                  <th className="text-right px-3 py-2">Price</th>
                  <th className="text-right px-3 py-2">Change</th>
                  <th className="text-right px-5 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {(data?.results ?? []).map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-5 py-2">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-slate-500">{r.symbol} · {r.capCategory ?? "—"}</div>
                    </td>
                    <td className="px-3 py-2">{r.sector ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.quote ? formatINR(r.quote.price) : "—"}</td>
                    <td className={classNames("px-3 py-2 text-right font-mono", changeColor(r.quote?.changePct))}>
                      {r.quote ? formatPct(r.quote.changePct) : "—"}
                    </td>
                    <td className="px-5 py-2 text-right">
                      <Link to={`/stocks/${r.yahooSymbol}`} className="text-brand-600 hover:underline text-xs">View</Link>
                    </td>
                  </tr>
                ))}
                {!isLoading && (data?.results ?? []).length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-6 text-center text-slate-500 text-sm">No stocks match your filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
