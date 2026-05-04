import yahooFinance from "yahoo-finance2";
import {
  Candle,
  IMarketDataProvider,
  IndexQuote,
  Interval,
  Quote,
  Range,
  SearchResult
} from "./IMarketDataProvider";
import { cached } from "../config/redis";
import { logger } from "../utils/logger";

// yahoo-finance2 prints a survey notice on startup; suppress it.
yahooFinance.suppressNotices(["yahooSurvey"]);

const NSE_INDICES: { yahoo: string; display: string }[] = [
  { yahoo: "^NSEI", display: "NIFTY 50" },
  { yahoo: "^BSESN", display: "SENSEX" },
  { yahoo: "^NSEBANK", display: "BANK NIFTY" },
  { yahoo: "^CNXIT", display: "NIFTY IT" }
];

/** Map our shorthand range/interval to yahoo's chart() input. */
function rangeToChartArgs(range: Range, interval: Interval) {
  // Yahoo uses period1/period2 timestamps; we'll compute period1.
  const now = new Date();
  const periodStart = new Date();
  switch (range) {
    case "1d":  periodStart.setDate(now.getDate() - 1); break;
    case "5d":  periodStart.setDate(now.getDate() - 7); break;
    case "1mo": periodStart.setMonth(now.getMonth() - 1); break;
    case "3mo": periodStart.setMonth(now.getMonth() - 3); break;
    case "6mo": periodStart.setMonth(now.getMonth() - 6); break;
    case "1y":  periodStart.setFullYear(now.getFullYear() - 1); break;
    case "5y":  periodStart.setFullYear(now.getFullYear() - 5); break;
    case "max": periodStart.setFullYear(now.getFullYear() - 25); break;
  }
  return { period1: periodStart, period2: now, interval };
}

function toQuote(q: any): Quote {
  return {
    symbol: q.symbol,
    name: q.shortName ?? q.longName ?? q.symbol,
    price: q.regularMarketPrice ?? 0,
    change: q.regularMarketChange ?? 0,
    changePct: q.regularMarketChangePercent ?? 0,
    open: q.regularMarketOpen,
    high: q.regularMarketDayHigh,
    low: q.regularMarketDayLow,
    previousClose: q.regularMarketPreviousClose,
    volume: q.regularMarketVolume,
    marketCap: q.marketCap,
    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: q.fiftyTwoWeekLow,
    currency: q.currency,
    exchange: q.fullExchangeName ?? q.exchange,
    updatedAt: Date.now()
  };
}

export class YahooProvider implements IMarketDataProvider {
  name = "yahoo";

  async search(query: string): Promise<SearchResult[]> {
    return cached(`yahoo:search:${query.toLowerCase()}`, 600, async () => {
      try {
        const res: any = await yahooFinance.search(query, { quotesCount: 15, newsCount: 0 });
        return (res.quotes ?? [])
          .filter((q: any) => q.symbol)
          .map((q: any) => ({
            symbol: q.symbol,
            name: q.shortname ?? q.longname ?? q.symbol,
            exchange: q.exchDisp,
            type: q.quoteType
          }));
      } catch (err) {
        logger.warn({ err, query }, "Yahoo search failed");
        return [];
      }
    });
  }

  async getQuote(symbol: string): Promise<Quote> {
    return cached(`yahoo:q:${symbol}`, 5, async () => {
      const q: any = await yahooFinance.quote(symbol);
      return toQuote(q);
    });
  }

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    if (!symbols.length) return [];
    return cached(`yahoo:qs:${symbols.sort().join(",")}`, 5, async () => {
      const list: any = await yahooFinance.quote(symbols);
      const arr = Array.isArray(list) ? list : [list];
      return arr.map(toQuote);
    });
  }

  async getHistory(symbol: string, range: Range, interval: Interval): Promise<Candle[]> {
    return cached(`yahoo:h:${symbol}:${range}:${interval}`, 60, async () => {
      const args = rangeToChartArgs(range, interval);
      const res: any = await yahooFinance.chart(symbol, args);
      const quotes: any[] = res.quotes ?? [];
      return quotes
        .filter((q) => q.close != null)
        .map((q) => ({
          t: Math.floor(new Date(q.date).getTime() / 1000),
          o: q.open ?? q.close,
          h: q.high ?? q.close,
          l: q.low ?? q.close,
          c: q.close,
          v: q.volume ?? 0
        }));
    });
  }

  async getIndices(): Promise<IndexQuote[]> {
    return cached("yahoo:indices", 5, async () => {
      const symbols = NSE_INDICES.map((i) => i.yahoo);
      const list: any = await yahooFinance.quote(symbols);
      const arr = Array.isArray(list) ? list : [list];
      return arr.map((q: any) => {
        const meta = NSE_INDICES.find((i) => i.yahoo === q.symbol);
        return { ...toQuote(q), displayName: meta?.display ?? q.symbol };
      });
    });
  }

  async getMovers(): Promise<{ gainers: Quote[]; losers: Quote[] }> {
    return cached("yahoo:movers", 60, async () => {
      try {
        // Yahoo screener IDs change occasionally; these work for India.
        const [gainers, losers] = await Promise.all([
          yahooFinance.screener({ scrIds: "day_gainers", count: 10, region: "IN" } as any).catch(() => ({ quotes: [] }) as any),
          yahooFinance.screener({ scrIds: "day_losers", count: 10, region: "IN" } as any).catch(() => ({ quotes: [] }) as any)
        ]);
        return {
          gainers: ((gainers as any).quotes ?? []).map(toQuote),
          losers: ((losers as any).quotes ?? []).map(toQuote)
        };
      } catch (err) {
        logger.warn({ err }, "movers fetch failed");
        return { gainers: [], losers: [] };
      }
    });
  }
}
