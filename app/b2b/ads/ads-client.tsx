"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Gavel, MousePointerClick, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DEMO_CAMPAIGNS } from "@/lib/demo-data";
import type { AdCampaign } from "@/lib/types";

interface ClickReceipt {
  campaignId: string;
  chargedCents: number;
  campaignStatus: string;
  clearingRule: string;
}

export function AdsClient() {
  const [campaigns, setCampaigns] = useState<AdCampaign[]>(DEMO_CAMPAIGNS);
  const [receipts, setReceipts] = useState<ClickReceipt[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const updateBid = (id: string, bidDollars: number) => {
    setCampaigns((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, bid_cpc_cents: Math.max(1, Math.round(bidDollars * 100)) } : c
      )
    );
  };

  const togglePause = (id: string) => {
    setCampaigns((prev) =>
      prev.map((c) =>
        c.id === id && c.status !== "budget_exhausted"
          ? { ...c, status: c.status === "active" ? "paused" : "active" }
          : c
      )
    );
  };

  const simulateClick = async (campaign: AdCampaign) => {
    setBusyId(campaign.id);
    try {
      const res = await fetch("/api/ads/click-track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: campaign.id,
          routeContext: "Stockton → San Jose (simulated)",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setReceipts((prev) => [
          {
            campaignId: campaign.id,
            chargedCents: data.chargedCents,
            campaignStatus: data.campaignStatus,
            clearingRule: data.clearingRule,
          },
          ...prev.slice(0, 7),
        ]);
        setCampaigns((prev) =>
          prev.map((c) =>
            c.id === campaign.id
              ? {
                  ...c,
                  spent_today_cents: c.spent_today_cents + data.chargedCents,
                  status: data.campaignStatus,
                }
              : c
          )
        );
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/b2b/dashboard"
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Merchant portal
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Gavel className="h-6 w-6 text-primary" /> Contextual CPC Boosting
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verified venues bid for the sponsored highlight on driving routes that intersect
          their corridor. Clicks clear at second price + 1¢ and post to the click ledger via{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">/api/ads/click-track</code>.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {campaigns.map((campaign) => {
            const budgetPct = Math.min(
              100,
              (campaign.spent_today_cents / campaign.daily_budget_cents) * 100
            );
            return (
              <Card key={campaign.id}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                    {campaign.venue_name}
                    <Badge
                      variant={
                        campaign.status === "active"
                          ? "default"
                          : campaign.status === "paused"
                            ? "outline"
                            : "destructive"
                      }
                    >
                      {campaign.status.replaceAll("_", " ")}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Daily budget ${(campaign.daily_budget_cents / 100).toFixed(2)} · spent $
                    {(campaign.spent_today_cents / 100).toFixed(2)} today
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full ${budgetPct >= 100 ? "bg-destructive" : "bg-primary"}`}
                      style={{ width: `${budgetPct}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      Max CPC bid $
                      <Input
                        type="number"
                        step="0.05"
                        min="0.01"
                        value={(campaign.bid_cpc_cents / 100).toFixed(2)}
                        onChange={(e) => updateBid(campaign.id, Number(e.target.value) || 0.01)}
                        className="w-24"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => togglePause(campaign.id)}
                      disabled={campaign.status === "budget_exhausted"}
                    >
                      {campaign.status === "active" ? "Pause" : "Resume"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => simulateClick(campaign)}
                      disabled={busyId === campaign.id || campaign.status !== "active"}
                    >
                      <MousePointerClick />
                      {busyId === campaign.id ? "Charging…" : "Simulate consumer click"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Click ledger</CardTitle>
            <CardDescription>Most recent PPC transactions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {receipts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No clicks yet — simulate one to watch the second-price auction clear.
              </p>
            ) : (
              receipts.map((r, i) => {
                const campaign = campaigns.find((c) => c.id === r.campaignId);
                return (
                  <div key={i} className="rounded-md border border-border p-2 text-xs">
                    <div className="flex justify-between font-medium">
                      <span>{campaign?.venue_name ?? r.campaignId}</span>
                      <span>${(r.chargedCents / 100).toFixed(2)}</span>
                    </div>
                    <p className="mt-0.5 text-muted-foreground">
                      {r.clearingRule} → {r.campaignStatus.replaceAll("_", " ")}
                    </p>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
