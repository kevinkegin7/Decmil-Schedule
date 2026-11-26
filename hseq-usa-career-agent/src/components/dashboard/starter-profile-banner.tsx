"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { loadStarterProfileAction } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function StarterProfileBanner() {
  const [pending, startTransition] = useTransition();
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle>Get started</CardTitle>
        <CardDescription>
          Load the starter profile with the details you have already confirmed: Decmil, HSE Advisor, Curtin University
          Occupational Safety and Health degree, NEBOSH and ICAM credentials, and mining, construction, renewable
          energy and infrastructure experience. No dates, certificate numbers or achievements are filled in. Every
          record is flagged for your review, and nothing is marked verified.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 sm:flex-row">
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await loadStarterProfileAction();
              if (r.ok) toast.success(r.message);
              else toast.error(r.message);
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : <Download />} Load starter profile
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard/profile">Start from a blank profile</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
