import type { FitResult } from "@/lib/finance/fit";
import { miles, money, pct } from "@/lib/format";

function scoreColor(score: number): string {
  if (score >= 75) return "bg-emerald-100 text-emerald-800";
  if (score >= 55) return "bg-amber-100 text-amber-800";
  return "bg-slate-200 text-slate-700";
}

export function CarCard({ result }: { result: FitResult }) {
  const { car } = result;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">
            {car.year} {car.make} {car.model}
            {car.trim ? <span className="font-normal text-slate-500"> {car.trim}</span> : null}
          </h3>
          <p className="text-sm text-slate-500">
            {miles(car.mileage)}
            {car.mpg ? ` · ${car.mpg} MPG` : ""}
            {car.distanceMiles != null ? ` · ${car.distanceMiles} mi away` : ""}
            {car.city ? ` · ${car.city}, ${car.state}` : ""}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${scoreColor(result.fitScore)}`}>
          {Math.round(result.fitScore)} fit
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Price" value={money(car.price)} />
        <Stat label={`Payment (${pct(result.apr)})`} value={`${money(result.monthly)}/mo`} highlight />
        <Stat label="Down needed" value={money(result.requiredDown)} />
        <Stat label="Gas/mo" value={money(result.monthlyFuel)} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {result.canAfford ? (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-800">
            ✓ Fits your budget &amp; cap
          </span>
        ) : null}
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
          {result.reliabilityText} reliability
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
          ~{money(result.totalCost)} total over {result.termMonths} mo
        </span>
      </div>

      {result.reasons.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-slate-700">
          {result.reasons.map((r, i) => (
            <li key={i}>✅ {r}</li>
          ))}
        </ul>
      )}
      {result.warnings.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-amber-700">
          {result.warnings.map((w, i) => (
            <li key={i}>⚠️ {w}</li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-slate-400">Source: {car.source}</span>
        <a
          href={car.listingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          View listing →
        </a>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`text-sm font-semibold ${highlight ? "text-brand-dark" : "text-slate-800"}`}>
        {value}
      </div>
    </div>
  );
}
