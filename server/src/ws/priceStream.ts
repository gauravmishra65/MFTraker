import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { verifyToken } from "../utils/jwt";
import { getMarketProvider } from "../providers";
import { isMarketOpen } from "../services/marketStatus";
import { logger } from "../utils/logger";

interface ClientState {
  ws: WebSocket;
  userId: string;
  symbols: Set<string>;
}

/**
 * Price stream WebSocket. Clients connect to /ws?token=...
 * Send: {"type":"subscribe","symbols":["RELIANCE.NS"]} or {"type":"unsubscribe",...}
 * Receive: {"type":"tick","symbol":"...","price":...,"changePct":...,"updatedAt":...}
 *
 * Implementation: keep a map of subscriptions, poll the provider every 5s while
 * the market is open (15s when closed). For production, swap polling for a true
 * WS upstream (Twelve Data, Fyers, Kite).
 */
export function attachPriceStream(server: Server) {
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set<ClientState>();

  server.on("upgrade", (req, socket, head) => {
    if (!req.url?.startsWith("/ws")) return socket.destroy();
    const url = new URL(req.url, "http://localhost");
    const token = url.searchParams.get("token");
    if (!token) return socket.destroy();
    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      return socket.destroy();
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const state: ClientState = { ws, userId: payload!.userId, symbols: new Set() };
      clients.add(state);
      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(String(raw));
          if (msg.type === "subscribe" && Array.isArray(msg.symbols)) {
            msg.symbols.forEach((s: string) => state.symbols.add(s));
          }
          if (msg.type === "unsubscribe" && Array.isArray(msg.symbols)) {
            msg.symbols.forEach((s: string) => state.symbols.delete(s));
          }
        } catch {
          /* ignore bad frames */
        }
      });
      ws.on("close", () => clients.delete(state));
      ws.send(JSON.stringify({ type: "hello", userId: state.userId }));
    });
  });

  // Aggregate distinct symbols and broadcast.
  setInterval(async () => {
    if (clients.size === 0) return;
    const all = new Set<string>();
    for (const c of clients) c.symbols.forEach((s) => all.add(s));
    if (!all.size) return;
    try {
      const quotes = await getMarketProvider().getQuotes([...all]);
      const byClient = new Map<ClientState, typeof quotes>();
      for (const c of clients) {
        const subset = quotes.filter((q) => c.symbols.has(q.symbol));
        if (subset.length) byClient.set(c, subset);
      }
      for (const [c, qs] of byClient) {
        if (c.ws.readyState !== c.ws.OPEN) continue;
        for (const q of qs) {
          c.ws.send(
            JSON.stringify({
              type: "tick",
              symbol: q.symbol,
              price: q.price,
              change: q.change,
              changePct: q.changePct,
              updatedAt: q.updatedAt
            })
          );
        }
      }
    } catch (err) {
      logger.warn({ err }, "price stream tick failed");
    }
  }, isMarketOpen() ? 5000 : 15000);

  logger.info("WebSocket price stream attached at /ws");
}
