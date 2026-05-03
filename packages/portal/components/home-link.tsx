"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home } from "lucide-react";

/**
 * A small "Home" affordance shown in the top-left of every (app) page
 * EXCEPT the landing page itself. The chat sidebar's company-name link
 * already routes to /, but a dedicated pill makes the way-back obvious
 * from deep pages (system queues, admin sub-pages, candidate detail).
 */
export function HomeLink() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <div className="sticky top-0 z-30 px-6 pt-4 pb-2 pointer-events-none">
      <Link
        href="/"
        className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-border bg-card/90 backdrop-blur px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-card shadow-sm transition-colors"
        title="Back to home"
      >
        <Home className="size-3.5" />
        <span>Home</span>
      </Link>
    </div>
  );
}
