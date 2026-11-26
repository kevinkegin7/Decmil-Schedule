import Link from "next/link";
import { LogOut, PauseCircle } from "lucide-react";
import { requireUser } from "@/lib/security/auth";
import { getProfile } from "@/services/profile.service";
import { getControls } from "@/services/settings.service";
import { logoutAction } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";

/** Signed-in user area in the top bar. Reads the session, so it streams in. */
export async function UserMenu() {
  const { supabase, userId, email } = await requireUser();
  const [profile, controls] = await Promise.all([getProfile(supabase, userId), getControls(supabase, userId)]);
  const name = profile?.full_name?.trim() || email || "Account";
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const paused = controls?.agents_paused || controls?.outbound_paused;

  return (
    <div className="flex items-center gap-2">
      {paused && (
        <Link
          href="/dashboard/settings"
          className="hidden items-center gap-1.5 rounded-md bg-warning/20 px-2.5 py-1 text-xs font-medium text-warning-foreground sm:inline-flex dark:text-warning"
        >
          <PauseCircle className="size-3.5" /> Emergency pause on
        </Link>
      )}
      <div className="hidden text-right leading-tight sm:block">
        <p className="text-sm font-medium" data-testid="user-name">{name}</p>
        {profile?.current_job_title && <p className="text-xs text-muted-foreground">{profile.current_job_title}</p>}
      </div>
      <div aria-hidden className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
        {initials || "?"}
      </div>
      <form action={logoutAction}>
        <Button type="submit" variant="ghost" size="sm" aria-label="Sign out">
          <LogOut /> <span className="hidden md:inline">Sign out</span>
        </Button>
      </form>
    </div>
  );
}
