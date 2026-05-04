import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { classNames } from "@/lib/format";
import {
  EXPERIENCE_OPTIONS, RISK_OPTIONS, INCOME_OPTIONS, GOAL_OPTIONS
} from "@/lib/profileOptions";

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const PHONE_RE = /^[6-9]\d{9}$/;

const schema = z.object({
  fullName: z.string().min(2, "Enter your full name"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().regex(PHONE_RE, "10-digit Indian mobile (starts 6-9)").optional().or(z.literal("")),
  password: z.string()
    .min(8, "At least 8 characters")
    .regex(/[A-Z]/, "1 uppercase letter required")
    .regex(/[0-9]/, "1 number required")
    .regex(/[^A-Za-z0-9]/, "1 special character required"),
  confirmPassword: z.string(),

  // Investor profile
  dob: z.string().optional().or(z.literal("")),
  pan: z.string().trim().transform((s) => s.toUpperCase()).refine(
    (s) => !s || PAN_RE.test(s), "Invalid PAN format (e.g., ABCDE1234F)"
  ).optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  state: z.string().optional().or(z.literal("")),
  investmentExperience: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional().or(z.literal("")),
  riskTolerance: z.enum(["CONSERVATIVE", "MODERATE", "AGGRESSIVE"]).optional().or(z.literal("")),
  annualIncomeRange: z.enum(["UNDER_5L","5L_10L","10L_25L","25L_50L","OVER_50L","PREFER_NOT_SAY"]).optional().or(z.literal("")),
  investmentGoals: z.array(z.string()).default([])
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
}).refine((d) => {
  if (!d.dob) return true;
  const age = (Date.now() - new Date(d.dob).getTime()) / (365.25 * 24 * 3600 * 1000);
  return age >= 18;
}, { message: "You must be at least 18 years old", path: ["dob"] });

type Form = z.infer<typeof schema>;

const DRAFT_KEY = "tracker-register-draft";

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh",
  "Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland",
  "Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand",
  "West Bengal","Delhi","Jammu & Kashmir","Ladakh","Puducherry","Chandigarh","Andaman & Nicobar","Dadra & NH","Daman & Diu","Lakshadweep"
];

