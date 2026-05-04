import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { api } from "@/lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { changeColor, classNames, formatINR, formatPct } from "@/lib/format";

const SECTORS = ["Energy", "IT", "Financials", "FMCG", "Telecom", "Construction", "Auto", "Consumer", "Pharma", "Cement", "Diversified"];

export default function Screener() {
  const [filters, setFilters] = useState({ sector: "", capCategory: "", minPrice: "", maxPrice: "", page: 1, pageSize: 25 });

  const { data, isLoading } = useQuery({
    queryKey: ["screener", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.sector)      params.set("sector", filters.sector);
      if (filters.capCategory) params.set("capCategory", filters.capCategory);
      if (filters.minPrice)    params.set("minPrice", filters.minPrice);
      if (filters.maxPrice)    params.set("maxPrice", filters.maxPrice);
      params.set("page", String(filters.page));
      params.set("pageSize", String(filters.pageSize));
      const { data } = await api.get(`/stocks/screener?${params}`);
      return data as { results: any[]; total: number };
    }
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Stock screener</h1>

      <Card>
        <CardBody className="pt-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-sm">Sector</label>
              <select
                className="mt-1 w-full h-10 px-3 rounded-md text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                value={filters.sector}
                onChange={(e) => setFilters({ ...filters, sector: e.target.value, page: 1 })}
              >
                <option value="">All</option>
                {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm">Market cap</label>
              <select
                className="mt-1 w-full h-10 px-3 rounded-md text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                value={filters.capCategory}
                onChange={(e) => setFilters({ ...filters, capCategory: e.target.value, page: 1 })}
              >
                <option value="">Any</option>
                <option value="LARGE">Large cap</option>
                <option value="MID">Mid cap</option>
                <option value="SMALL">Small cap</option>
              </select>
            </div>
            <Input label="Min price (₹)" type="number" value={filters.minPrice} onChange={(e) => setFilters({ ...filters, minPrice: e.target.value, page: 1 })} />
            <Input label="Max price (₹)" type="number" value={filters.maxPrice} onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value, page: 1 })} />
          </div>
        </CardBody>
      </Card>

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
                {(data?.results ?? []).map((r: any) => (
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
