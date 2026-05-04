import { useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";

export default function ForgotPassword() {
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendOtp() {
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      toast.success("If the email exists, an OTP has been sent.");
      setStep("reset");
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Could not send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function reset() {
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { email, otp, newPassword });
      toast.success("Password updated. You can now sign in.");
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-7">
        <h1 className="text-xl font-semibold">Reset your password</h1>
        {step === "email" ? (
          <div className="mt-5 space-y-4">
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button className="w-full" loading={loading} onClick={sendOtp} size="lg">Send OTP</Button>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <Input label="OTP" value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} hint="6-digit code from your email" />
            <Input label="New password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <Button className="w-full" loading={loading} onClick={reset} size="lg">Reset password</Button>
          </div>
        )}
        <p className="text-sm text-slate-500 mt-4 text-center">
          <Link to="/login" className="text-brand-600 hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
