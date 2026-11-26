"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Award, Briefcase, Gauge, Menu, Settings, ShieldCheck, SlidersHorizontal, UserRound, Wrench,
} from "lucide-react";
import { Dialog, DialogTrigger, SheetContent } from "@/components/ui/dialog";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "@/lib/utils/format";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: Gauge },
  { href: "/dashboard/profile", label: "My Career Profile", icon: UserRound },
  { href: "/dashboard/employment", label: "Employment History", icon: Briefcase },
  { href: "/dashboard/qualifications", label: "Qualifications", icon: Award },
  { href: "/dashboard/skills", label: "Skills & Competencies", icon: Wrench },
  { href: "/dashboard/preferences", label: "Recruitment Preferences", icon: SlidersHorizontal },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-5">
      <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-accent">
        <ShieldCheck className="size-4" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold">HSEQ USA</p>
        <p className="text-xs text-sidebar-muted">Career Agent</p>
      </div>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5 px-2">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
              active && "bg-sidebar-accent font-medium text-sidebar-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SidebarNav() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
      <Brand />
      <NavLinks />
      <p className="mt-auto px-4 py-4 text-xs text-sidebar-muted">Milestone 1 · Profile foundation</p>
    </aside>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="inline-flex size-9 items-center justify-center rounded-md hover:bg-accent lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </DialogTrigger>
      <SheetContent aria-describedby={undefined}>
        <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
        <Brand />
        <NavLinks onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Dialog>
  );
}
