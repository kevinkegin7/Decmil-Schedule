"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const ORDER = ["light", "dark", "system"] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // next-themes only knows the theme after hydration.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const current = mounted ? ((theme as (typeof ORDER)[number]) ?? "system") : "system";
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const Icon = current === "light" ? Sun : current === "dark" ? Moon : Monitor;

  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(next)} aria-label={`Theme: ${current}. Switch to ${next}`} title={`Theme: ${current}`}>
      <Icon />
    </Button>
  );
}

export function ThemeSelect() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-md border p-0.5">
      {ORDER.map((t) => {
        const active = mounted && (theme ?? "system") === t;
        return (
          <button
            key={t}
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(t)}
            className={`rounded px-3 py-1.5 text-sm capitalize ${active ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}
