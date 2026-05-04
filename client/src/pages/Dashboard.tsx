import { useQuery } from "@tanstack/react-query";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { changeColor, classNames, formatINR, formatPct } from "@/lib/format";
import { ArrowDownRight, ArrowUpRight, Briefcase, TrendingDown, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/store/auth";

interface PortfolioSummary {
  invested: number; currentValue: number; pnl: number; pnlPct: number; dayChange: number;
}
interface Holding {
  id: string; symbol: string; name: string; quantity: number; avgPrice: number;
  invested: number; ltp: number; currentValue: number; pnl: number; pnlPct: number;
}
interface MoverItem {
  symbol: string;
  name: string;
  changePct: number;
}
interface WatchlistItemData {
  id: string;
  stock?: { id: string; symbol: string; yahooSymbol: string; name: string } | null;
  mf?: { id: string; schemeCode: string; name: string } | null;
}
interface TransactionData {
  id: string;
  type: string;
  date: string;
  quantity: number;
  price: number;
  stock?: { symbol: string } | null;
  mf?: { name: string } | null;
}

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);

  const portfolio = useQuery({
    queryKey: ["portfolio"],
    queryFn: async () => {
      const { data } = await api.get("/portfolio");
      return data as { summary: PortfolioSummary; holdings: Holding[] };
    }
  });

  const movers = useQuery({
    queryKey: ["movers"],
    queryFn: async () => {
      const { data } = await api.get("/market/movers");
      return data as { gainers: MoverItem[]; losers: MoverItem[] };
    },
    refetchInterval: 60_000
  });

  const watchlists = useQuery({
    queryKey: ["watchlists"],
    queryFn: async () => {
      const { data } = await api.get("/watchlists");
      return (data as { watchlists: { id: string; name: string; items: WatchlistItemData[] }[] }).watchlists;
    }
  });

  const txs = useQuery({
    queryKey: ["recent-tx"],
    queryFn: async () => {
      const { data } = await api.get("/portfolio/transactions");
      return ((data as { transactions: TransactionData[] }).transactions ?? []).slice(0, 5);
    }
  });

  const summary = portfolio.data?.summary;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back, {user?.fullName?.split(" ")[0] ?? "Investor"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Here's how your portfolio is doing today.</p>
        </div>
        <Link to="/portfolio">
          <button className="text-sm text-brand-600 hover:underline flex items-center gap-1">
            View portfolio <ArrowUpRight className="w-4 h-4" />
          </button>
        </Link>
      </div>

      {portfolio.isError && (
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md px-4 py-3">
          Failed to load portfolio data. Please refresh the page.
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Invested"
          value={formatINR(summary?.invested, { compact: true })}
          icon={<Briefcase className="w-4 h-4" />}
        />
        <SummaryCard
          label="Current value"
          value={formatINR(summary?.currentValue, { compact: true })}
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <SummaryCard
          label="Overall P&L"
          value={formatINR(summary?.pnl, { compact: true })}
          sub={formatPct(summary?.pnlPct)}
          subClass={changeColor(summary?.pnl)}
        />
        <SummaryCard
          label="Today's change"
          value={formatINR(summary?.dayChange, { compact: true })}
          subClass={changeColor(summary?.dayChange)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Watchlist */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Watchlist</CardTitle>
            <Link to="/watchlist" className="text-xs text-brand-600 hover:underline">See all</Link>
          </CardHeader>
          <CardBody>
            {(watchlists.data?.[0]?.items ?? []).length === 0 ? (
              <div className="text-sm text-slate-500">No items yet — add stocks from the search bar.</div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {(watchlists.data?.[0]?.items ?? []).slice(0, 6).map((it) => (
                  <li key={it.id} className="py-2 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{it.stock?.name ?? it.mf?.name ?? "—"}</div>
                      <div className="text-xs text-slate-500">{it.stock?.symbol ?? it.mf?.schemeCode ?? ""}</div>
                    </div>
                    <Link
                      to={`/stocks/${it.stock?.yahooSymbol ?? it.stock?.symbol ?? ""}`}
                      className="text-brand-600 hover:underline text-xs"
                    >
                      View
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader><CardTitle>Recent transactions</CardTitle></CardHeader>
          <CardBody>
            {(txs.data ?? []).length === 0 ? (
              <div className="text-sm text-slate-500">No transactions yet.</div>
            ) : (
              <ul className="space-y-3">
                {txs.data!.map((t) => (
                  <li key={t.id} className="flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{t.stock?.symbol ?? t.mf?.name ?? "—"}</div>
                      <div className="text-xs text-slate-500">{new Date(t.date).toLocaleDateString("en-IN")} · {t.type}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono">{formatINR(t.quantity * t.price, { compact: true })}</div>
                      <div className="text-xs text-slate-500">qty {t.quantity}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Movers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MoversCard title="Top gainers" icon={<TrendingUp className="w-4 h-4 text-up" />} list={movers.data?.gainers ?? []} positive />
        <MoversCard title="Top losers"  icon={<TrendingDown className="w-4 h-4 text-down" />} list={movers.data?.losers ?? []} positive={false} />
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, subClass, icon }: { label: string; value: string; sub?: string; subClass?: string; icon?: React.ReactNode }) {
  return (
    <Card>
      <CardBody className="pt-5">
        <div className="flex items-center justify-between text-xs text-slate-500">
          {label}
          {icon}
        </div>
        <div className="mt-2 font-semibold text-2xl tracking-tight">{value}</div>
        {sub && <div className={classNames("mt-1 text-xs font-mono", subClass)}>{sub}</div>}
      </CardBody>
    </Card>
  );
}

function MoversCard({ title, icon, list, positive }: { title: string; icon: React.ReactNode; list: MoverItem[]; positive: boolean }) {
  return (
    <Card>
      <CardHeader className="flex items-center gap-2"><span>{icon}</span><CardTitle>{title}</CardTitle></CardHeader>
      <CardBody>
        {list.length === 0 ? (
          <div className="text-sm text-slate-500">No data available.</div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {list.slice(0, 6).map((q) => (
              <li key={q.symbol} className="py-2 flex items-center justify-between text-sm">
                <div className="min-w-0">
                  <div className="font-medium truncate">{q.name}</div>
                  <div className="text-xs text-slate-500">{q.symbol}</div>
                </div>
                <div className={classNames("font-mono text-sm flex items-center gap-1", positive ? "text-up" : "text-down")}>
                  {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {formatPct(q.changePct)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
