import type { PrivateSellerLink } from "@/lib/privateLinks";

export function PrivateSellerLinks({ links }: { links: PrivateSellerLink[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Search private sellers</h2>
      <p className="mt-1 text-sm text-slate-500">
        These marketplaces don&apos;t offer a data feed, so CarMan opens a search pre-filtered to your
        criteria. Always inspect a private-party car before paying.
      </p>
      <div className="mt-4 space-y-2">
        {links.map((l) => (
          <a
            key={l.name}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 hover:border-brand hover:bg-slate-50"
          >
            <div>
              <div className="font-medium text-slate-800">{l.name}</div>
              <div className="text-xs text-slate-500">{l.note}</div>
            </div>
            <span className="text-brand">→</span>
          </a>
        ))}
      </div>
    </div>
  );
}
