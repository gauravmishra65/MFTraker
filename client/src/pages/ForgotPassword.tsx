import { useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { authApi } from "@/lib/api";

export default function ForgotPassword() {
  const [step, setStep] = useState<"email" | "done">("email");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendReset() {
    setLoading(true);
    try {
      await authApi.resetPassword(email);
      toast.success("If the email exists, a reset link has been sent.");
      setStep("done");
    } catch (err: any) {
      toast.error(err?.message ?? "Could not send reset email");
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
            <Button className="w-full" loading={loading} onClick={sendReset} size="lg">Send reset link</Button>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Check your email for a password reset link. You can then sign in with your new password.
            </p>
          </div>
        )}
        <p className="text-sm text-slate-500 mt-4 text-center">
          <Link to="/login" className="text-brand-600 hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
