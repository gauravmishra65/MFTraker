import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { classNames } from "@/lib/format";
import {
  EXPERIENCE_OPTIONS, RISK_OPTIONS, INCOME_OPTIONS, GOAL_OPTIONS, labelFor
} from "@/lib/profileOptions";

interface Me {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  dob?: string | null;
  pan?: string | null;
  city?: string | null;
  state?: string | null;
  investmentExperience?: string | null;
  riskTolerance?: string | null;
  annualIncomeRange?: string | null;
  investmentGoals?: string[];
  createdAt?: string;
}

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh",
  "Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland",
  "Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand",
  "West Bengal","Delhi","Jammu & Kashmir","Ladakh","Puducherry","Chandigarh","Andaman & Nicobar","Dadra & NH","Daman & Diu","Lakshadweep"
];

export default function Profile() {
  const [me, setMe] = useState<Me | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Me>({} as Me);

  async function load() {
    const { data } = await api.get("/user/me");
    const meData = data as Me;
    setMe(meData);
    setForm({
      ...meData,
      dob: meData.dob ? new Date(meData.dob).toISOString().slice(0, 10) : "",
      investmentGoals: meData.investmentGoals ?? []
    });
  }

  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    try {
      const payload = {
        fullName: form.fullName,
        phone: form.phone || "",
        dob: form.dob || null,
        pan: form.pan || "",
        city: form.city || "",
        state: form.state || "",
        investmentExperience: form.investmentExperience || null,
        riskTolerance: form.riskTolerance || null,
        annualIncomeRange: form.annualIncomeRange || null,
        investmentGoals: form.investmentGoals ?? []
      };
      const { data } = await api.put("/user/me", payload);
      setMe(data as Me);
      setEditing(false);
      toast.success("Profile saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally { setSaving(false); }
  }

  function toggleGoal(g: string) {
    setForm((f) => {
      const goals = new Set(f.investmentGoals ?? []);
      goals.has(g) ? goals.delete(g) : goals.add(g);
      return { ...f, investmentGoals: [...goals] };
    });
  }

  if (!me) return <div className="text-sm text-slate-500">Loading…</div>;

  const completeness = computeCompleteness(me);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
          <p className="text-sm text-slate-500 mt-1">Member since {me.createdAt ? new Date(me.createdAt).toLocaleDateString("en-IN") : "—"}</p>
        </div>
        {!editing ? (
          <Button onClick={() => setEditing(true)}>Edit</Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => { setEditing(false); load(); }}>Cancel</Button>
            <Button onClick={save} loading={saving}>Save changes</Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Profile completeness</CardTitle>
            <span className="text-sm font-mono">{completeness}%</span>
          </div>
        </CardHeader>
        <CardBody>
          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 transition-all" style={{ width: `${completeness}%` }} />
          </div>
          {completeness < 100 && (
            <p className="text-xs text-slate-500 mt-2">
              Fill the remaining fields to unlock personalized recommendations.
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Account</CardTitle></CardHeader>
        <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Email" value={me.email} disabled />
          <Input
            label="Full name"
            value={editing ? form.fullName : me.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            disabled={!editing}
          />
          <Input
            label="Mobile"
            value={editing ? (form.phone ?? "") : (me.phone ?? "—")}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            disabled={!editing}
            placeholder="98765 43210"
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Investor profile</CardTitle></CardHeader>
        <CardBody className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Date of birth"
            type="date"
            value={editing ? (form.dob ?? "") : (me.dob ? new Date(me.dob).toISOString().slice(0,10) : "")}
            onChange={(e) => setForm({ ...form, dob: e.target.value })}
            disabled={!editing}
          />
          <Input
            label="PAN"
            value={editing ? (form.pan ?? "") : (me.pan ?? "—")}
            onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })}
            disabled={!editing}
            maxLength={10}
            style={{ textTransform: "uppercase" }}
          />
          <Input
            label="City"
            value={editing ? (form.city ?? "") : (me.city ?? "—")}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            disabled={!editing}
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">State</label>
            {editing ? (
              <select
                value={form.state ?? ""}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="w-full h-10 px-3 rounded-md text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              >
                <option value="">Select…</option>
                {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <div className="text-sm text-slate-700 dark:text-slate-200">{me.state ?? "—"}</div>
            )}
          </div>

          <Selectish
            label="Investment experience"
            value={editing ? form.investmentExperience : me.investmentExperience}
            onChange={(v) => setForm({ ...form, investmentExperience: v })}
            options={EXPERIENCE_OPTIONS}
            display={labelFor.experience}
            editing={editing}
          />
          <Selectish
            label="Risk tolerance"
            value={editing ? form.riskTolerance : me.riskTolerance}
            onChange={(v) => setForm({ ...form, riskTolerance: v })}
            options={RISK_OPTIONS}
            display={labelFor.risk}
            editing={editing}
          />
          <Selectish
            label="Annual income"
            value={editing ? form.annualIncomeRange : me.annualIncomeRange}
            onChange={(v) => setForm({ ...form, annualIncomeRange: v })}
            options={INCOME_OPTIONS}
            display={labelFor.income}
            editing={editing}
          />

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Investment goals</label>
            {editing ? (
              <div className="flex flex-wrap gap-2">
                {GOAL_OPTIONS.map((g) => {
                  const active = (form.investmentGoals ?? []).includes(g.value);
                  return (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => toggleGoal(g.value)}
                      className={classNames(
                        "h-9 px-3 rounded-full text-sm border",
                        active
                          ? "bg-brand-50 border-brand-300 text-brand-700 dark:bg-brand-900/40 dark:border-brand-700/60 dark:text-brand-200"
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                      )}
                    >
                      {g.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(me.investmentGoals ?? []).length === 0
                  ? <span className="text-sm text-slate-500">—</span>
                  : (me.investmentGoals ?? []).map((g) => (
                      <span key={g} className="px-2.5 py-1 rounded-full text-xs bg-slate-100 dark:bg-slate-800">
                        {labelFor.goal(g)}
                      </span>
                    ))
                }
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>About this app</CardTitle></CardHeader>
        <CardBody className="text-sm text-slate-600 dark:text-slate-300 space-y-2">
          <p>Live prices via Yahoo Finance. Market hours: 9:15 — 15:30 IST, Mon–Fri.</p>
          <p>Tax info under <span className="text-brand-600">Learn</span>. Information is educational, not advice.</p>
        </CardBody>
      </Card>
    </div>
  );
}

function Selectish<T extends string>({
  label, value, onChange, options, display, editing
}: {
  label: string;
  value?: string | null;
  onChange: (v: T | null) => void;
  options: readonly { value: T; label: string }[];
  display: (v?: string | null) => string;
  editing: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">{label}</label>
      {editing ? (
        <select
          value={value ?? ""}
          onChange={(e) => onChange((e.target.value || null) as T | null)}
          className="w-full h-10 px-3 rounded-md text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
        >
          <option value="">Select…</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <div className="text-sm text-slate-700 dark:text-slate-200">{display(value)}</div>
      )}
    </div>
  );
}

function computeCompleteness(m: Me): number {
  const fields: (keyof Me)[] = ["fullName", "phone", "dob", "pan", "city", "state",
    "investmentExperience", "riskTolerance", "annualIncomeRange"];
  let filled = fields.reduce((acc, f) => acc + (m[f] ? 1 : 0), 0);
  if ((m.investmentGoals ?? []).length > 0) filled += 1;
  return Math.round((filled / (fields.length + 1)) * 100);
}
