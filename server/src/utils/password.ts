import bcrypt from "bcrypt";

const COST = 12;

/** Validate password strength: 8+ chars, 1 uppercase, 1 number, 1 special. */
export function isStrongPassword(pw: string): boolean {
  if (pw.length < 8) return false;
  if (!/[A-Z]/.test(pw)) return false;
  if (!/[0-9]/.test(pw)) return false;
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw)) return false;
  return true;
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, COST);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}
