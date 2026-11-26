import { Suspense } from "react";
import type { Metadata } from "next";
import { Lock, LogOut } from "lucide-react";
import { requireUser } from "@/lib/security/auth";
import { getControls, listAuditEvents } from "@/services/settings.service";
import { getPreferences } from "@/services/preferences.service";
import { EMAIL_PROVIDERS } from "@/lib/config/reference-data";
import { formatDateTime } from "@/lib/utils/format";
import { logoutAction } from "@/app/dashboard/actions";
import { PageHeader, PageSkeleton } from "@/components/dashboard/page-header";
import { ThemeSelect } from "@/components/dashboard/theme-toggle";
import { EmergencyPauseControl, VerifyAuditButton } from "@/components/settings/settings-panels";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Appearance, safety controls, account and audit log." />
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Light, dark, or follow your device.</CardDescription>
          </CardHeader>
          <CardContent><ThemeSelect /></CardContent>
        </Card>
        <Suspense fallback={<PageSkeleton rows={3} />}>
          <SettingsContent />
        </Suspense>
      </div>
    </>
  );
}

const ACTION_LABELS: Record<string, string> = {
  "app.auth.signed_in": "Signed in",
  "app.auth.signed_out": "Signed out",
  "app.profile.starter_loaded": "Starter profile loaded",
  "app.evidence.uploaded": "Evidence uploaded",
  "app.evidence.removed": "Evidence removed",
};

function describe(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  const [table, op] = action.split(".");
  const noun = table.replace(/_/g, " ");
  return `${noun.charAt(0).toUpperCase()}${noun.slice(1)} ${op === "insert" ? "added" : op === "update" ? "updated" : op === "delete" ? "deleted" : op}`;
}

async function SettingsContent() {
  const { supabase, userId, email } = await requireUser();
  const [controls, prefs, events] = await Promise.all([
    getControls(supabase, userId),
    getPreferences(supabase, userId),
    listAuditEvents(supabase, userId, 30),
  ]);
  const provider = EMAIL_PROVIDERS.find((p) => p.code === prefs?.preferred_email_provider)?.label ?? "Not set";

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Emergency pause</CardTitle>
          <CardDescription>Immediately stops all agents and outbound email. Only you can resume.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmergencyPauseControl paused={!!(controls?.agents_paused || controls?.outbound_paused)} reason={controls?.pause_reason ?? null} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">External communications <Badge variant="secondary"><Lock /> Disabled</Badge></CardTitle>
          <CardDescription>
            No email account is connected and nothing can be sent. The database blocks enabling external
            communications in Milestone 1. Preferred provider: {provider} (integration planned for Milestone 4,
            after your approval).
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Signed in as {email}. New sign-ups are disabled.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={logoutAction}>
            <Button type="submit" variant="outline"><LogOut /> Sign out</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-end justify-between gap-2">
          <div>
            <CardTitle>Audit log</CardTitle>
            <CardDescription>Every change to your records, newest first. Entries cannot be edited or deleted.</CardDescription>
          </div>
          <VerifyAuditButton />
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ol className="divide-y text-sm" data-testid="audit-log">
              {events.map((e) => {
                const changed = (e.details as { changed_fields?: string[] } | null)?.changed_fields;
                return (
                  <li key={e.id} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-baseline sm:gap-4">
                    <span className="w-44 shrink-0 text-xs text-muted-foreground tabular-nums">{formatDateTime(e.created_at)}</span>
                    <span className="font-medium">{describe(e.action)}</span>
                    {changed && changed.length > 0 && (
                      <span className="text-xs text-muted-foreground">{changed.map((f) => f.replace(/_/g, " ")).join(", ")}</span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </>
  );
}
