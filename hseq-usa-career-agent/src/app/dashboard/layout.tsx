import { Suspense } from "react";
import { MobileNav, SidebarNav } from "@/components/dashboard/nav";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { UserMenu } from "@/components/dashboard/user-menu";
import { Skeleton } from "@/components/ui/card";

// The shell is static; only the user area and page content read the session.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <SidebarNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur sm:px-6">
          <MobileNav />
          <p className="text-sm font-semibold lg:hidden">HSEQ USA Career Agent</p>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Suspense fallback={<Skeleton className="h-8 w-40" />}>
              <UserMenu />
            </Suspense>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
