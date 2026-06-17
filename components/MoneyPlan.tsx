import { creditFixPlan, type RefiProjection } from "@/lib/finance/refi";
import { money, pct } from "@/lib/format";

export function MoneyPlan({ refi }: { refi: RefiProjection }) {
  const steps = creditFixPlan();
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Your money plan</h2>
      <p className="mt-1 text-sm text-slate-500">
        Buy smart now, then refinance out of the high rate as your credit recovers.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric label="Rate now" value={pct(refi.currentApr)} />
        <Metric label={`In ~${refi.monthsUntilRefi} mo`} value={pct(refi.projectedApr)} sub={`~${refi.projectedScore} score`} />
        <Metric label="Payment now" value={`${money(refi.currentMonthly)}/mo`} />
        <Metric label="After refi" value={`${money(refi.refiMonthly)}/mo`} highlight />
      </div>

      <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
        Refinancing in ~{refi.monthsUntilRefi} months could save you about{" "}
        <strong>{money(refi.interestSaved)}</strong> in interest.
      </div>

      <h3 className="mt-5 text-sm font-semibold text-slate-700">To get there:</h3>
      <ol className="mt-2 space-y-2">
        {steps.map((s, i) => (
          <li key={i} className="text-sm">
            <span className="font-medium text-slate-800">
              {i + 1}. {s.title}
            </span>
            <span className="block text-slate-500">{s.detail}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`text-base font-semibold ${highlight ? "text-emerald-700" : "text-slate-800"}`}>
        {value}
      </div>
      {sub ? <div className="text-xs text-slate-400">{sub}</div> : null}
    </div>
  );
}
