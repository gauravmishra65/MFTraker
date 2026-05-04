import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { authMiddleware } from "../middleware/auth";
import { validateQuery } from "../middleware/validate";
import { NotFound } from "../utils/errors";

const router = Router();
router.use(authMiddleware);

const searchSchema = z.object({
  q: z.string().optional().default(""),
  category: z.string().optional(),
  riskLevel: z.string().optional(),
  amc: z.string().optional()
});

router.get("/search", validateQuery(searchSchema), async (req, res, next) => {
  try {
    const f = req.query as unknown as z.infer<typeof searchSchema>;
    const where: Record<string, unknown> = {};
    if (f.q) {
      where.OR = [
        { name: { contains: f.q, mode: "insensitive" } },
        { amc: { contains: f.q, mode: "insensitive" } }
      ];
    }
    if (f.category) where.category = f.category;
    if (f.riskLevel) where.riskLevel = f.riskLevel;
    if (f.amc) where.amc = f.amc;
    const results = await prisma.mutualFund.findMany({ where, take: 30, orderBy: { name: "asc" } });
    res.json({ results });
  } catch (err) {
    next(err);
  }
});

router.get("/categories", async (_req, res, next) => {
  try {
    const cats = await prisma.mutualFund.findMany({
      distinct: ["category"],
      select: { category: true }
    });
    const amcs = await prisma.mutualFund.findMany({
      distinct: ["amc"],
      select: { amc: true }
    });
    res.json({ categories: cats.map((c) => c.category), amcs: amcs.map((a) => a.amc) });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const fund = await prisma.mutualFund.findUnique({ where: { id: req.params.id } });
    if (!fund) throw NotFound("Fund not found");
    // Synthetic holdings/returns demo — replace with AMFI/AMC API integration in production.
    const fakeHoldings = [
      { name: "HDFC Bank", weight: 8.4 },
      { name: "Reliance Industries", weight: 7.1 },
      { name: "ICICI Bank", weight: 6.8 },
      { name: "Infosys", weight: 5.9 },
      { name: "TCS", weight: 5.2 },
      { name: "Larsen & Toubro", weight: 3.8 },
      { name: "Bharti Airtel", weight: 3.5 },
      { name: "Axis Bank", weight: 3.2 },
      { name: "ITC", weight: 3.0 },
      { name: "Kotak Mahindra Bank", weight: 2.8 }
    ];
    const fakeReturns = { "1M": 1.4, "3M": 4.2, "6M": 9.1, "1Y": 18.6, "3Y": 14.8, "5Y": 12.4, SI: 13.7 };
    const sectors = [
      { sector: "Financials", weight: 32 },
      { sector: "IT", weight: 18 },
      { sector: "Energy", weight: 12 },
      { sector: "FMCG", weight: 9 },
      { sector: "Auto", weight: 7 },
      { sector: "Pharma", weight: 6 },
      { sector: "Other", weight: 16 }
    ];
    res.json({ fund, holdings: fakeHoldings, returns: fakeReturns, sectors });
  } catch (err) {
    next(err);
  }
});

const compareSchema = z.object({ ids: z.string() });
router.get("/compare/list", validateQuery(compareSchema), async (req, res, next) => {
  try {
    const ids = String((req.query as { ids: string }).ids).split(",").slice(0, 3);
    const funds = await prisma.mutualFund.findMany({ where: { id: { in: ids } } });
    res.json({ funds });
  } catch (err) {
    next(err);
  }
});

const sipSchema = z.object({
  monthly: z.coerce.number().positive(),
  years: z.coerce.number().positive(),
  rate: z.coerce.number()
});
router.get("/calc/sip", validateQuery(sipSchema), (req, res) => {
  const { monthly, years, rate } = req.query as unknown as z.infer<typeof sipSchema>;
  const months = Math.round(years * 12);
  const r = rate / 100 / 12;
  // Future value of an annuity
  const fv = r === 0 ? monthly * months : monthly * ((Math.pow(1 + r, months) - 1) / r) * (1 + r);
  const invested = monthly * months;
  res.json({ invested, futureValue: Math.round(fv), gains: Math.round(fv - invested) });
});

export default router;
