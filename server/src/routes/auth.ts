import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../config/db";
import { validateBody } from "../middleware/validate";
import { loginLimiter } from "../middleware/rateLimit";
import { hashPassword, isStrongPassword, verifyPassword } from "../utils/password";
import { signToken } from "../utils/jwt";
import { BadRequest, Conflict, NotFound, Unauthorized } from "../utils/errors";
import { sendPasswordResetOtp } from "../services/email";
import { env } from "../config/env";

const router = Router();

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const PHONE_RE = /^[6-9]\d{9}$/;

const EXPERIENCE = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
const RISK       = ["CONSERVATIVE", "MODERATE", "AGGRESSIVE"] as const;
const INCOME     = ["UNDER_5L", "5L_10L", "10L_25L", "25L_50L", "OVER_50L", "PREFER_NOT_SAY"] as const;
const GOALS      = ["RETIREMENT", "WEALTH", "CHILD_EDU", "HOME", "SHORT_TERM", "TAX_SAVING"] as const;

const registerSchema = z.object({
  fullName: z.string().min(2).max(80),
  email: z.string().email().toLowerCase(),
  phone: z.string().regex(PHONE_RE, "Enter a valid 10-digit Indian mobile number").optional().or(z.literal("")),
  password: z.string(),
  confirmPassword: z.string(),

  // Investor profile (all optional — encourage but don't block)
  dob: z.coerce.date().optional().nullable(),
  pan: z.string().trim().toUpperCase().regex(PAN_RE, "Invalid PAN format (e.g., ABCDE1234F)").optional().or(z.literal("")),
  city: z.string().max(80).optional().or(z.literal("")),
  state: z.string().max(80).optional().or(z.literal("")),
  investmentExperience: z.enum(EXPERIENCE).optional().nullable(),
  riskTolerance: z.enum(RISK).optional().nullable(),
  annualIncomeRange: z.enum(INCOME).optional().nullable(),
  investmentGoals: z.array(z.enum(GOALS)).default([])
});

router.post("/register", validateBody(registerSchema), async (req, res, next) => {
  try {
    const { fullName, email, phone, password, confirmPassword,
            dob, pan, city, state, investmentExperience, riskTolerance,
            annualIncomeRange, investmentGoals } = req.body;

    if (password !== confirmPassword) throw BadRequest("Passwords do not match");
    if (!isStrongPassword(password))
      throw BadRequest("Password must be 8+ chars with uppercase, number and special char");

    // Age check — SEBI requires 18+ for trading accounts.
    if (dob) {
      const age = (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000);
      if (age < 18) throw BadRequest("You must be at least 18 years old to register");
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) throw Conflict("Email already registered");

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        phone: phone || null,
        passwordHash: await hashPassword(password),
        dob: dob || null,
        pan: pan ? String(pan).toUpperCase() : null,
        city: city || null,
        state: state || null,
        investmentExperience: investmentExperience || null,
        riskTolerance: riskTolerance || null,
        annualIncomeRange: annualIncomeRange || null,
        investmentGoals: investmentGoals ?? []
      }
    });

    // Auto-create a default watchlist for new users.
    await prisma.watchList.create({ data: { userId: user.id, name: "My Watchlist" } });

    // Activity log entry — useful when reviewing onboarding completeness later.
    await prisma.activityLog.create({
      data: { userId: user.id, action: "REGISTERED", detail: { source: "form" } }
    }).catch(() => {});

    const token = signToken({ userId: user.id, email: user.email });
    res.status(201).json({
      token,
      user: {
        id: user.id, fullName, email, phone: user.phone,
        dob: user.dob, pan: user.pan, city: user.city, state: user.state,
        investmentExperience: user.investmentExperience,
        riskTolerance: user.riskTolerance,
        annualIncomeRange: user.annualIncomeRange,
        investmentGoals: user.investmentGoals
      }
    });
  } catch (err) {
    next(err);
  }
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string()
});

router.post("/login", loginLimiter, validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) throw Unauthorized("Invalid email or password");
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw Unauthorized("Invalid email or password");
    const token = signToken({ userId: user.id, email: user.email });
    res.json({
      token,
      user: { id: user.id, fullName: user.fullName, email: user.email, phone: user.phone }
    });
  } catch (err) {
    next(err);
  }
});

const forgotSchema = z.object({ email: z.string().email().toLowerCase() });
router.post("/forgot-password", validateBody(forgotSchema), async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    // Always 200 to avoid leaking which emails exist.
    if (!user) return res.json({ ok: true });
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    await prisma.passwordReset.create({
      data: { userId: user.id, otpHash, expiresAt: new Date(Date.now() + 15 * 60_000) }
    });
    await sendPasswordResetOtp(email, otp);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

const resetSchema = z.object({
  email: z.string().email().toLowerCase(),
  otp: z.string().length(6),
  newPassword: z.string()
});
router.post("/reset-password", validateBody(resetSchema), async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!isStrongPassword(newPassword)) throw BadRequest("Password too weak");
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw NotFound("User not found");
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const reset = await prisma.passwordReset.findFirst({
      where: { userId: user.id, otpHash, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" }
    });
    if (!reset) throw BadRequest("Invalid or expired OTP");
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } }),
      prisma.passwordReset.update({ where: { id: reset.id }, data: { used: true } })
    ]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---- Google OAuth ----
const googleSchema = z.object({ idToken: z.string() });
router.post("/google", validateBody(googleSchema), async (req, res, next) => {
  try {
    if (!env.GOOGLE_CLIENT_ID) throw BadRequest("Google login not configured on server");
    const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken: req.body.idToken, audience: env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.email) throw Unauthorized("Google token has no email");

    let user = await prisma.user.findUnique({ where: { email: payload.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          fullName: payload.name ?? payload.email,
          email: payload.email,
          googleId: payload.sub,
          emailVerified: !!payload.email_verified
        }
      });
      await prisma.watchList.create({ data: { userId: user.id, name: "My Watchlist" } });
    } else if (!user.googleId) {
      await prisma.user.update({ where: { id: user.id }, data: { googleId: payload.sub } });
    }
    const token = signToken({ userId: user.id, email: user.email });
    res.json({ token, user: { id: user.id, fullName: user.fullName, email: user.email } });
  } catch (err) {
    next(err);
  }
});

export default router;
