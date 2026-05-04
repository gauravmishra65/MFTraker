import { useForm } from "react-hook-form";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import toast from "react-hot-toast";
import { LineChart } from "lucide-react";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters")
});
type Form = z.infer<typeof schema>;

export default function Login() {
  const { register, handleSubmit, formState: { errors } } = useForm<Form>();
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const nav = useNavigate();

  async function onSubmit(values: Form) {
    const parsed = schema.safeParse(values);
    if (!parsed.success) return;
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", parsed.data);
      setAuth(data.token, data.user);
      toast.success(`Welcome back, ${data.user.fullName.split(" ")[0]}`);
      nav("/");
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 text-white p-12">
        <div className="flex items-center gap-2">
          <LineChart className="w-7 h-7" />
          <span className="font-semibold text-lg">MF &amp; Share Tracker</span>
        </div>
        <div>
          <h1 className="text-3xl font-semibold leading-tight max-w-md">
            Track every rupee — from NIFTY blue chips to your favourite SIPs.
          </h1>
          <p className="mt-3 text-brand-100/90 max-w-md">
            Real-time prices, weighted-average P&amp;L, multi-watchlist alerts and exportable reports for Indian markets.
          </p>
        </div>
        <p className="text-sm text-brand-100/70">© {new Date().getFullYear()} Tracker</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <LineChart className="w-6 h-6 text-brand-500" />
            <span className="font-semibold text-lg">Tracker</span>
          </div>
          <h2 className="text-2xl font-semibold">Sign in to your account</h2>
          <p className="text-sm text-slate-500 mt-1">
            Demo: <code>demo@tracker.in</code> / <code>Demo@1234</code>
          </p>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <Input label="Email" type="email" autoComplete="email" {...register("email")} error={errors.email?.message} />
            <Input label="Password" type="password" autoComplete="current-password" {...register("password")} error={errors.password?.message} />
            <Button type="submit" loading={loading} className="w-full" size="lg">Sign in</Button>
          </form>
          <div className="mt-4 flex items-center justify-between text-sm">
            <Link to="/forgot-password" className="text-brand-600 hover:underline">Forgot password?</Link>
            <span className="text-slate-500">
              No account? <Link to="/register" className="text-brand-600 hover:underline">Sign up</Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
