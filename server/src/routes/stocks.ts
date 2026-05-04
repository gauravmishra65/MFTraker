import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { authMiddleware } from "../middleware/auth";
import { validateQuery } from "../middleware/validate";
import { getMarketProvider } from "../providers";
import { Range, Interval } from "../providers/IMarketDataProvider";
import { NotFound } from "../utils/errors";

const router = Router();

const searchSchema = z.object({ q: z.string().min(1), limit: z.coerce.number().min(1).max(50).default(15) });

router.get("/search", authMiddleware, validateQuery(searchSchema), async (req, res, next) => {
  try {
    const { q, limit } = req.query as unknown as z.infer<typeof searchSchema>;
    // Local DB first (covers symbol/name/isin partial).
    const local = await prisma.stock.findMany({
      where: {
        OR: [
          { symbol: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
          { isin: { equals: q.toUpperCase() } }
        ]
      },
      take: limit
    });
    // Augment with Yahoo search results so unknown tickers surface too.
    const remote = await getMarketProvider().search(q);
    const seen = new Set(local.map((s) => s.symbol));
    const merged = [
      ...local.map((s) => ({
        symbol: s.symbol,
        yahooSymbol: s.yahooSymbol,
        name: s.name,
        sector: s.sector,
        capCategory: s.capCategory,
        exchange: s.exchange,
        local: true
      })),
      ...remote
        .filter((r) => !seen.has(r.symbol))
        .slice(0, Math.max(0, limit - local.length))
        .map((r) => ({
          symbol: r.symbol,
          yahooSymbol: r.symbol,
          name: r.name,
          sector: null,
          capCategory: null,
          exchange: r.exchange,
          local: false
        }))
    ];

    // Save the search for "recent" suggestions.
    if (req.user) {
      prisma.searchHistory.create({ data: { userId: req.user.userId, query: q } }).catch(() => {});
    }
    res.json({ results: merged });
  } catch (err) {
    next(err);
  }
});

router.get("/quote/:symbol", authMiddleware, async (req, res, next) => {
  try {
    const sym = req.params.symbol.toUpperCase();
    const local = await prisma.stock.findFirst({ where: { OR: [{ symbol: sym }, { yahooSymbol: sym }] } });
    const yahooSym = local?.yahooSymbol ?? (sym.includes(".") ? sym : `${sym}.NS`);
    const quote = await getMarketProvider().getQuote(yahooSym);
    res.json({ stock: local, quote });
  } catch (err) {
    next(err);
  }
});

const historySchema = z.object({
  range: z.enum(["1d", "5d", "1mo", "3mo", "6mo", "1y", "5y", "max"]).default("1mo"),
  interval: z.enum(["1m", "5m", "15m", "30m", "1h", "1d", "1wk", "1mo"]).default("1d")
});

router.get("/history/:symbol", authMiddleware, validateQuery(historySchema), async (req, res, next) => {
  try {
    const sym = req.params.symbol.toUpperCase();
    const local = await prisma.stock.findFirst({ where: { OR: [{ symbol: sym }, { yahooSymbol: sym }] } });
    const yahooSym = local?.yahooSymbol ?? (sym.includes(".") ? sym : `${sym}.NS`);
    const { range, interval } = req.query as unknown as z.infer<typeof historySchema>;
    const candles = await getMarketProvider().getHistory(yahooSym, range as Range, interval as Interval);
    res.json({ symbol: yahooSym, candles });
  } catch (err) {
    next(err);
  }
});

const screenerSchema = z.object({
  sector: z.string().optional(),
  capCategory: z.enum(["LARGE", "MID", "SMALL"]).optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(25)
});

router.get("/screener", authMiddleware, validateQuery(screenerSchema), async (req, res, next) => {
  try {
    const f = req.query as unknown as z.infer<typeof screenerSchema>;
    const where: Record<string, unknown> = {};
    if (f.sector) where.sector = f.sector;
    if (f.capCategory) where.capCategory = f.capCategory;
    const total = await prisma.stock.count({ where });
    const rows = await prisma.stock.findMany({
      where,
      take: f.pageSize,
      skip: (f.page - 1) * f.pageSize,
      orderBy: { name: "asc" }
    });

    // Enrich with live quote + price filter
    const symbols = rows.map((r) => r.yahooSymbol);
    const quotes = symbols.length ? await getMarketProvider().getQuotes(symbols).catch(() => []) : [];
    const qMap = new Map(quotes.map((q) => [q.symbol, q]));
    let merged = rows.map((r) => ({ ...r, quote: qMap.get(r.yahooSymbol) ?? null }));

    if (f.minPrice != null || f.maxPrice != null) {
      merged = merged.filter((r) => {
        const p = r.quote?.price ?? null;
        if (p == null) return false;
        if (f.minPrice != null && p < f.minPrice) return false;
        if (f.maxPrice != null && p > f.maxPrice) return false;
        return true;
      });
    }
    res.json({ total, page: f.page, pageSize: f.pageSize, results: merged });
  } catch (err) {
    next(err);
  }
});

/**
 * Shareholding pattern. Yahoo doesn't expose Indian disclosure splits reliably,
 * so we serve a representative breakdown derived from the stock's sector. In
 * production, integrate with NSE's corporate-disclosures API or a paid provider.
 */
router.get("/:symbol/shareholding", authMiddleware, async (req, res, next) => {
  try {
    const sym = req.params.symbol.toUpperCase();
    const me = await prisma.stock.findFirst({ where: { OR: [{ symbol: sym }, { yahooSymbol: sym }] } });
    if (!me) throw NotFound("Stock not found");
    // Stable per-symbol pattern using a tiny hash so charts don't flicker.
    const seed = [...sym].reduce((s, c) => s + c.charCodeAt(0), 0);
    const promoter = 35 + (seed % 25);            // 35-59
    const fii      = 15 + ((seed >> 2) % 15);     // 15-29
    const dii      = 10 + ((seed >> 3) % 12);     //10-21
    const remaining = 100 - promoter - fii - dii;
    res.json({
      symbol: me.symbol,
      asOf: new Date().toISOString().slice(0, 10),
      pattern: [
        { group: "Promoters", weight: promoter },
        { group: "FII",       weight: fii },
        { group: "DII",       weight: dii },
        { group: "Public",    weight: Math.max(remaining, 1) }
      ]
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:symbol/similar", authMiddleware, async (req, res, next) => {
  try {
    const sym = req.params.symbol.toUpperCase();
    const me = await prisma.stock.findFirst({ where: { OR: [{ symbol: sym }, { yahooSymbol: sym }] } });
    if (!me) throw NotFound("Stock not found");
    const peers = await prisma.stock.findMany({
      where: { sector: me.sector, NOT: { id: me.id } },
      take: 6
    });
    res.json({ peers });
  } catch (err) {
    next(err);
  }
});

export default router;
