"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Crown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTier } from "@/hooks/use-tier";
import { PREMIUM_PRICE_USD } from "@/lib/tier";

const FREE_FEATURES = [
  "3 AI shot uploads per month",
  "Basic text venue directories",
  "Route search up to 10-mile detours",
];

const PREMIUM_FEATURES = [
  "Unlimited AI shot uploads",
  "Full route detours (up to 60 miles)",
  "Unlimited 3D practice layouts",
  "Pro camera modules",
  "Offline corridor & map downloads (IndexedDB sync)",
];

export function UpgradeClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { tier, isPremium, refresh } = useTier();
  const [loading, setLoading] = useState(false);

  const success = searchParams.get("success");

  const checkout = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "premium" }),
      });
      const data = await res.json();
      if (data.url?.startsWith("http")) {
        window.location.href = data.url;
      } else {
        refresh();
        router.replace(data.url ?? "/upgrade?success=demo");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">Membership</h1>
        <p className="text-muted-foreground">
          One tier for the casual Tuesday-night player, one for the road warrior.
        </p>
        {(success || isPremium) && (
          <Badge variant="accent" className="mx-auto">
            <Crown className="h-3 w-3" />
            {success === "demo"
              ? "Premium activated (demo grant — no Stripe keys configured)"
              : "Premium active"}
          </Badge>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Free</CardTitle>
            <CardDescription>
              <span className="text-2xl font-bold text-foreground">$0</span> forever
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> {f}
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" disabled>
              {tier === "free" ? "Current plan" : "Included"}
            </Button>
          </CardFooter>
        </Card>

        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Premium <Crown className="h-4 w-4 text-accent-foreground" />
            </CardTitle>
            <CardDescription>
              <span className="text-2xl font-bold text-foreground">
                ${PREMIUM_PRICE_USD.toFixed(2)}
              </span>
              /month
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {PREMIUM_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {f}
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={checkout} disabled={loading || isPremium}>
              {isPremium ? "You're Premium" : loading ? "Redirecting…" : "Upgrade with Stripe"}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Subscriptions are provisioned via Stripe Billing webhooks
        (`/api/webhooks/stripe`). Cancel anytime — entitlements downgrade automatically on
        the `customer.subscription.deleted` event.
      </p>
    </div>
  );
}
