import nodemailer from "nodemailer";
import { env } from "../config/env";
import { logger } from "../utils/logger";

let transporter: nodemailer.Transporter | null = null;

function getTransport() {
  if (transporter) return transporter;
  if (!env.SMTP_HOST) return null;
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: (env.SMTP_PORT ?? 587) === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined
  });
  return transporter;
}

/** Send the OTP for password reset. In dev (no SMTP configured) we just log it. */
export async function sendPasswordResetOtp(to: string, otp: string) {
  const t = getTransport();
  if (!t) {
    logger.info({ to, otp }, "[DEV] Password reset OTP — configure SMTP to deliver via email");
    return;
  }
  await t.sendMail({
    from: env.SMTP_FROM ?? "noreply@tracker.in",
    to,
    subject: "Your password reset code",
    text: `Your OTP is ${otp}. It expires in 15 minutes.`,
    html: `<p>Your OTP is <strong>${otp}</strong>. It expires in 15 minutes.</p>`
  });
}

export async function sendAlertEmail(to: string, subject: string, body: string) {
  const t = getTransport();
  if (!t) return logger.info({ to, subject, body }, "[DEV] Alert email");
  await t.sendMail({ from: env.SMTP_FROM ?? "noreply@tracker.in", to, subject, html: body });
}
