"use client";

import type { BodyStyle, FuelType, Profile } from "@/lib/profile";
import { tierFromScore, tierLabel } from "@/lib/profile";

const FUELS: FuelType[] = ["hybrid", "electric", "phev", "gas"];
const BODIES: BodyStyle[] = ["sedan", "suv", "hatchback", "minivan", "truck", "wagon"];

export function ProfileForm({
  profile,
  onChange,
  onSearch,
  busy,
}: {
  profile: Profile;
  onChange: (p: Profile) => void;
  onSearch: () => void;
  busy: boolean;
}) {
  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    onChange({ ...profile, [key]: value });

  const toggle = <T,>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Your situation</h2>
      <p className="mt-1 text-sm text-slate-500">
        CarMan uses this to find cars you can actually get. Saved in your browser only.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Num label="Credit score" value={profile.creditScore} onChange={(v) => set("creditScore", v)} />
        <div className="flex items-end pb-1 text-xs text-slate-500">
          {tierLabel(tierFromScore(profile.creditScore))}
        </div>
        <Num label="Down payment ($)" value={profile.downPayment} onChange={(v) => set("downPayment", v)} />
        <Num label="Max payment ($/mo)" value={profile.maxMonthlyPayment} onChange={(v) => set("maxMonthlyPayment", v)} />
        <Num
          label="Loan cap ($, optional)"
          value={profile.loanCap ?? 0}
          onChange={(v) => set("loanCap", v || undefined)}
        />
        <Text label="ZIP" value={profile.zip} onChange={(v) => set("zip", v)} />
        <Num label="Search radius (mi)" value={profile.radiusMiles} onChange={(v) => set("radiusMiles", v)} />
        <Num label="Min seats" value={profile.minSeats} onChange={(v) => set("minSeats", v)} />
        <Num label="Max mileage" value={profile.maxMileage ?? 0} onChange={(v) => set("maxMileage", v || undefined)} />
        <Num label="Min year" value={profile.minYear ?? 0} onChange={(v) => set("minYear", v || undefined)} />
        <Num
          label="Commute (mi/mo)"
          value={profile.commuteMilesPerMonth}
          onChange={(v) => set("commuteMilesPerMonth", v)}
        />
      </div>

      <Group label="Fuel">
        {FUELS.map((f) => (
          <Chip key={f} active={profile.fuelTypes.includes(f)} onClick={() => set("fuelTypes", toggle(profile.fuelTypes, f))}>
            {f}
          </Chip>
        ))}
      </Group>

      <Group label="Body style">
        {BODIES.map((b) => (
          <Chip key={b} active={profile.bodyStyles.includes(b)} onClick={() => set("bodyStyles", toggle(profile.bodyStyles, b))}>
            {b}
          </Chip>
        ))}
      </Group>

      <button
        onClick={onSearch}
        disabled={busy}
        className="mt-5 w-full rounded-lg bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {busy ? "Finding cars…" : "Find my cars"}
      </button>
    </div>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-sm">
      <span className="text-xs text-slate-500">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none"
      />
    </label>
  );
}

function Text({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="text-xs text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-brand focus:outline-none"
      />
    </label>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs capitalize ${
        active ? "bg-brand text-white" : "border border-slate-200 text-slate-600 hover:border-brand"
      }`}
    >
      {children}
    </button>
  );
}
