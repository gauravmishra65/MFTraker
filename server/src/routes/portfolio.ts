import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { authMiddleware } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { BadRequest, Forbidden, NotFound } from "../utils/errors";
import { getEnrichedPortfolio, recomputeHoldings } from "../services/portfolio";
import { streamPortfolioReport } from "../services/pdfReport";

const router = Router();
router.use(authMiddleware);

router.get("/", async (req, res, next) => {
  try {
    res.json(await getEnrichedPortfolio(req.user!.userId));
  } catch (err) {
    next(err);
  }
});

router.get("/transactions", async (req, res, next) => {
  try {
    const txs = await prisma.portfolioTransaction.findMany({
      where: { userId: req.user!.userId },
      orderBy: { date: "desc" },
      include: { stock: true, mf: true }
    });
    res.json({ transactions: txs });
  } catch (err) {
    next(err);
  }
});

const txSchema = z.object({
  stockId: z.string().uuid().optional(),
  mfId: z.string().uuid().optional(),
  type: z.enum(["BUY", "SELL", "SIP", "LUMPSUM", "REDEEM"]),
  date: z.coerce.date(),
  quantity: z.number().positive(),
  price: z.number().positive(),
  brokerage: z.number().nonnegative().default(0),
  notes: z.string().max(500).optional()
}).refine((d) => d.stockId || d.mfId, "stockId or mfId required");

router.post("/transactions", validateBody(txSchema), async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    if (req.body.stockId) {
      const ok = await prisma.stock.findUnique({ where: { id: req.body.stockId } });
      if (!ok) throw BadRequest("Unknown stock");
    }
    if (req.body.mfId) {
      const ok = await prisma.mutualFund.findUnique({ where: { id: req.body.mfId } });
      if (!ok) throw BadRequest("Unknown mutual fund");
    }
    const tx = await prisma.portfolioTransaction.create({ data: { userId, ...req.body } });
    await recomputeHoldings(userId);
    res.status(201).json(tx);
  } catch (err) {
    next(err);
  }
});

router.delete("/transactions/:id", async (req, res, next) => {
  try {
    const tx = await prisma.portfolioTransaction.findUnique({ where: { id: req.params.id } });
    if (!tx) throw NotFound();
    if (tx.userId !== req.user!.userId) throw Forbidden();
    await prisma.portfolioTransaction.delete({ where: { id: tx.id } });
    await recomputeHoldings(req.user!.userId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get("/dividends", async (req, res, next) => {
  try {
    const items = await prisma.dividend.findMany({
      where: { userId: req.user!.userId },
      orderBy: { date: "desc" }
    });
    res.json({ dividends: items });
  } catch (err) {
    next(err);
  }
});

const divSchema = z.object({
  symbol: z.string().min(1),
  amount: z.number().positive(),
  perShare: z.number().positive().optional(),
  date: z.coerce.date(),
  notes: z.string().max(500).optional()
});

router.post("/dividends", validateBody(divSchema), async (req, res, next) => {
  try {
    const created = await prisma.dividend.create({ data: { userId: req.user!.userId, ...req.body } });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.get("/report.pdf", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { fullName: true }
    });
    await streamPortfolioReport(req.user!.userId, user?.fullName ?? "Investor", res);
  } catch (err) {
    next(err);
  }
});

router.get("/export.csv", async (req, res, next) => {
  try {
    const data = await getEnrichedPortfolio(req.user!.userId);
    const header = "Symbol,Name,Type,Quantity,AvgPrice,Invested,LTP,CurrentValue,P&L,P&L %\n";
    const rows = data.holdings.map((h) =>
      [
        h.symbol,
        `"${(h.name ?? "").replace(/"/g, '""')}"`,
        h.instrumentType,
        h.quantity,
        h.avgPrice.toFixed(2),
        h.invested.toFixed(2),
        h.ltp.toFixed(2),
        h.currentValue.toFixed(2),
        h.pnl.toFixed(2),
        h.pnlPct.toFixed(2)
      ].join(",")
    );
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=portfolio.csv");
    res.send(header + rows.join("\n"));
  } catch (err) {
    next(err);
  }
});

export default router;
