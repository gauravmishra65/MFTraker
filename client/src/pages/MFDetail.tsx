import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { api } from "@/lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { formatINR } from "@/lib/format";

interface FundData {
  id: string;
  name: string;
  amc: string;
  category: string;
  sub_category: string | null;
  risk_level: string | null;
  expense_ratio: number | null;
  aum: number | null;
  min_sip: number | null;
  min_lumpsum: number | null;
  benchmark: string | null;
  fund_manager: string | null;
  inception_date: string | null;
  nav: number | null;
  scheme_code: string | null;
}

interface NavPoint {
  date: string;
  nav: number;
}

interface SipResult {
  invested: number;
  futureValue: number;
  gains: number;
}

export default function MFDetail() {
  const { id = "" } = useParams();

  const detail = useQuery({
    queryKey: ["mf", id],
    queryFn: async () => (await api.get(`/mf/${id}`)).data as {
      fund: FundData;
      returns: Record<string, number | null>;
      navChart: NavPoint[];
      holdings: never[];
      sectors: never[];
    }
  });

  const f = detail.data?.fund;
  const returns = detail.data?.returns ?? {};
  const navChart = detail.data?.navChart ?? [];

  const returnRows = ["1M", "3M", "6M", "1Y", "3Y", "5Y", "SI"]
    .map((p) => ({ period: p, value: returns[p] ?? null }))
    .filter((r) => r.value != null) as { period: string; value: number }[];

  const hasReturns = returnRows.length > 0;
  const hasNavChart = navChart.length > 1;

  return (
    <div className="space-y-6">
      {detail.isError && (
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md px-4 py-3">
          Failed to load fund details. Please try again.
        </div>
      )}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{f?.name ?? "Loading..."}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {f?.amc} · {f?.category}{f?.sub_category ? ` · ${f.sub_category}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Stat label="NAV (latest)" value={f?.nav != null ? formatINR(f.nav) : "—"} highlight />
        <Stat label="AUM" value={f?.aum ? `₹${(f.aum / 100).toFixed(0)} Cr` : "—"} />
        <Stat label="Expense ratio" value={f?.expense_ratio != null ? `${f.expense_ratio}%` : "—"} />
        <Stat label="Min SIP" value={f?.min_sip ? formatINR(f.min_sip) : "—"} />
        <Stat label="Risk level" value={f?.risk_level ?? "—"} />
      </div>

      {f?.benchmark && (
        <p className="text-xs text-slate-400">
          Benchmark: {f.benchmark}{f.fund_manager ? ` · Fund manager: ${f.fund_manager}` : ""}
          {f.inception_date ? ` · Inception: ${new Date(f.inception_date).toLocaleDateString("en-IN", { year: "numeric", month: "short" })}` : ""}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Returns bar chart — real data from MFAPI */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Returns</CardTitle>
            <span className="text-[10px] text-slate-400 ml-2">
              {hasReturns ? "Source: MFAPI.in (live NAV)" : "Not available"}
            </span>
          </CardHeader>
          <CardBody>
            {detail.isLoading ? (
              <div className="h-64 flex items-center justify-center text-sm text-slate-400 animate-pulse">Loading...</div>
            ) : hasReturns ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={returnRows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.25)" />
                    <XAxis dataKey="period" stroke="rgba(100,116,139,.7)" fontSize={11} />
                    <YAxis stroke="rgba(100,116,139,.7)" fontSize={11} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                    <Tooltip
                      formatter={(v: number) => [`${v.toFixed(2)}%`, "Return"]}
                      contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", color: "#e2e8f0", fontSize: 12 }}
                    />
                    <Bar
                      dataKey="value"
                      radius={[4, 4, 0, 0]}
                      fill="#2f8df8"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-sm text-slate-400">
                Returns data unavailable. Ensure this fund has a valid scheme code and is seeded.
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>SIP calculator</CardTitle></CardHeader>
          <CardBody><SipCalc /></CardBody>
        </Card>
      </div>

      {/* NAV history chart */}
      {(hasNavChart || detail.isLoading) && (
        <Card>
          <CardHeader>
            <CardTitle>NAV history (1 year)</CardTitle>
            <span className="text-[10px] text-slate-400 ml-2">Source: MFAPI.in</span>
          </CardHeader>
          <CardBody>
            {detail.isLoading ? (
              <div className="h-48 flex items-center justify-center text-sm text-slate-400 animate-pulse">Loading...</div>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={navChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.15)" />
                    <XAxis
                      dataKey="date"
                      stroke="rgba(100,116,139,.7)"
                      fontSize={10}
                      tickFormatter={(d) => {
                        const dt = new Date(d);
                        return `${dt.toLocaleString("en-IN", { month: "short" })} '${String(dt.getFullYear()).slice(2)}`;
                      }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      stroke="rgba(100,116,139,.7)"
                      fontSize={10}
                      domain={["auto", "auto"]}
                      tickFormatter={(v) => `₹${v.toFixed(0)}`}
                      width={55}
                    />
                    <Tooltip
                      formatter={(v: number) => [formatINR(v), "NAV"]}
                      labelFormatter={(d) => new Date(d).toLocaleDateString("en-IN")}
                      contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", color: "#e2e8f0", fontSize: 12 }}
                    />
                    <Line type="monotone" dataKey="nav" stroke="#2f8df8" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Additional fund info */}
      {(f?.min_lumpsum || f?.scheme_code) && (
        <Card>
          <CardHeader><CardTitle>Fund details</CardTitle></CardHeader>
          <CardBody className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            {f?.min_lumpsum && (
              <div>
                <div className="text-xs text-slate-500">Min lumpsum</div>
                <div className="font-mono mt-1">{formatINR(f.min_lumpsum)}</div>
              </div>
            )}
            {f?.scheme_code && (
              <div>
                <div className="text-xs text-slate-500">Scheme code</div>
                <div className="font-mono mt-1">{f.scheme_code}</div>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card>
      <CardBody className="pt-5">
        <div className="text-xs text-slate-500">{label}</div>
        <div className={`mt-2 font-semibold text-xl tracking-tight ${highlight ? "text-brand-600 dark:text-brand-400" : ""}`}>
          {value}
        </div>
      </CardBody>
    </Card>
  );
}

function SipCalc() {
  const [monthly, setMonthly] = useState(5000);
  const [years, setYears] = useState(10);
  const [rate, setRate] = useState(12);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validateAndSet(field: string, value: number, min: number, max: number, label: string) {
    const errs = { ...errors };
    if (!Number.isFinite(value) || value < min) errs[field] = `${label} must be at least ${min}`;
    else if (value > max) errs[field] = `${label} must be at most ${max.toLocaleString()}`;
    else delete errs[field];
    setErrors(errs);
  }

  const { data } = useQuery({
    queryKey: ["sip", monthly, years, rate],
    queryFn: async () => {
      const res = await api.get(`/mf/calc/sip?monthly=${monthly}&years=${years}&rate=${rate}`);
      return res.data as SipResult;
    },
    enabled: monthly > 0 && years > 0 && rate >= 0 && Object.keys(errors).length === 0
  });

  return (
    <div className="space-y-3">
      <Input
        label="Monthly amount"
        type="number"
        min="100"
        max="10000000"
        value={monthly}
        onChange={(e) => { const v = Number(e.target.value); setMonthly(v); validateAndSet("monthly", v, 100, 1e7, "Amount"); }}
        error={errors.monthly}
      />
      <Input
        label="Years"
        type="number"
        min="1"
        max="50"
        value={years}
        onChange={(e) => { const v = Number(e.target.value); setYears(v); validateAndSet("years", v, 1, 50, "Years"); }}
        error={errors.years}
      />
      <Input
        label="Expected return (%)"
        type="number"
        min="0"
        max="50"
        step="0.1"
        value={rate}
        onChange={(e) => { const v = Number(e.target.value); setRate(v); validateAndSet("rate", v, 0, 50, "Rate"); }}
        error={errors.rate}
      />
      <div className="rounded-md bg-slate-50 dark:bg-slate-800 p-3 text-sm space-y-1">
        <div className="flex justify-between"><span>Invested</span><span className="font-mono">{formatINR(data?.invested)}</span></div>
        <div className="flex justify-between"><span>Future value</span><span className="font-mono">{formatINR(data?.futureValue)}</span></div>
        <div className="flex justify-between text-up"><span>Estimated gains</span><span className="font-mono">{formatINR(data?.gains)}</span></div>
      </div>
    </div>
  );
}
