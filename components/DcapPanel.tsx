import type { DcapDealer } from "@/lib/dcap";
import { money } from "@/lib/format";

export interface DcapMeta {
  grantEV: number;
  grantPHEV: number;
  maxPrice: number;
  maxMileage: number;
  maxAgeYears: number;
  dealers: DcapDealer[];
}

export function DcapPanel({ meta }: { meta: DcapMeta }) {
  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-green-900">🌱 DCAP mode is on</h2>
      <p className="mt-1 text-sm text-green-800">
        Showing only cars that qualify for the California Driving Clean Assistance Program grant.
      </p>

      <ul className="mt-3 space-y-1 text-sm text-green-800">
        <li>• EV or plug-in hybrid only</li>
        <li>• {new Date().getFullYear() - meta.maxAgeYears} or newer, under {meta.maxMileage.toLocaleString()} miles</li>
        <li>• Grant: <strong>{money(meta.grantEV)}</strong> (EV) / <strong>{money(meta.grantPHEV)}</strong> (plug-in hybrid)</li>
        <li>• Grant is a down payment — usable on a cash purchase, no loan required</li>
      </ul>

      <h3 className="mt-4 text-sm font-semibold text-green-900">DCAP dealers near you (call these)</h3>
      <div className="mt-2 space-y-2">
        {meta.dealers.map((d, i) => (
          <div key={i} className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm">
            <div className="font-medium text-slate-800">{d.name}</div>
            <div className="text-slate-500">
              {[d.address, d.city].filter(Boolean).join(", ")}
              {d.phone ? ` · ${d.phone}` : ""}
            </div>
            {d.note ? <div className="text-xs text-slate-400">{d.note}</div> : null}
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-green-700">
        Full list at{" "}
        <a
          className="underline"
          href="https://drivingcleanca.org/vehicles/dealership-network/"
          target="_blank"
          rel="noopener noreferrer"
        >
          drivingcleanca.org
        </a>
        . Any licensed CA dealer that can provide the required documents can also process a DCAP sale.
      </p>
    </div>
  );
}
