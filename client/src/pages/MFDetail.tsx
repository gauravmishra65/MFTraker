import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { api } from "@/lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { formatINR } from "@/lib/format";

const COLORS = ["#2f8df8", "#16a34a", "#f59e0b", "#dc2626", "#9333ea", "#0ea5e9", "#65a30d"];

export default function MFDetail() {
  const { id = "" } = useParams();

  const detail = useQuery({
    queryKey: ["mf", id],
    queryFn: async () => (await api.get(`/mf/${id}`)).data
  });

  const f = detail.data?.fund;
  const returns = detail.data?.returns ?? {};
  const sectors = detail.data?.sectors ?? [];
  const holdings = detail.data?.holdings ?? [];

  const returnRows = ["1M", "3M", "6M", "1Y", "3Y", "5Y", "SI"].map((p) => ({ period: p, value: returns[p] ?? 0 }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{f?.name ?? "Loading…"}</h1>
        <p className="text-sm text-slate-500 mt-1">{f?.amc} · {f?.category}{f?.subCategory ? ` · ${f?.subCategory}` : ""}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="AUM" value={f?.aum ? `₹${f.aum} Cr` : "—"} />
        <Stat label="Expense ratio" value={f?.expenseRatio != null ? `${f.expenseRatio}%` : "—"} />
        <Stat label="Min SIP" value={f?.minSip ? formatINR(f.minSip) : "—"} />
        <Stat label="Risk level" value={f?.riskLevel ?? "—"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Returns</CardTitle></CardHeader>
          <CardBody>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={returnRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.25)" />
                  <XAxis dataKey="period" stroke="rgba(100,116,139,.7)" fontSize={11} />
                  <YAxis stroke="rgba(100,116,139,.7)" fontSize={11} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", color: "#e2e8f0", fontSize: 12 }} />
                  <Bar dataKey="value" fill="#2f8df8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>SIP calculator</CardTitle></CardHeader>
          <CardBody><SipCalc /></CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Sector allocation</CardTitle></CardHeader>
          <CardBody>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sectors} dataKey="weight" nameKey="sector" innerRadius={45} outerRadius={90} paddingAngle={2}>
                    {sectors.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top 10 holdings</CardTitle></CardHeader>
          <CardBody>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {holdings.map((h: any) => (
                <li key={h.name} className="py-2 flex items-center justify-between text-sm">
                  <span>{h.name}</span>
                  <span className="font-mono text-slate-500">{h.weight.toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardBody className="pt-5">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="mt-2 font-semibold text-xl tracking-tight">{value}</div>
      </CardBody>
    </Card>
  );
}

function SipCalc() {
  const [monthly, setMonthly] = useState(5000);
  const [years, setYears] = useState(10);
  const [rate, setRate] = useState(12);
  const { data } = useQuery({
    queryKey: ["sip", monthly, years, rate],
    queryFn: async () => (await api.get(`/mf/calc/sip?monthly=${monthly}&years=${years}&rate=${rate}`)).data,
    enabled: monthly > 0 && years > 0
  });
  return (
    <div className="space-y-3">
      <Input label="Monthly (₹)" type="number" value={monthly} onChange={(e) => setMonthly(Number(e.target.value))} />
      <Input label="Years" type="number" value={years} onChange={(e) => setYears(Number(e.target.value))} />
      <Input label="Expected return (%)" type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))} />
      <div className="rounded-md bg-slate-50 dark:bg-slate-800 p-3 text-sm space-y-1">
        <div className="flex justify-between"><span>Invested</span><span className="font-mono">{formatINR(data?.invested)}</span></div>
        <div className="flex justify-between"><span>Future value</span><span className="font-mono">{formatINR(data?.futureValue)}</span></div>
        <div className="flex justify-between text-up"><span>Estimated gains</span><span className="font-mono">{formatINR(data?.gains)}</span></div>
      </div>
    </div>
  );
}
