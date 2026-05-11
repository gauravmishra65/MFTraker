import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

import { api, portfolioApi, stocksApi } from "@/lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { changeColor, classNames, formatINR, formatPct } from "@/lib/format";
import { CircleAlert as AlertCircle, CircleCheck as CheckCircle2, Download, Plus, Upload, X } from "lucide-react";

const SECTOR_COLORS = ["#2f8df8", "#16a34a", "#f59e0b", "#dc2626", "#9333ea", "#0ea5e9", "#65a30d", "#475569", "#ec4899"];

interface Holding {
  id: string;
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
}

interface PortfolioSummary {
  invested: number;
  currentValue: number;
  pnl: number;
  pnlPct: number;
  dayChange: number;
}

interface PortfolioData {
  holdings: Holding[];
  summary: PortfolioSummary;
}

export default function Portfolio() {
  const qc = useQueryClient();
  const portfolio = useQuery({
    queryKey: ["portfolio"],
    queryFn: async () => (await api.get("/portfolio")).data as PortfolioData,
    refetchInterval: 15_000
  });

  const sectorData = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of portfolio.data?.holdings ?? []) {
      const key = h.sector ?? "Other";
      m.set(key, (m.get(key) ?? 0) + h.currentValue);
    }
    return [...m.entries()].map(([sector, value]) => ({ sector, value }));
  }, [portfolio.data]);

  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
          <p className="text-sm text-slate-500 mt-1">Holdings, allocation and live P&amp;L</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setShowImport(true)} variant="secondary"><Upload className="w-4 h-4" /> Import CSV</Button>
          <Button onClick={() => setShowAdd(true)} variant="primary"><Plus className="w-4 h-4" /> Add transaction</Button>
          <DownloadButton label="Export CSV" data={portfolio.data?.holdings ?? []} />
        </div>
      </div>

      {portfolio.isError && (
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md px-4 py-3">
          Failed to load portfolio. Please try again.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Invested"      value={formatINR(portfolio.data?.summary?.invested, { compact: true })} />
        <Stat label="Current value" value={formatINR(portfolio.data?.summary?.currentValue, { compact: true })} />
        <Stat label="P&L"           value={formatINR(portfolio.data?.summary?.pnl, { compact: true })} sub={formatPct(portfolio.data?.summary?.pnlPct)} subClass={changeColor(portfolio.data?.summary?.pnl)} />
        <Stat label="Day's change"  value={formatINR(portfolio.data?.summary?.dayChange, { compact: true })} subClass={changeColor(portfolio.data?.summary?.dayChange)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Holdings</CardTitle></CardHeader>
          <CardBody>
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="text-left px-5 py-2">Symbol</th>
                    <th className="text-right px-3 py-2">Qty</th>
                    <th className="text-right px-3 py-2">Avg</th>
                    <th className="text-right px-3 py-2">LTP</th>
                    <th className="text-right px-3 py-2">Invested</th>
                    <th className="text-right px-3 py-2">Value</th>
                    <th className="text-right px-5 py-2">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {(portfolio.data?.holdings ?? []).map((h) => (
                    <tr key={h.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-5 py-2">
                        <div className="font-medium">{h.symbol}</div>
                        <div className="text-xs text-slate-500 truncate max-w-xs">{h.name}</div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{h.quantity}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatINR(h.avgPrice)}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatINR(h.ltp)}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatINR(h.invested, { compact: true })}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatINR(h.currentValue, { compact: true })}</td>
                      <td className={classNames("px-5 py-2 text-right font-mono", changeColor(h.pnl))}>
                        {formatINR(h.pnl, { compact: true })}
                        <div className="text-xs">{formatPct(h.pnlPct)}</div>
                      </td>
                    </tr>
                  ))}
                  {!portfolio.data?.holdings?.length && (
                    <tr><td colSpan={7} className="px-5 py-6 text-center text-slate-500 text-sm">No holdings yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Sector allocation</CardTitle></CardHeader>
          <CardBody>
            <div className="h-72">
              {sectorData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-500">No data.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sectorData} dataKey="value" nameKey="sector" innerRadius={50} outerRadius={90} paddingAngle={2}>
                      {sectorData.map((_, i) => <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatINR(v, { compact: true })} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {showAdd && <AddTransactionModal onClose={() => setShowAdd(false)} onSuccess={() => {
        qc.invalidateQueries({ queryKey: ["portfolio"] });
        qc.invalidateQueries({ queryKey: ["recent-tx"] });
      }} />}

      {showImport && <ImportCsvModal onClose={() => setShowImport(false)} onSuccess={() => {
        qc.invalidateQueries({ queryKey: ["portfolio"] });
        qc.invalidateQueries({ queryKey: ["recent-tx"] });
      }} />}
    </div>
  );
}

function DownloadButton({ label, data }: { label: string; data: Holding[] }) {
  const [loading, setLoading] = useState(false);
  async function go() {
    setLoading(true);
    try {
      const header = "Symbol,Name,Type,Quantity,AvgPrice,Invested,LTP,CurrentValue,P&L,P&L %\n";
      const rows = data.map((h) =>
        [h.symbol, `"${(h.name ?? "").replace(/"/g, '""')}"`, h.instrumentType ?? "STOCK", h.quantity, h.avgPrice?.toFixed(2), h.invested?.toFixed(2), h.ltp?.toFixed(2), h.currentValue?.toFixed(2), h.pnl?.toFixed(2), h.pnlPct?.toFixed(2)].join(",")
      );
      const csv = header + rows.join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "portfolio.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message ?? "Download failed");
    } finally { setLoading(false); }
  }
  return (
    <Button variant="secondary" onClick={go} loading={loading}>
      <Download className="w-4 h-4" /> {label}
    </Button>
  );
}

function Stat({ label, value, sub, subClass }: { label: string; value: string; sub?: string; subClass?: string }) {
  return (
    <Card>
      <CardBody className="pt-5">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="mt-2 font-semibold text-2xl tracking-tight">{value}</div>
        {sub && <div className={classNames("mt-1 text-xs font-mono", subClass)}>{sub}</div>}
      </CardBody>
    </Card>
  );
}

const VALID_TX_TYPES = new Set(["BUY", "SELL", "SIP", "LUMPSUM", "REDEEM"]);

function AddTransactionModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    symbolQuery: "",
    stockId: "",
    type: "BUY" as string,
    date: new Date().toISOString().slice(0, 10),
    quantity: "",
    price: "",
    brokerage: "0"
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [results, setResults] = useState<any[]>([]);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.stockId) errs.symbol = "Pick a stock from the search results";
    if (!VALID_TX_TYPES.has(form.type)) errs.type = "Invalid transaction type";
    if (!form.date) errs.date = "Date is required";
    else if (new Date(form.date) > new Date()) errs.date = "Date cannot be in the future";
    const qty = Number(form.quantity);
    if (!form.quantity) errs.quantity = "Quantity is required";
    else if (!Number.isFinite(qty) || qty <= 0) errs.quantity = "Must be a positive number";
    else if (qty > 1e9) errs.quantity = "Quantity is too large";
    const price = Number(form.price);
    if (!form.price) errs.price = "Price is required";
    else if (!Number.isFinite(price) || price <= 0) errs.price = "Must be a positive number";
    else if (price > 1e9) errs.price = "Price is too large";
    const brokerage = Number(form.brokerage);
    if (!Number.isFinite(brokerage) || brokerage < 0) errs.brokerage = "Must be 0 or positive";
    else if (brokerage > 1e9) errs.brokerage = "Brokerage is too large";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const submit = useMutation({
    mutationFn: async () => {
      if (!validate()) throw new Error("Validation failed");
      await api.post("/portfolio/transactions", {
        stockId: form.stockId,
        type: form.type,
        date: new Date(form.date).toISOString(),
        quantity: Number(form.quantity),
        price: Number(form.price),
        brokerage: Number(form.brokerage)
      });
    },
    onSuccess: () => { toast.success("Transaction added"); onSuccess(); onClose(); },
    onError: (e: any) => {
      const msg = e?.message ?? "Failed to add transaction";
      if (msg !== "Validation failed") toast.error(msg);
    }
  });

  async function search(q: string) {
    setForm((f) => ({ ...f, symbolQuery: q, stockId: "" }));
    if (!q || q.length < 2) return setResults([]);
    try {
      const { data } = await api.get(`/stocks/search?q=${encodeURIComponent(q)}`);
      setResults((data.results ?? []).slice(0, 5));
    } catch {
      setResults([]);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-5">
        <h2 className="text-lg font-semibold">Add transaction</h2>
        <div className="mt-4 space-y-3">
          <div className="relative">
            <Input
              label="Stock"
              placeholder="Search by symbol or name..."
              value={form.symbolQuery}
              onChange={(e) => search(e.target.value)}
              error={errors.symbol}
            />
            {results.length > 0 && (
              <div className="absolute z-10 mt-1 left-0 right-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg max-h-48 overflow-y-auto">
                {results.map((r) => (
                  <button
                    key={r.id ?? r.symbol}
                    onClick={() => { setForm((f) => ({ ...f, stockId: r.id ?? "", symbolQuery: `${r.name} (${r.symbol})` })); setResults([]); setErrors((e) => { const { symbol, ...rest } = e; return rest; }); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {r.name} <span className="text-xs text-slate-500">({r.symbol})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Type</label>
              <select
                className="mt-1 w-full h-10 px-3 rounded-md text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                <option value="BUY">Buy</option>
                <option value="SELL">Sell</option>
                <option value="SIP">SIP</option>
                <option value="LUMPSUM">Lumpsum</option>
                <option value="REDEEM">Redeem</option>
              </select>
            </div>
            <Input label="Date" type="date" max={new Date().toISOString().slice(0, 10)} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} error={errors.date} />
            <Input label="Quantity" type="number" step="0.0001" min="0" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} error={errors.quantity} />
            <Input label="Price (per unit)" type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} error={errors.price} />
            <Input label="Brokerage" type="number" step="0.01" min="0" value={form.brokerage} onChange={(e) => setForm((f) => ({ ...f, brokerage: e.target.value }))} error={errors.brokerage} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => submit.mutate()} loading={submit.isPending}>Save</Button>
        </div>
      </div>
    </div>
  );
}

// ─── CSV Import ───────────────────────────────────────────────────────────────

// Expected CSV columns (case-insensitive, flexible naming)
const COL_ALIASES: Record<string, string[]> = {
  symbol:    ["symbol", "ticker", "scrip", "stock", "nse", "bse"],
  type:      ["type", "transaction", "action", "tx_type", "txtype"],
  date:      ["date", "trade_date", "tradedate", "purchase_date"],
  quantity:  ["quantity", "qty", "units", "shares"],
  price:     ["price", "rate", "buy_price", "purchase_price", "avg_price", "nav"],
  brokerage: ["brokerage", "commission", "charges", "fee", "fees"],
};

type CsvCol = keyof typeof COL_ALIASES;

interface ParsedRow {
  _line: number;
  symbol: string;
  type: string;
  date: string;
  quantity: number;
  price: number;
  brokerage: number;
  error?: string;
}

function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_\-]/g, "");
}

function detectColumn(header: string): CsvCol | null {
  const norm = normaliseHeader(header);
  for (const [col, aliases] of Object.entries(COL_ALIASES)) {
    if (aliases.some((a) => normaliseHeader(a) === norm)) return col as CsvCol;
  }
  return null;
}

function parseDate(raw: string): string | null {
  const s = raw.trim();
  // Formats: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, MM/DD/YYYY
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return s;
  const dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const [, a, b, y] = dmyMatch;
    // Prefer DD/MM/YYYY interpretation for Indian market context
    const d = parseInt(a, 10), m = parseInt(b, 10);
    if (m > 12) return `${y}-${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}`;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  // Try native Date parse as last resort
  const ts = Date.parse(s);
  if (!isNaN(ts)) return new Date(ts).toISOString().slice(0, 10);
  return null;
}

function normaliseType(raw: string): string {
  const u = raw.trim().toUpperCase();
  if (["BUY", "B", "PURCHASE"].includes(u)) return "BUY";
  if (["SELL", "S", "SALE"].includes(u)) return "SELL";
  if (["SIP"].includes(u)) return "SIP";
  if (["LUMPSUM", "LUMP", "INVEST"].includes(u)) return "LUMPSUM";
  if (["REDEEM", "REDEMPTION", "RED"].includes(u)) return "REDEEM";
  return u;
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().split("\n");
  const parse = (line: string): string[] => {
    const out: string[] = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else {
        if (ch === '"') inQ = true;
        else if (ch === ",") { out.push(cur); cur = ""; }
        else cur += ch;
      }
    }
    out.push(cur);
    return out.map((c) => c.trim());
  };
  const headers = parse(lines[0]);
  const rows = lines.slice(1).filter((l) => l.trim()).map(parse);
  return { headers, rows };
}

