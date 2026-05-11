import { useQuery } from "@tanstack/react-query";
import { marketApi } from "@/lib/api";
import { changeColor, classNames, formatPct } from "@/lib/format";

interface Index {
  symbol: string;
  displayName: string;
  price: number;
  change: number;
  changePct: number;
}

export default function IndicesBanner() {
  const { data } = useQuery({
    queryKey: ["indices"],
    queryFn: () => marketApi.getIndices(),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const indices = data ?? [];

  return (
    <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
      <div className="px-4 sm:px-6 py-2 flex items-center gap-6 min-w-max">
        {indices.length === 0 && <div className="text-xs text-slate-500">Loading indices…</div>}
        {indices.map((i) => (
          <div key={i.symbol} className="flex items-center gap-3 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">{i.displayName}</span>
            <span className="font-mono">{i.price?.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
            <span className={classNames("font-mono", changeColor(i.changePct))}>
              {formatPct(i.changePct)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
