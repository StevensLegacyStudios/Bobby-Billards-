"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Crown, Map, Route, Target } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTier } from "@/hooks/use-tier";
import { Badge } from "@/components/ui/badge";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Target },
  { href: "/trip-planner", label: "Trip Planner", icon: Route },
  { href: "/rules", label: "3D Practice", icon: Map },
  { href: "/upgrade", label: "Premium", icon: Crown },
  { href: "/b2b/dashboard", label: "For Business", icon: Briefcase },
];

export function SiteNav() {
  const pathname = usePathname();
  const { isPremium } = useTier();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* Desktop top bar */}
      <header className="sticky top-0 z-40 hidden border-b border-border bg-background/90 backdrop-blur sm:block">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Target className="h-5 w-5 text-primary" />
            Bobby Billiards
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
          </nav>
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur sm:hidden">
        <div className="grid grid-cols-5">
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
        </div>
      </nav>
    </>
  );
}
