"use client";

import { useState } from "react";
import { Award, CheckCircle2, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Venue } from "@/lib/types";

const CLOTH_OPTIONS = [
  { value: "simonis_860", label: "Simonis 860" },
  { value: "simonis_760", label: "Simonis 760" },
  { value: "championship_tour", label: "Championship Tour" },
  { value: "standard_felt", label: "Standard felt" },
  { value: "worn_felt", label: "Worn felt" },
];

const POCKET_OPTIONS = [
  { value: "4.5in_pro_cut", label: '4.5" pro cut' },
  { value: "4.75in_standard", label: '4.75" standard' },
  { value: "5in_bar_box", label: '5" bar box' },
  { value: "oversized", label: "Oversized" },
];

const SPACING_OPTIONS = [
  { value: "full_clearance", label: "Full cue clearance" },
  { value: "comfortable", label: "Comfortable" },
  { value: "tight_walls", label: "Tight near walls" },
  { value: "wall_bound", label: "Short cue territory" },
];

const EARNED_BADGES = [
  { name: "Felt Inspector", detail: "5 cloth validations" },
  { name: "Rail Bird", detail: "First pocket-width report" },
  { name: "Corridor Scout", detail: "Validated 3 venues on one trip" },
];

function OptionGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              value === opt.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-transparent text-muted-foreground hover:border-primary/50"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ValidationForm({ venue }: { venue: Venue }) {
  const [cloth, setCloth] = useState<string | null>(venue.cloth_quality);
  const [pockets, setPockets] = useState<string | null>(venue.pocket_widths);
  const [spacing, setSpacing] = useState<string | null>(venue.cue_spacing);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!cloth || !pockets || !spacing) {
      setError("Pick a value for all three metrics before submitting.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        const { data: auth } = await supabase.auth.getUser();
        if (auth.user) {
          const { error: insertError } = await supabase.from("venue_validations").insert({
            venue_id: venue.id,
            user_id: auth.user.id,
            cloth_quality: cloth,
            pocket_widths: pockets,
            cue_spacing: spacing,
          });
          if (insertError) throw new Error(insertError.message);
        }
        // Anonymous visitors on a configured project still get the local
        // demo confirmation rather than a hard auth wall.
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" /> Community validation
        </CardTitle>
        <CardDescription>
          Played here recently? Confirm the real-world conditions — your report feeds the
          venue&apos;s verified metrics and earns contributor badges.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <OptionGroup label="Cloth quality" options={CLOTH_OPTIONS} value={cloth} onChange={setCloth} />
        <OptionGroup label="Pocket widths" options={POCKET_OPTIONS} value={pockets} onChange={setPockets} />
        <OptionGroup
          label="Room clearance / cue spacing"
          options={SPACING_OPTIONS}
          value={spacing}
          onChange={setSpacing}
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        {submitted ? (
          <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-primary" /> Validation recorded — thanks
              for keeping the corridor honest.
            </p>
            <div className="flex flex-wrap gap-2">
              {EARNED_BADGES.map((b) => (
                <Badge key={b.name} variant="accent" title={b.detail}>
                  <Award className="h-3 w-3" /> {b.name}
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit validation"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
