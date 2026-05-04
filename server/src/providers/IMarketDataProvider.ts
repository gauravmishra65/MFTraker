/** Generic market-data provider interface. Implementations: Yahoo, Alpha Vantage, Twelve Data. */

export interface Quote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  volume?: number;
  marketCap?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  currency?: string;
  exchange?: string;
  updatedAt: number; // unix ms
}

export interface Candle {
  t: number;          // unix seconds
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange?: string;
  type?: string;
}

export type Range = "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y" | "5y" | "max";
export type Interval = "1m" | "5m" | "15m" | "30m" | "1h" | "1d" | "1wk" | "1mo";

export interface IndexQuote extends Quote {
  /** Display name like "NIFTY 50" */
  displayName: string;
}

export interface IMarketDataProvider {
  name: string;
  search(query: string): Promise<SearchResult[]>;
  getQuote(symbol: string): Promise<Quote>;
  getQuotes(symbols: string[]): Promise<Quote[]>;
  getHistory(symbol: string, range: Range, interval: Interval): Promise<Candle[]>;
  getIndices(): Promise<IndexQuote[]>;
  getMovers(): Promise<{ gainers: Quote[]; losers: Quote[] }>;
}