type ImportStep = "upload" | "map" | "preview" | "importing" | "done";

interface ImportState {
  step: ImportStep;
  headers: string[];
  rawRows: string[][];
  mapping: Partial<Record<CsvCol, number>>;
  parsed: ParsedRow[];
  results: { ok: number; failed: number; errors: string[] };
}

function ImportCsvModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ImportState>({
    step: "upload",
    headers: [],
    rawRows: [],
    mapping: {},
    parsed: [],
    results: { ok: 0, failed: 0, errors: [] },
  });

  // ── Step 1: file drop / select ────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      toast.error("Please upload a .csv file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const { headers, rows } = parseCsv(text);
        if (!headers.length || !rows.length) {
          toast.error("CSV appears empty");
          return;
        }
        // Auto-detect column mapping
        const mapping: Partial<Record<CsvCol, number>> = {};
        headers.forEach((h, i) => {
          const col = detectColumn(h);
          if (col && !(col in mapping)) mapping[col] = i;
        });
        setState((s) => ({ ...s, step: "map", headers, rawRows: rows, mapping }));
      } catch {
        toast.error("Failed to parse CSV");
      }
    };
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ── Step 2: column mapping → parse ───────────────────────────────────────
  function buildParsed(): ParsedRow[] {
    const { rawRows, mapping } = state;
    const get = (row: string[], col: CsvCol) =>
      mapping[col] !== undefined ? (row[mapping[col]!] ?? "").trim() : "";

    return rawRows.map((row, i) => {
      const symbol   = get(row, "symbol").toUpperCase().replace(/[^A-Z0-9\-&.]/g, "");
      const rawType  = get(row, "type");
      const rawDate  = get(row, "date");
      const rawQty   = get(row, "quantity");
      const rawPrice = get(row, "price");
      const rawBrok  = get(row, "brokerage");

      const type     = normaliseType(rawType || "BUY");
      const date     = parseDate(rawDate) ?? "";
      const quantity = parseFloat(rawQty);
      const price    = parseFloat(rawPrice);
      const brokerage = parseFloat(rawBrok || "0") || 0;

      const errors: string[] = [];
      if (!symbol)                        errors.push("symbol missing");
      if (!["BUY","SELL","SIP","LUMPSUM","REDEEM"].includes(type)) errors.push(`unknown type "${rawType}"`);
      if (!date)                          errors.push("invalid date");
      else if (new Date(date) > new Date()) errors.push("date in future");
      if (!isFinite(quantity) || quantity <= 0) errors.push("invalid quantity");
      if (!isFinite(price)    || price    <= 0) errors.push("invalid price");
      if (!isFinite(brokerage)|| brokerage < 0) errors.push("invalid brokerage");

      return { _line: i + 2, symbol, type, date, quantity, price, brokerage, error: errors.join("; ") || undefined };
    });
  }

  function goToPreview() {
    const required: CsvCol[] = ["symbol", "quantity", "price"];
    const missing = required.filter((c) => state.mapping[c] === undefined);
    if (missing.length) { toast.error(`Map required columns: ${missing.join(", ")}`); return; }
    const parsed = buildParsed();
    setState((s) => ({ ...s, step: "preview", parsed }));
  }

  // ── Step 3: import ────────────────────────────────────────────────────────
  const [progress, setProgress] = useState(0);

  async function runImport() {
    setState((s) => ({ ...s, step: "importing" }));
    const valid = state.parsed.filter((r) => !r.error);
    const errors: string[] = state.parsed.filter((r) => r.error).map((r) => `Row ${r._line}: ${r.error}`);

    let ok = 0;
    for (let i = 0; i < valid.length; i++) {
      const row = valid[i];
      try {
        // Resolve symbol → stockId
        const stocks = await stocksApi.search(row.symbol);
        const match = stocks.find((s: any) => s.symbol === row.symbol || s.symbol === row.symbol.replace(".NS","").replace(".BO",""));
        if (!match) { errors.push(`Row ${row._line}: stock "${row.symbol}" not found in database`); continue; }

        await portfolioApi.addTransaction({
          stockId: match.id,
          type: row.type,
          date: new Date(row.date).toISOString(),
          quantity: row.quantity,
          price: row.price,
          brokerage: row.brokerage,
        });
        ok++;
      } catch (e: any) {
        errors.push(`Row ${row._line} (${row.symbol}): ${e?.message ?? "failed"}`);
      }
      setProgress(Math.round(((i + 1) / valid.length) * 100));
    }

    setState((s) => ({ ...s, step: "done", results: { ok, failed: errors.length, errors } }));
    if (ok > 0) onSuccess();
  }

  const validCount   = state.parsed.filter((r) => !r.error).length;
  const invalidCount = state.parsed.filter((r) =>  r.error).length;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <h2 className="text-lg font-semibold">Import portfolio from CSV</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {state.step === "upload" && "Upload a CSV file with your transaction history"}
              {state.step === "map"    && "Confirm which columns map to each field"}
              {state.step === "preview" && `${validCount} valid rows ready to import${invalidCount ? `, ${invalidCount} will be skipped` : ""}`}
              {state.step === "importing" && "Importing transactions…"}
              {state.step === "done" && `Done — ${state.results.ok} imported, ${state.results.failed} skipped`}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* ── Upload ── */}
          {state.step === "upload" && (
            <div className="space-y-4">
              <div
                onDrop={onDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-10 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 dark:hover:bg-brand-900/10 transition-colors"
              >
                <Upload className="w-8 h-8 mx-auto text-slate-400 mb-3" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Drop your CSV here or click to browse</p>
                <p className="text-xs text-slate-400 mt-1">Supports any CSV with columns for symbol, type, date, quantity, price</p>
                <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </div>

              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Expected CSV format</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono text-slate-600 dark:text-slate-400">
                    <thead>
                      <tr className="text-slate-500">
                        {["Symbol","Type","Date","Quantity","Price","Brokerage"].map((h) => (
                          <th key={h} className="text-left px-2 py-1 bg-slate-100 dark:bg-slate-800">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["RELIANCE","BUY","2024-01-15","10","2450.50","20"],
                        ["TCS","BUY","2024-02-01","5","3800.00","15"],
                        ["INFY","SELL","2024-03-10","3","1750.00","12"],
                      ].map((row, i) => (
                        <tr key={i}>
                          {row.map((cell, j) => <td key={j} className="px-2 py-1">{cell}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-400 mt-2">Dates: YYYY-MM-DD or DD/MM/YYYY. Type: BUY, SELL, SIP, LUMPSUM, REDEEM. Brokerage is optional.</p>
              </div>
            </div>
          )}

          {/* ── Column mapping ── */}
          {state.step === "map" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">Detected {state.headers.length} columns, {state.rawRows.length} data rows. Confirm the mapping below.</p>
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(COL_ALIASES) as CsvCol[]).map((col) => (
                  <div key={col}>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">
                      {col}
                      {["symbol","quantity","price"].includes(col) && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <select
                      className="mt-1 w-full h-9 px-3 rounded-md text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-brand-500"
                      value={state.mapping[col] ?? ""}
                      onChange={(e) => setState((s) => ({
                        ...s,
                        mapping: { ...s.mapping, [col]: e.target.value === "" ? undefined : Number(e.target.value) }
                      }))}
                    >
                      <option value="">— not mapped —</option>
                      {state.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Preview ── */}
          {state.step === "preview" && (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-3 py-2">Row</th>
                      <th className="text-left px-3 py-2">Symbol</th>
                      <th className="text-left px-3 py-2">Type</th>
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-right px-3 py-2">Qty</th>
                      <th className="text-right px-3 py-2">Price</th>
                      <th className="text-right px-3 py-2">Brok.</th>
                      <th className="text-left px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.parsed.map((r) => (
                      <tr key={r._line} className={classNames(
                        "border-t border-slate-100 dark:border-slate-800",
                        r.error ? "bg-red-50/50 dark:bg-red-900/10" : ""
                      )}>
                        <td className="px-3 py-1.5 text-slate-400">{r._line}</td>
                        <td className="px-3 py-1.5 font-medium font-mono">{r.symbol || "—"}</td>
                        <td className="px-3 py-1.5">{r.type}</td>
                        <td className="px-3 py-1.5">{r.date || "—"}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{isFinite(r.quantity) ? r.quantity : "—"}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{isFinite(r.price) ? r.price.toFixed(2) : "—"}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{r.brokerage.toFixed(2)}</td>
                        <td className="px-3 py-1.5">
                          {r.error
                            ? <span className="flex items-center gap-1 text-red-600 dark:text-red-400"><AlertCircle className="w-3 h-3 shrink-0" />{r.error}</span>
                            : <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><CheckCircle2 className="w-3 h-3" />OK</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {invalidCount > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {invalidCount} row{invalidCount !== 1 ? "s" : ""} have errors and will be skipped. Fix the CSV and re-upload to include them.
                </p>
              )}
              {validCount === 0 && (
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">No valid rows to import. Please fix the errors above.</p>
              )}
            </div>
          )}

          {/* ── Importing ── */}
          {state.step === "importing" && (
            <div className="py-10 text-center space-y-4">
              <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-slate-600 dark:text-slate-300">Importing transactions… {progress}%</p>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div className="bg-brand-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* ── Done ── */}
          {state.step === "done" && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 text-center">
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">{state.results.ok}</div>
                  <div className="text-sm text-green-700 dark:text-green-300 mt-1">Imported</div>
                </div>
                {state.results.failed > 0 && (
                  <div className="flex-1 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-center">
                    <div className="text-3xl font-bold text-red-600 dark:text-red-400">{state.results.failed}</div>
                    <div className="text-sm text-red-700 dark:text-red-300 mt-1">Skipped</div>
                  </div>
                )}
              </div>
              {state.results.errors.length > 0 && (
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3 max-h-48 overflow-y-auto">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Skipped rows</p>
                  {state.results.errors.map((e, i) => (
                    <p key={i} className="text-xs text-red-600 dark:text-red-400 font-mono">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-5 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0 gap-2">
          <div className="text-xs text-slate-400">
            {state.step === "map"     && `${state.rawRows.length} rows detected`}
            {state.step === "preview" && `${validCount} of ${state.parsed.length} rows will be imported`}
          </div>
          <div className="flex gap-2">
            {state.step === "done" ? (
              <Button onClick={onClose}>Close</Button>
            ) : state.step === "importing" ? null : (
              <>
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                {state.step === "map"     && <Button onClick={goToPreview}>Preview</Button>}
                {state.step === "preview" && <Button onClick={runImport} disabled={validCount === 0}>Import {validCount} rows</Button>}
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
