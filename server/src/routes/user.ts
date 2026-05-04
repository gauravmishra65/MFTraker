import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { authMiddleware } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { NotFound, BadRequest } from "../utils/errors";

const router = Router();
router.use(authMiddleware);

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const PHONE_RE = /^[6-9]\d{9}$/;

const EXPERIENCE = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
const RISK       = ["CONSERVATIVE", "MODERATE", "AGGRESSIVE"] as const;
const INCOME     = ["UNDER_5L", "5L_10L", "10L_25L", "25L_50L", "OVER_50L", "PREFER_NOT_SAY"] as const;
const GOALS      = ["RETIREMENT", "WEALTH", "CHILD_EDU", "HOME", "SHORT_TERM", "TAX_SAVING"] as const;

const profileSelect = {
  id: true, fullName: true, email: true, phone: true, preferences: true,
  dob: true, pan: true, city: true, state: true,
  investmentExperience: true, riskTolerance: true, annualIncomeRange: true,
  investmentGoals: true,
  createdAt: true
} as const;

router.get("/me", async (req, res, next) => {
  try {
    const u = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: profileSelect
    });
    if (!u) throw NotFound();
    res.json(u);
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  fullName: z.string().min(2).max(80).optional(),
  phone: z.string().regex(PHONE_RE, "Enter a valid 10-digit Indian mobile number").optional().or(z.literal("")),
  preferences: z.record(z.any()).optional(),
  dob: z.coerce.date().optional().nullable(),
  pan: z.string().trim().toUpperCase().regex(PAN_RE, "Invalid PAN format (e.g., ABCDE1234F)").optional().or(z.literal("")),
  city: z.string().max(80).optional().or(z.literal("")),
  state: z.string().max(80).optional().or(z.literal("")),
  investmentExperience: z.enum(EXPERIENCE).optional().nullable(),
  riskTolerance: z.enum(RISK).optional().nullable(),
  annualIncomeRange: z.enum(INCOME).optional().nullable(),
  investmentGoals: z.array(z.enum(GOALS)).optional()
});

router.put("/me", validateBody(updateSchema), async (req, res, next) => {
  try {
    const data = req.body;
    if (data.dob) {
      const age = (Date.now() - new Date(data.dob).getTime()) / (365.25 * 24 * 3600 * 1000);
      if (age < 18) throw BadRequest("You must be at least 18 years old");
    }
    // Map empty strings → null so the column actually clears.
    for (const k of ["phone","pan","city","state","investmentExperience","riskTolerance","annualIncomeRange"] as const) {
      if (data[k] === "") (data as Record<string, unknown>)[k] = null;
    }
    const u = await prisma.user.update({
      where: { id: req.user!.userId },
      data,
      select: profileSelect
    });
    res.json(u);
  } catch (err) {
    next(err);
  }
});

router.get("/activity", async (req, res, next) => {
  try {
    const items = await prisma.activityLog.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: "desc" },
      take: 100
    });
    res.json({ activity: items });
  } catch (err) {
    next(err);
  }
});

export default router;
