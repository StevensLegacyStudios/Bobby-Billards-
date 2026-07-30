"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Crown, Map, Route, Target, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTier } from "@/hooks/use-tier";
import { Badge } from "@/components/ui/badge";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Target },
  { href: "/trip-planner", label: "Trips", icon: Route },
  { href: "/rules", label: "Practice", icon: Map },
  { href: "/upgrade", label: "Premium", icon: Crown },
  { href: "/b2b/dashboard", label: "Business", icon: Briefcase },
];

export function SiteNav() {
  const pathname = usePathname();
  const { isPremium } = useTier();
  const { user } = useAuth();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const accountLabel = user?.email ? user.email[0]!.toUpperCase() : null;

  return (
    <>
      {/* Desktop top bar */}
      <header className="sticky top-0 z-40 hidden border-b border-border bg-background/90 backdrop-blur sm:block">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Target className="h-5 w-5 text-primary" />
            Buddy Billiards
            {isPremium && <Badge variant="accent">Premium</Badge>}
          </Link>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.slice(1).map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive(href)
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
            <Link
              href="/account"
              aria-label="Account"
              className={cn(
                "ml-1 flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                isActive("/account")
                  ? "border-primary bg-primary text-primary-foreground"
                  : accountLabel
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
              )}
            >
              {accountLabel ?? <UserRound className="h-4 w-4" />}
            </Link>
          </nav>
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur sm:hidden">
        <div className="grid grid-cols-6">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
                isActive(href) ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
          <Link
            href="/account"
            className={cn(
              "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
              isActive("/account") ? "text-primary" : "text-muted-foreground"
            )}
          >
            <UserRound className="h-5 w-5" />
            {accountLabel ? "Account" : "Sign in"}
          </Link>
        </div>
      </nav>
    </>
  );
}
