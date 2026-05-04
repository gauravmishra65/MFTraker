import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { getMarketProvider } from "../providers";
import { isMarketOpen, nextMarketChange } from "../services/marketStatus";

const router = Router();

router.get("/indices", authMiddleware, async (_req, res, next) => {
  try {
    res.json({ indices: await getMarketProvider().getIndices() });
  } catch (err) {
    next(err);
  }
});

router.get("/movers", authMiddleware, async (_req, res, next) => {
  try {
    res.json(await getMarketProvider().getMovers());
  } catch (err) {
    next(err);
  }
});

router.get("/status", (_req, res) => {
  res.json({ open: isMarketOpen(), ...nextMarketChange() });
});

export default router;
