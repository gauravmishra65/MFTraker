import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

export default function MFCompare() {
  const [q, setQ] = useState("");
  const search = useQuery({
    queryKey: ["mf-search", q],
    queryFn: async () => (await api.get(`/mf/search?q=${encodeURIComponent(q)}`)).data.results as any[],
    enabled: q.length > 1
  });
  const [picked, setPicked] = useState<any[]>([]);
  function toggle(f: any) {
    setPicked((p) => p.find((x) => x.id === f.id) ? p.filter((x) => x.id !== f.id) : (p.length < 3 ? [...p, f] : p));
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Compare mutual funds</h1>
      <Card>
        <CardHeader><CardTitle>Pick up to 3 funds</CardTitle></CardHeader>
        <CardBody>
          <Input placeholder="Search funds…" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="mt-3 max-h-64 overflow-auto divide-y divide-slate-100 dark:divide-slate-800">
            {(search.data ?? []).map((f) => (
              <li key={f.id}>
                <button onClick={() => toggle(f)} className="w-full text-left py-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 px-2 rounded">
                  <div>
                    <div className="text-sm font-medium">{f.name}</div>
                    <div className="text-xs text-slate-500">{f.amc} · {f.category}</div>
                  </div>
                  <span className="text-xs">{picked.find((x) => x.id === f.id) ? "Selected" : "Add"}</span>
                </button>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {picked.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Comparison</CardTitle></CardHeader>
          <CardBody>
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="text-left px-5 py-2">Field</th>
                    {picked.map((f) => <th key={f.id} className="text-left px-3 py-2">{f.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["AMC", "amc"],
                    ["Category", "category"],
                    ["Risk level", "riskLevel"],
                    ["Expense ratio", "expenseRatio"],
                    ["AUM (Cr)", "aum"],
                    ["Min SIP", "minSip"],
                    ["Min lumpsum", "minLumpsum"],
                    ["Fund manager", "fundManager"]
                  ].map(([label, key]) => (
                    <tr key={key} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-5 py-2 font-medium">{label}</td>
                      {picked.map((f) => <td key={f.id} className="px-3 py-2">{(f as any)[key as string] ?? "—"}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
