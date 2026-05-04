import { prisma } from "../config/db";
import { TxType } from "@prisma/client";
import { getMarketProvider } from "../providers";

interface ComputedHolding {
  instrumentType: "STOCK" | "MF";
  instrumentId: string;
  symbol: string;
  yahooSymbol?: string;
  name: string;
  quantity: number;
  invested: number;
  avgPrice: number;
}

const BUY_TYPES: TxType[] = ["BUY", "SIP", "LUMPSUM"];
const SELL_TYPES: TxType[] = ["SELL", "REDEEM"];

/**
 * Recompute holdings from the user's transaction list using weighted-average cost.
 * Persists into PortfolioHolding so reads are O(1).
 */
export async function recomputeHoldings(userId: string) {
  const txs = await prisma.portfolioTransaction.findMany({
    where: { userId },
    orderBy: { date: "asc" },
    include: { stock: true, mf: true }
  });

  // accumulator keyed by `${type}:${id}`
  const acc = new Map<string, ComputedHolding>();

  for (const t of txs) {
    const isStock = !!t.stockId;
    const id = (t.stockId ?? t.mfId)!;
    const key = `${isStock ? "STOCK" : "MF"}:${id}`;
    const sym = isStock ? t.stock?.symbol ?? "" : t.mf?.schemeCode ?? "";
    const ySym = isStock ? t.stock?.yahooSymbol : undefined;
    const name = isStock ? t.stock?.name ?? "" : t.mf?.name ?? "";

    const existing = acc.get(key) ?? {
      instrumentType: isStock ? "STOCK" : "MF",
      instrumentId: id,
      symbol: sym,
      yahooSymbol: ySym,
      name,
      quantity: 0,
      invested: 0,
      avgPrice: 0
    };

    if (BUY_TYPES.includes(t.type)) {
      const cost = t.quantity * t.price + t.brokerage;
      existing.quantity += t.quantity;
      existing.invested += cost;
      existing.avgPrice = existing.quantity > 0 ? existing.invested / existing.quantity : 0;
    } else if (SELL_TYPES.includes(t.type)) {
      // FIFO/avg-cost: reduce quantity & invested proportionally.
      const sellQty = Math.min(t.quantity, existing.quantity);
      const fraction = existing.quantity ? sellQty / existing.quantity : 0;
      existing.invested -= existing.invested * fraction;
      existing.quantity -= sellQty;
      // avg price stays the same when selling using avg-cost method
    }

    acc.set(key, existing);
  }

  const rows = [...acc.values()].filter((h) => h.quantity > 1e-9);

  // Wipe & rewrite in a transaction.
  await prisma.$transaction([
    prisma.portfolioHolding.deleteMany({ where: { userId } }),
    ...rows.map((h) =>
      prisma.portfolioHolding.create({
        data: {
          userId,
          instrumentType: h.instrumentType,
          instrumentId: h.instrumentId,
          symbol: h.symbol,
          name: h.name,
          quantity: h.quantity,
          avgPrice: h.avgPrice,
          invested: h.invested
        }
      })
    )
  ]);

  return rows;
}

/** Return holdings enriched with current market price + P&L. */
export async function getEnrichedPortfolio(userId: string) {
  const holdings = await prisma.portfolioHolding.findMany({ where: { userId } });
  const stockSymbols = await prisma.stock.findMany({
    where: { id: { in: holdings.filter((h) => h.instrumentType === "STOCK").map((h) => h.instrumentId) } },
    select: { id: true, yahooSymbol: true, sector: true }
  });
  const mp = getMarketProvider();
  const yahooMap = new Map(stockSymbols.map((s) => [s.id, s.yahooSymbol]));
  const sectorMap = new Map(stockSymbols.map((s) => [s.id, s.sector]));
  const symbolsToFetch = [...yahooMap.values()].filter(Boolean) as string[];

  let quotes: Record<string, number> = {};
  let dayChanges: Record<string, number> = {};
  if (symbolsToFetch.length) {
    try {
      const fetched = await mp.getQuotes(symbolsToFetch);
      for (const q of fetched) {
        quotes[q.symbol] = q.price;
        dayChanges[q.symbol] = q.change;
      }
    } catch {
      /* swallow — we'll just return zeros */
    }
  }

  const enriched = holdings.map((h) => {
    const ySym = yahooMap.get(h.instrumentId);
    const ltp = ySym ? quotes[ySym] ?? h.avgPrice : h.avgPrice;
    const dayCh = ySym ? dayChanges[ySym] ?? 0 : 0;
    const currentValue = h.quantity * ltp;
    const pnl = currentValue - h.invested;
    const pnlPct = h.invested ? (pnl / h.invested) * 100 : 0;
    return {
      ...h,
      sector: sectorMap.get(h.instrumentId) ?? null,
      ltp,
      currentValue,
      pnl,
      pnlPct,
      dayChange: dayCh * h.quantity
    };
  });

  const summary = enriched.reduce(
    (s, h) => {
      s.invested += h.invested;
      s.currentValue += h.currentValue;
      s.dayChange += h.dayChange;
      return s;
    },
    { invested: 0, currentValue: 0, dayChange: 0 }
  );
  const pnl = summary.currentValue - summary.invested;
  const pnlPct = summary.invested ? (pnl / summary.invested) * 100 : 0;

  return { holdings: enriched, summary: { ...summary, pnl, pnlPct } };
}
