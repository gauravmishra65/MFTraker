import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { authMiddleware } from "../middleware/auth";
import { validateBody, validateQuery } from "../middleware/validate";
import { Forbidden, NotFound } from "../utils/errors";
import { getMarketProvider } from "../providers";

const router = Router();
router.use(authMiddleware);

router.get("/", async (req, res, next) => {
  try {
    const lists = await prisma.watchList.findMany({
      where: { userId: req.user!.userId },
      include: { items: { include: { stock: true, mf: true }, orderBy: { position: "asc" } } },
      orderBy: { position: "asc" }
    });
    res.json({ watchlists: lists });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({ name: z.string().min(1).max(60) });
router.post("/", validateBody(createSchema), async (req, res, next) => {
  try {
    const created = await prisma.watchList.create({
      data: { userId: req.user!.userId, name: req.body.name }
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const wl = await prisma.watchList.findUnique({ where: { id: req.params.id } });
    if (!wl) throw NotFound();
    if (wl.userId !== req.user!.userId) throw Forbidden();
    await prisma.watchList.delete({ where: { id: wl.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

const addItemSchema = z.object({
  watchListId: z.string().uuid(),
  stockId: z.string().uuid().optional(),
  mfId: z.string().uuid().optional()
}).refine((d) => d.stockId || d.mfId, { message: "Either stockId or mfId required" });

router.post("/items", validateBody(addItemSchema), async (req, res, next) => {
  try {
    const wl = await prisma.watchList.findUnique({ where: { id: req.body.watchListId } });
    if (!wl || wl.userId !== req.user!.userId) throw Forbidden();
    const count = await prisma.watchListItem.count({ where: { watchListId: wl.id } });
    const created = await prisma.watchListItem.create({
      data: {
        watchListId: wl.id,
        stockId: req.body.stockId,
        mfId: req.body.mfId,
        position: count
      },
      include: { stock: true, mf: true }
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.delete("/items/:id", async (req, res, next) => {
  try {
    const item = await prisma.watchListItem.findUnique({
      where: { id: req.params.id },
      include: { watchList: true }
    });
    if (!item) throw NotFound();
    if (item.watchList.userId !== req.user!.userId) throw Forbidden();
    await prisma.watchListItem.delete({ where: { id: item.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

const reorderSchema = z.object({ ids: z.array(z.string().uuid()) });
router.post("/items/reorder", validateBody(reorderSchema), async (req, res, next) => {
  try {
    const ids: string[] = req.body.ids;
    // Verify ownership before updating positions.
    const items = await prisma.watchListItem.findMany({
      where: { id: { in: ids } },
      include: { watchList: true }
    });
    const owned = items.every((i) => i.watchList.userId === req.user!.userId);
    if (!owned) throw Forbidden();
    await prisma.$transaction(
      ids.map((id, position) => prisma.watchListItem.update({ where: { id }, data: { position } }))
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

const liveSchema = z.object({ watchListId: z.string().uuid() });
router.get("/live", validateQuery(liveSchema), async (req, res, next) => {
  try {
    const { watchListId } = req.query as unknown as z.infer<typeof liveSchema>;
    const wl = await prisma.watchList.findUnique({
      where: { id: watchListId },
      include: { items: { include: { stock: true, mf: true } } }
    });
    if (!wl || wl.userId !== req.user!.userId) throw Forbidden();
    const symbols = wl.items.map((i) => i.stock?.yahooSymbol).filter(Boolean) as string[];
    const quotes = symbols.length ? await getMarketProvider().getQuotes(symbols) : [];
    res.json({ items: wl.items, quotes });
  } catch (err) {
    next(err);
  }
});

export default router;
