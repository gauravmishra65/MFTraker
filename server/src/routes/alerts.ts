import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { authMiddleware } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { Forbidden, NotFound } from "../utils/errors";

const router = Router();
router.use(authMiddleware);

router.get("/", async (req, res, next) => {
  try {
    const alerts = await prisma.alert.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: "desc" }
    });
    res.json({ alerts });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  symbol: z.string().min(1),
  stockId: z.string().uuid().optional(),
  type: z.enum(["PRICE_ABOVE", "PRICE_BELOW", "PCT_CHANGE", "VOLUME_SPIKE"]),
  threshold: z.number()
});

router.post("/", validateBody(createSchema), async (req, res, next) => {
  try {
    const created = await prisma.alert.create({ data: { userId: req.user!.userId, ...req.body } });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const a = await prisma.alert.findUnique({ where: { id: req.params.id } });
    if (!a) throw NotFound();
    if (a.userId !== req.user!.userId) throw Forbidden();
    await prisma.alert.delete({ where: { id: a.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
