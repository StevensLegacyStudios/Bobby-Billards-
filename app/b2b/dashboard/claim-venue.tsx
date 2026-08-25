"use client";

import { useCallback, useState } from "react";
import { Loader2, Search } from "lucide-react";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface VenueHit {
  id: string;
  name: string;
}

/**
 * "Is this your venue?" search + claim request. There's no automated
 * ownership proof yet (no phone/document verification) — submitting inserts
 * a pending row in venue_claims for manual review. That's a deliberate MVP
 * shortcut: with a handful of claims a week, a human reviewing each one is
 * more trustworthy than a half-built automated check, and it's what
 * actually unlocks the Verified Venue checkout for a real owner.
 */
export function ClaimVenue({ supabase, user }: { supabase: SupabaseClient; user: User }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VenueHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<VenueHit | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (q: string) => {
      setQuery(q);
      setSelected(null);
      if (q.trim().length < 2) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        const { data } = await supabase
          .from("venues")
          .select("id, name")
          .ilike("name", `%${q.trim()}%`)
          .limit(6);
        setResults((data as VenueHit[]) ?? []);
      } finally {
        setSearching(false);
      }
    },
    [supabase]
  );

  const submit = useCallback(async () => {
    if (!selected || contactName.trim().length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: insertError } = await supabase.from("venue_claims").insert({
        venue_id: selected.id,
        requested_by: user.id,
        contact_name: contactName.trim(),
        contact_email: user.email ?? "",
        contact_phone: contactPhone.trim() || null,
        note: note.trim() || null,
      });
      if (insertError) {
        setError(`Couldn't submit that claim: ${insertError.message}`);
        return;
      }
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }, [supabase, selected, user, contactName, contactPhone, note]);

  if (submitted) {
    return (
      <p className="text-sm text-muted-foreground">
        Claim submitted for <strong className="text-foreground">{selected?.name}</strong> — we
        verify ownership by hand and link it to your account, usually within a business day.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative space-y-1.5">
        <Label htmlFor="claim-search">Find your venue</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="claim-search"
            value={query}
            onChange={(e) => void search(e.target.value)}
            placeholder="Start typing your venue's name…"
            className="pl-8"
            autoComplete="off"
          />
        </div>
        {searching && <p className="text-xs text-muted-foreground">Searching…</p>}
        {!selected && results.length > 0 && (
          <ul className="overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
            {results.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-secondary"
                  onClick={() => {
                    setSelected(v);
                    setResults([]);
                    setQuery(v.name);
                  }}
                >
                  {v.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <p className="text-sm">
            Claiming <strong>{selected.name}</strong>
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="claim-name">Your name</Label>
              <Input id="claim-name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="claim-phone" className="text-muted-foreground">
                Phone (optional)
              </Label>
              <Input id="claim-phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="claim-note" className="text-muted-foreground">
              Anything that helps us confirm it&apos;s you (optional)
            </Label>
            <Input
              id="claim-note"
              value={note}
              maxLength={280}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. I'm the owner, reach me at the number on the listing"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={() => void submit()} disabled={submitting || contactName.trim().length === 0}>
            {submitting && <Loader2 className="animate-spin" />} Submit claim
          </Button>
        </div>
      )}
    </div>
  );
}