export default function Register() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);

  // Hydrate from localStorage so the user can leave and come back without losing input.
  // We deliberately exclude password fields from the draft.
  const draft = (() => {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}"); } catch { return {}; }
  })();

  const { register, handleSubmit, control, watch, formState: { errors }, getValues } = useForm<Form>({
    defaultValues: {
      fullName: draft.fullName ?? "",
      email: draft.email ?? "",
      phone: draft.phone ?? "",
      password: "",
      confirmPassword: "",
      dob: draft.dob ?? "",
      pan: draft.pan ?? "",
      city: draft.city ?? "",
      state: draft.state ?? "",
      investmentExperience: draft.investmentExperience ?? "",
      riskTolerance: draft.riskTolerance ?? "",
      annualIncomeRange: draft.annualIncomeRange ?? "",
      investmentGoals: draft.investmentGoals ?? []
    }
  });

  // Auto-save draft (sans passwords) on every change.
  useEffect(() => {
    const sub = watch((v) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, confirmPassword, ...safe } = v as Form;
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(safe)); } catch { /* ignore */ }
    });
    return () => sub.unsubscribe();
  }, [watch]);

  async function onSubmit(values: Form) {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Check the form");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...parsed.data,
        phone: parsed.data.phone || undefined,
        dob: parsed.data.dob ? new Date(parsed.data.dob) : null,
        pan: parsed.data.pan || null,
        city: parsed.data.city || null,
        state: parsed.data.state || null,
        investmentExperience: parsed.data.investmentExperience || null,
        riskTolerance: parsed.data.riskTolerance || null,
        annualIncomeRange: parsed.data.annualIncomeRange || null
      };
      const { data } = await api.post("/auth/register", payload);
      setAuth(data.token, data.user);
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      toast.success("Welcome aboard!");
      nav("/");
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Could not register");
    } finally {
      setLoading(false);
    }
  }

  const goals = watch("investmentGoals") ?? [];
  const hasDraft = !!draft.fullName || !!draft.email;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-2xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
          <p className="text-sm text-slate-500 mt-1">
            Start tracking your Indian portfolio.
            {hasDraft && <span className="ml-2 text-brand-600">Draft restored.</span>}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Account credentials</CardTitle></CardHeader>
            <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Full name" {...register("fullName")} error={errors.fullName?.message} />
              <Input label="Email" type="email" autoComplete="email" {...register("email")} error={errors.email?.message} />
              <Input
                label="Mobile (10-digit, optional)"
                {...register("phone")}
                error={errors.phone?.message as string | undefined}
                placeholder="98765 43210"
              />
              <div /> {/* spacer */}
              <Input
                label="Password"
                type="password"
                autoComplete="new-password"
                {...register("password")}
                error={errors.password?.message}
                hint="8+ chars · 1 uppercase · 1 number · 1 special"
              />
              <Input
                label="Confirm password"
                type="password"
                autoComplete="new-password"
                {...register("confirmPassword")}
                error={errors.confirmPassword?.message}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Investor profile</CardTitle>
              <p className="text-xs text-slate-500 mt-1">All optional — helps us personalize recommendations later.</p>
            </CardHeader>
            <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Date of birth" type="date" {...register("dob")} error={errors.dob?.message as string | undefined} />
              <Input
                label="PAN"
                {...register("pan")}
                error={errors.pan?.message as string | undefined}
                placeholder="ABCDE1234F"
                maxLength={10}
                style={{ textTransform: "uppercase" }}
              />
              <Input label="City" {...register("city")} placeholder="Mumbai" />
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">State</label>
                <select
                  {...register("state")}
                  className="w-full h-10 px-3 rounded-md text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                >
                  <option value="">Select state…</option>
                  {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <RadioGroup label="Investment experience" name="investmentExperience" register={register} options={EXPERIENCE_OPTIONS} />
              <RadioGroup label="Risk tolerance"        name="riskTolerance"        register={register} options={RISK_OPTIONS} />

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Annual income</label>
                <select
                  {...register("annualIncomeRange")}
                  className="w-full h-10 px-3 rounded-md text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                >
                  <option value="">Select range…</option>
                  {INCOME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Investment goals (pick any)</label>
                <Controller
                  control={control}
                  name="investmentGoals"
                  render={({ field }) => (
                    <div className="flex flex-wrap gap-2">
                      {GOAL_OPTIONS.map((g) => {
                        const active = field.value?.includes(g.value);
                        return (
                          <button
                            key={g.value}
                            type="button"
                            onClick={() => {
                              const next = active
                                ? field.value.filter((x: string) => x !== g.value)
                                : [...(field.value ?? []), g.value];
                              field.onChange(next);
                            }}
                            className={classNames(
                              "h-9 px-3 rounded-full text-sm border transition-colors",
                              active
                                ? "bg-brand-50 border-brand-300 text-brand-700 dark:bg-brand-900/40 dark:border-brand-700/60 dark:text-brand-200"
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                            )}
                          >
                            {g.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                />
                {goals.length > 0 && <p className="text-xs text-slate-500 mt-1.5">{goals.length} selected</p>}
              </div>
            </CardBody>
          </Card>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              Already have an account? <Link to="/login" className="text-brand-600 hover:underline">Sign in</Link>
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
                  toast.success("Draft cleared");
                  // Replace the form with empty defaults by reloading the page.
                  setTimeout(() => window.location.reload(), 300);
                }}
              >
                Clear draft
              </Button>
              <Button type="submit" loading={loading} size="lg">Create account</Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function RadioGroup({
  label, name, register, options
}: {
  label: string;
  name: keyof Form;
  register: ReturnType<typeof useForm<Form>>["register"];
  options: readonly { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">{label}</label>
      <div className="space-y-1.5">
        {options.map((o) => (
          <label key={o.value} className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              value={o.value}
              {...register(name)}
              className="mt-0.5"
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
