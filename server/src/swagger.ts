/**
 * Minimal OpenAPI doc — covers the public surface area. Expand per route as
 * the contract stabilizes.
 */
export const openapi = {
  openapi: "3.0.0",
  info: { title: "MF & Share Tracker API", version: "1.0.0" },
  servers: [{ url: "/api" }],
  components: {
    securitySchemes: { bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" } }
  },
  security: [{ bearer: [] }],
  paths: {
    "/health": { get: { summary: "Health check", responses: { 200: { description: "ok" } }, security: [] } },
    "/auth/register": { post: { summary: "Register a new user", security: [], responses: { 201: { description: "created" } } } },
    "/auth/login": { post: { summary: "Login (rate limited)", security: [], responses: { 200: { description: "ok" } } } },
    "/auth/google": { post: { summary: "Login with Google ID token", security: [] } },
    "/auth/forgot-password": { post: { summary: "Send password reset OTP", security: [] } },
    "/auth/reset-password": { post: { summary: "Reset password with OTP", security: [] } },
    "/stocks/search": { get: { summary: "Search stocks (DB + Yahoo)" } },
    "/stocks/quote/{symbol}": { get: { summary: "Get live quote" } },
    "/stocks/history/{symbol}": { get: { summary: "OHLCV history" } },
    "/stocks/screener": { get: { summary: "Filtered stock list" } },
    "/mf/search": { get: { summary: "Search mutual funds" } },
    "/mf/{id}": { get: { summary: "Mutual fund detail" } },
    "/mf/calc/sip": { get: { summary: "SIP future-value calculator" } },
    "/portfolio": { get: { summary: "Holdings + summary with live P&L" } },
    "/portfolio/transactions": {
      get: { summary: "List transactions" },
      post: { summary: "Add a transaction" }
    },
    "/portfolio/export.csv": { get: { summary: "CSV export of holdings" } },
    "/watchlists": { get: { summary: "List watchlists" }, post: { summary: "Create a watchlist" } },
    "/watchlists/items": { post: { summary: "Add stock or MF to a watchlist" } },
    "/watchlists/live": { get: { summary: "Watchlist with live quotes" } },
    "/alerts": { get: { summary: "List alerts" }, post: { summary: "Create alert" } },
    "/market/indices": { get: { summary: "NIFTY 50, SENSEX, BANK NIFTY, NIFTY IT" } },
    "/market/movers": { get: { summary: "Top gainers and losers" } },
    "/market/status": { get: { summary: "Is market open?", security: [] } }
  }
};
