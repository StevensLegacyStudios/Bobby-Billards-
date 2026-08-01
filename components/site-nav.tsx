"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Crown, Crosshair, Route, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTier } from "@/hooks/use-tier";
import { Badge } from "@/components/ui/badge";

/** The 8-ball mark. */
function EightBall({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <radialGradient id="bb8" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#3f3f46" />
          <stop offset="55%" stopColor="#18181b" />
          <stop offset="100%" stopColor="#09090b" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="url(#bb8)" stroke="#52525b" strokeWidth="1" />
      <circle cx="16" cy="13.5" r="7" fill="#fafafa" />
      <text
        x="16"
        y="17.6"
        textAnchor="middle"
        fontSize="10.5"
        fontWeight="800"
        fill="#09090b"
        fontFamily="system-ui"
      >
        8
      </text>
      <ellipse cx="11.5" cy="8" rx="3.4" ry="2" fill="#ffffff" opacity="0.35" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: null },
  { href: "/trip-planner", label: "Trips", icon: Route },
  { href: "/rules", label: "Shot Lab", icon: Crosshair },
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
      <header className="sticky top-0 z-40 hidden border-b border-border/70 bg-background/85 backdrop-blur-md sm:block">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="group flex items-center gap-2.5 font-bold tracking-tight">
            <EightBall className="h-8 w-8 transition-transform duration-300 group-hover:rotate-[30deg]" />
            <span className="text-lg">
              Buddy<span className="text-primary"> Billiards</span>
            </span>
            {isPremium && <Badge variant="accent">Premium</Badge>}
          </Link>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.slice(1).map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive(href)
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                )}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {label}
              </Link>
            ))}
            <Link
              href="/account"
              aria-label="Account"
              className={cn(
                "ml-2 flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
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
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur-md sm:hidden">
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
              {Icon ? <Icon className="h-5 w-5" /> : <EightBall className="h-5 w-5" />}
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
