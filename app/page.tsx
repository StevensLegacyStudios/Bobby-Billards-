"use client";

import { useCallback, useEffect, useState } from "react";
import { loadProfile, saveProfile, type Profile } from "@/lib/profile";
import type { FitResult } from "@/lib/finance/fit";
import type { RefiProjection } from "@/lib/finance/refi";
import type { PrivateSellerLink } from "@/lib/privateLinks";
import type { DcapInfo } from "@/lib/dcap";
import { ProfileForm } from "@/components/ProfileForm";
import { CarCard } from "@/components/CarCard";
import { MoneyPlan } from "@/components/MoneyPlan";
import { PrivateSellerLinks } from "@/components/PrivateSellerLinks";
import { AdvisorChat } from "@/components/AdvisorChat";
import { DcapPanel, type DcapMeta } from "@/components/DcapPanel";

type Result = FitResult & { dcap?: DcapInfo };

interface SearchResponse {
  results: Result[];
  refi: RefiProjection;
  privateLinks: PrivateSellerLink[];
  provider: { name: string; live: boolean; usedFallback: boolean; error?: string };
  dcap: DcapMeta | null;
}

export default function Home() {
  const [profile, setProfile] = useState<Profile>(loadProfile());
  const [data, setData] = useState<SearchResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dcapMode, setDcapMode] = useState(false);

  const search = useCallback(async (p: Profile, dcap: boolean) => {
    setBusy(true);
    setError(null);
    saveProfile(p);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: p, dcap }),
      });
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      setData((await res.json()) as SearchResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setBusy(false);
    }
  }, []);

  // Run an initial search on first load.
  useEffect(() => {
    const p = loadProfile();
    setProfile(p);
    void search(p, false);
  }, [search]);

  function toggleDcap() {
    const next = !dcapMode;
    setDcapMode(next);
    void search(profile, next);
  }

  const affordable = data?.results.filter((r) => r.canAfford) ?? [];
  const stretch = data?.results.filter((r) => !r.canAfford) ?? [];

  const contextSummary = (data?.results ?? [])
    .slice(0, 4)
    .map(
      (r) =>
        `${r.car.year} ${r.car.make} ${r.car.model} — $${r.car.price}, ~$${Math.round(r.monthly)}/mo, ${
          r.canAfford ? "fits budget" : "over cap"
        }`,
    )
    .join("; ");

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            CarMan <span className="text-brand">AI</span>
          </h1>
          <p className="mt-1 text-slate-600">
            Your personal car finder — real cars you can actually get, with the financing math done for you.
          </p>
        </div>
        <button
          onClick={toggleDcap}
          className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
            dcapMode
              ? "border-green-600 bg-green-600 text-white"
              : "border-green-300 bg-white text-green-700 hover:bg-green-50"
          }`}
        >
          {dcapMode ? "🌱 DCAP mode: ON" : "🌱 DCAP mode: off"}
        </button>
      </header>

      {data && !data.provider.live && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Showing <strong>sample data</strong>. Add an <code>AUTODEV_API_KEY</code> to{" "}
          <code>.env.local</code> for live nationwide dealer listings.
          {data.provider.error ? <span className="block text-amber-600">({data.provider.error})</span> : null}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-6">
          <ProfileForm
            profile={profile}
            onChange={setProfile}
            onSearch={() => void search(profile, dcapMode)}
            busy={busy}
          />
          {data?.dcap && <DcapPanel meta={data.dcap} />}
          {data && !dcapMode && <MoneyPlan refi={data.refi} />}
          {data && !dcapMode && <PrivateSellerLinks links={data.privateLinks} />}
        </div>

        <div className="space-y-6">
          <AdvisorChat profile={profile} context={contextSummary} />

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {busy && !data && <p className="text-slate-500">Finding cars…</p>}

          {affordable.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-semibold">
                {dcapMode ? "DCAP-eligible cars you can get" : "Cars you can get"}{" "}
                <span className="text-sm font-normal text-slate-500">({affordable.length})</span>
              </h2>
              <div className="space-y-4">
                {affordable.map((r) => (
                  <CarCard key={r.car.id} result={r} dcap={r.dcap} />
                ))}
              </div>
            </section>
          )}

          {stretch.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-semibold text-slate-500">
                {dcapMode ? "Also eligible (a bit more cash)" : "Just out of reach"}{" "}
                <span className="text-sm font-normal">
                  {dcapMode ? "" : "(need more down or a co-signer)"}
                </span>
              </h2>
              <div className="space-y-4 opacity-90">
                {stretch.map((r) => (
                  <CarCard key={r.car.id} result={r} dcap={r.dcap} />
                ))}
              </div>
            </section>
          )}

          {data && affordable.length === 0 && stretch.length === 0 && (
            <p className="text-slate-500">
              {dcapMode
                ? "No DCAP-eligible EV/PHEVs matched. Widen your radius, or call the dealers listed to check their lots."
                : "No matches. Try widening your radius, price, or fuel/body filters."}
            </p>
          )}
        </div>
      </div>

      <footer className="mt-12 border-t border-slate-200 pt-6 text-xs text-slate-400">
        CarMan AI gives estimates, not financial advice. Rates, inventory, and DCAP grant amounts are
        illustrative until live API keys are configured — always confirm eligibility with your DCAP
        caseworker, verify terms with the dealer, and inspect any used car before buying.
      </footer>
    </main>
  );
}
