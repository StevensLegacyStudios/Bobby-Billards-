"use client";

import { useState } from "react";
import { LogOut, Mail, UserRound } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useTier } from "@/hooks/use-tier";

type Mode = "sign_in" | "sign_up";

export function AccountClient() {
  const { supabase, user, loading, configured } = useAuth();
  const { isPremium } = useTier();

  const [mode, setMode] = useState<Mode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!configured) {
    return (
      <div className="mx-auto max-w-md pt-10">
        <Card>
          <CardHeader>
            <CardTitle>Accounts unavailable</CardTitle>
            <CardDescription>
              This environment has no database configured, so sign-in is disabled. The rest
              of the app works in demo mode.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <div className="py-20 text-center text-muted-foreground">Loading account…</div>;
  }

  if (user) {
    return (
      <div className="mx-auto max-w-md space-y-4 pt-10">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-primary" /> Signed in
            </CardTitle>
            <CardDescription className="break-all">{user.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Badge variant={isPremium ? "accent" : "secondary"}>
                {isPremium ? "Premium" : "Free tier"}
              </Badge>
              {user.email_confirmed_at ? (
                <Badge variant="outline">Email confirmed</Badge>
              ) : (
                <Badge variant="destructive">Email unconfirmed — check your inbox</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Your venue validations now publish under this account, and your contributor
              badges stick.
            </p>
            <Button
              variant="outline"
              onClick={async () => {
                await supabase!.auth.signOut();
              }}
            >
              <LogOut /> Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const submit = async () => {
    setError(null);
    setNotice(null);
    if (!email || password.length < 6) {
      setError("Enter your email and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "sign_up") {
        const { data, error: err } = await supabase!.auth.signUp({ email, password });
        if (err) throw err;
        if (!data.session) {
          setNotice("Account created — check your email for a confirmation link, then come back and sign in.");
        }
      } else {
        const { error: err } = await supabase!.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-4 pt-10">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            {mode === "sign_in" ? "Sign in" : "Create your account"}
          </CardTitle>
          <CardDescription>
            {mode === "sign_in"
              ? "Welcome back. Your validations and trips are waiting."
              : "Free forever. Validate venues, earn badges, save trips."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {notice && (
            <p className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">{notice}</p>
          )}

          <Button className="w-full" onClick={submit} disabled={busy}>
            {busy ? "One sec…" : mode === "sign_in" ? "Sign in" : "Sign up"}
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => {
              setMode(mode === "sign_in" ? "sign_up" : "sign_in");
              setError(null);
              setNotice(null);
            }}
          >
            {mode === "sign_in" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
