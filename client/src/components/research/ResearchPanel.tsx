import { useQuery } from "@tanstack/react-query";
import { researchApi, ResearchResult } from "@/lib/api";
import { changeColor, classNames, formatINR, formatPct } from "@/lib/format";
import { TriangleAlert as AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  type: "stock" | "mf";
  id: string;
  name: string;
}

// ── Rec badge ─────────────────────────────────────────────────────────────────

const REC_CONFIG: Record<string, { label: string; cls: string }> = {
  "strong_buy":  { label: "Strong Buy",  cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  "buy":         { label: "Buy",         cls: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  "hold":        { label: "Hold",        cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  "underperform":{ label: "Underperform",cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  "sell":        { label: "Sell",        cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
};

function RecBadge({ rec }: { rec: string | null }) {
  if (!rec) return null;
  const cfg = REC_CONFIG[rec.toLowerCase()] ?? { label: rec, cls: "bg-slate-100 text-slate-700" };
  return <span className={classNames("text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide", cfg.cls)}>{cfg.label}</span>;
}

// ── Section shell ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">{title}</h3>
      {children}
    </div>
  );
}

// ── Metric row ────────────────────────────────────────────────────────────────

function MetricRow({ label, value, cls }: { label: string; value: React.ReactNode; cls?: string }) {
  return (
    <div className="flex justify-between items-baseline py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={classNames("text-sm font-medium font-mono", cls ?? "")}>{value ?? "—"}</span>
    </div>
  );
}

// ── CAGR pill ─────────────────────────────────────────────────────────────────

function CagrPill({ label, value }: { label: string; value: number | null | undefined }) {
  const isNull = value == null;
  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      <div className={classNames(
        "w-full text-center rounded-lg py-2.5 font-semibold text-sm font-mono",
        isNull ? "bg-slate-100 dark:bg-slate-800 text-slate-400"
          : value >= 0 ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
          : "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
      )}>
        {isNull ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`}
      </div>
      <span className="text-[11px] text-slate-400">{label}</span>
    </div>
  );
}

// ── Projection table ──────────────────────────────────────────────────────────

function ProjectionTable({ projections, currentPrice }: { projections: ResearchResult["projections"]; currentPrice: number }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-slate-400">
            <th className="text-left px-2 py-1.5">Horizon</th>
            <th className="text-right px-2 py-1.5 text-red-500">Bear</th>
            <th className="text-right px-2 py-1.5 text-slate-500">Base</th>
            <th className="text-right px-2 py-1.5 text-emerald-600">Bull</th>
          </tr>
        </thead>
        <tbody>
          {projections.map((p) => {
            const basePct = currentPrice > 0 ? ((p.base - currentPrice) / currentPrice) * 100 : 0;
            const bearPct = currentPrice > 0 ? ((p.bear - currentPrice) / currentPrice) * 100 : 0;
            const bullPct = currentPrice > 0 ? ((p.bull - currentPrice) / currentPrice) * 100 : 0;
            return (
              <tr key={p.years} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-2 py-2 font-medium">{p.years}Y</td>
                <td className="px-2 py-2 text-right font-mono">
                  <div className="text-red-600 dark:text-red-400">{formatINR(p.bear)}</div>
                  <div className="text-[11px] text-red-400">{bearPct >= 0 ? "+" : ""}{bearPct.toFixed(1)}%</div>
                </td>
                <td className="px-2 py-2 text-right font-mono">
                  <div className="text-slate-700 dark:text-slate-200">{formatINR(p.base)}</div>
                  <div className="text-[11px] text-slate-400">{basePct >= 0 ? "+" : ""}{basePct.toFixed(1)}%</div>
                </td>
                <td className="px-2 py-2 text-right font-mono">
                  <div className="text-emerald-600 dark:text-emerald-400">{formatINR(p.bull)}</div>
                  <div className="text-[11px] text-emerald-400">{bullPct >= 0 ? "+" : ""}{bullPct.toFixed(1)}%</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Analyst bar (buy/hold/sell vote counts) ───────────────────────────────────

function AnalystBar({ analyst }: { analyst: Record<string, any> }) {
  const sb = analyst.strongBuy  ?? 0;
  const b  = analyst.buy        ?? 0;
  const h  = analyst.hold       ?? 0;
  const s  = analyst.sell       ?? 0;
  const ss = analyst.strongSell ?? 0;
  const total = sb + b + h + s + ss;
  if (total === 0) return null;
  const pct = (n: number) => Math.round((n / total) * 100);
  const segs = [
    { label: "Strong Buy",  count: sb, pct: pct(sb), color: "bg-emerald-500" },
    { label: "Buy",         count: b,  pct: pct(b),  color: "bg-green-400" },
    { label: "Hold",        count: h,  pct: pct(h),  color: "bg-amber-400" },
    { label: "Sell",        count: s,  pct: pct(s),  color: "bg-orange-400" },
    { label: "Strong Sell", count: ss, pct: pct(ss), color: "bg-red-500" },
  ].filter((seg) => seg.count > 0);

  return (
    <div className="space-y-2">
      <div className="flex rounded-full overflow-hidden h-2.5 gap-px">
        {segs.map((seg) => (
          <div key={seg.label} className={classNames(seg.color, "h-full")} style={{ width: `${seg.pct}%` }} title={`${seg.label}: ${seg.count}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {segs.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={classNames("w-2 h-2 rounded-full", seg.color)} />
            {seg.label} <span className="font-medium text-slate-700 dark:text-slate-300">{seg.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function ResearchPanel({ type, id, name }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["research", type, id],
    queryFn: () => researchApi.get(type, id),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Loading research data…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-500">
        <AlertTriangle className="w-8 h-8 text-amber-400" />
        <p className="text-sm">Could not load research data. Please try again.</p>
      </div>
    );
  }

  const { fundamentals, analyst, history, projections, currentPrice } = data;
  const upsideIcon = analyst?.upsidePct != null
    ? (analyst.upsidePct as number) > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />
    : <Minus className="w-3 h-3" />;

  return (
    <div className="space-y-6">
      {/* Disclaimer — always first and prominent */}
      <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-4 py-3">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
          <span className="font-semibold">Not a forecast.</span> Projections are mechanical extrapolations of historical CAGR ± 1σ volatility. Past performance does not guarantee future results. This is for informational purposes only and does not constitute investment advice.
        </p>
      </div>

      {/* Analyst consensus — stocks only */}
      {type === "stock" && analyst && (
        <Section title="Analyst consensus">
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <RecBadge rec={analyst.recommendationKey as string | null} />
              {analyst.numberOfAnalysts != null && (
                <span className="text-xs text-slate-400">{analyst.numberOfAnalysts as number} analysts</span>
              )}
              {analyst.upsidePct != null && (
                <span className={classNames("flex items-center gap-1 text-xs font-medium", changeColor(analyst.upsidePct as number))}>
                  {upsideIcon} {(analyst.upsidePct as number) >= 0 ? "+" : ""}{(analyst.upsidePct as number).toFixed(1)}% upside
                </span>
              )}
            </div>

            <AnalystBar analyst={analyst} />

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-center">
                <div className="text-[11px] text-slate-400 mb-0.5">Low target</div>
                <div className="font-mono text-sm font-semibold text-red-600 dark:text-red-400">{analyst.targetLow != null ? formatINR(analyst.targetLow as number) : "—"}</div>
              </div>
              <div className="rounded-lg bg-brand-50 dark:bg-brand-900/30 px-3 py-2 text-center border border-brand-200 dark:border-brand-800">
                <div className="text-[11px] text-slate-400 mb-0.5">Mean target</div>
                <div className="font-mono text-sm font-semibold text-brand-700 dark:text-brand-300">{analyst.targetMean != null ? formatINR(analyst.targetMean as number) : "—"}</div>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-center">
                <div className="text-[11px] text-slate-400 mb-0.5">High target</div>
                <div className="font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400">{analyst.targetHigh != null ? formatINR(analyst.targetHigh as number) : "—"}</div>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* Fundamentals */}
      <Section title="Fundamentals">
        {type === "stock" ? (
          <div className="space-y-0">
            <MetricRow label="P/E (trailing)" value={fundamentals.pe != null ? (fundamentals.pe as number).toFixed(1) : "—"} />
            <MetricRow label="P/B" value={fundamentals.pb != null ? (fundamentals.pb as number).toFixed(2) : "—"} />
            <MetricRow label="ROE" value={fundamentals.roe != null ? `${(fundamentals.roe as number).toFixed(1)}%` : "—"} cls={fundamentals.roe != null ? changeColor(fundamentals.roe as number) : ""} />
            <MetricRow label="Dividend yield" value={fundamentals.dividendYieldPct != null ? `${(fundamentals.dividendYieldPct as number).toFixed(2)}%` : "—"} />
            <MetricRow label="Market cap" value={fundamentals.marketCap != null ? formatINR(fundamentals.marketCap as number, { compact: true }) : "—"} />
            <MetricRow label="52W High" value={fundamentals.fiftyTwoWeekHigh != null ? formatINR(fundamentals.fiftyTwoWeekHigh as number) : "—"} />
            <MetricRow label="52W Low"  value={fundamentals.fiftyTwoWeekLow  != null ? formatINR(fundamentals.fiftyTwoWeekLow  as number) : "—"} />
            <MetricRow label="Annual volatility" value={history.volatilityAnnualPct != null ? `${history.volatilityAnnualPct.toFixed(1)}%` : "—"} />
            <MetricRow label="Max drawdown (5Y)" value={history.maxDrawdownPct != null ? `-${history.maxDrawdownPct.toFixed(1)}%` : "—"} cls="text-red-500" />
          </div>
        ) : (
          <div className="space-y-0">
            <MetricRow label="Category" value={fundamentals.category as string | null} />
            <MetricRow label="Sub-category" value={fundamentals.subCategory as string | null} />
            <MetricRow label="Current NAV" value={fundamentals.currentNav != null ? formatINR(fundamentals.currentNav as number) : "—"} />
            <MetricRow label="Avg cost NAV" value={fundamentals.avgCostNav != null ? formatINR(fundamentals.avgCostNav as number) : "—"} />
            <MetricRow label="Units held" value={fundamentals.units != null ? String(fundamentals.units) : "—"} />
            <MetricRow label="Invested" value={fundamentals.invested != null ? formatINR(fundamentals.invested as number, { compact: true }) : "—"} />
            <MetricRow label="Current value" value={fundamentals.currentValue != null ? formatINR(fundamentals.currentValue as number, { compact: true }) : "—"} />
            <MetricRow label="P&L" value={fundamentals.pnl != null ? formatINR(fundamentals.pnl as number, { compact: true }) : "—"} cls={fundamentals.pnl != null ? changeColor(fundamentals.pnl as number) : ""} />
            <MetricRow label="Holding period" value={fundamentals.holdingYears != null ? `${fundamentals.holdingYears}Y` : "—"} />
          </div>
        )}
      </Section>

      {/* Trailing CAGR */}
      <Section title="Trailing CAGR">
        <div className="flex gap-3">
          <CagrPill label="1 Year"  value={history.cagr1Y} />
          <CagrPill label="3 Years" value={history.cagr3Y} />
          <CagrPill label="5 Years" value={history.cagr5Y} />
          {type === "mf" && history.holdingCagrPct != null && (
            <CagrPill label="Holding CAGR" value={history.holdingCagrPct} />
          )}
        </div>
      </Section>

      {/* Projections */}
      <Section title="Scenario projections (per unit)">
        <ProjectionTable projections={projections} currentPrice={currentPrice} />
        <p className="text-[11px] text-slate-400 mt-2">
          {type === "stock"
            ? "Base = trailing 5Y CAGR. Bear = Base − 1σ (annual vol). Bull = Base + 1σ. Capped at −50%/yr bear."
            : "Base = historical NAV CAGR. Bear/Bull = ±4% band. MF projections use NAV, not portfolio value."}
        </p>
      </Section>
    </div>
  );
}
