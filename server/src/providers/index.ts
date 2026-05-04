import { env } from "../config/env";
import { IMarketDataProvider } from "./IMarketDataProvider";
import { YahooProvider } from "./YahooProvider";

let provider: IMarketDataProvider;

export function getMarketProvider(): IMarketDataProvider {
  if (!provider) {
    switch (env.MARKET_PROVIDER) {
      case "yahoo":
      default:
        provider = new YahooProvider();
        break;
      // Hooks for additional providers — add concrete classes when keys are configured.
      // case "alphavantage": provider = new AlphaVantageProvider(env.ALPHA_VANTAGE_KEY!); break;
      // case "twelvedata":   provider = new TwelveDataProvider(env.TWELVE_DATA_KEY!); break;
    }
  }
  return provider;
}
