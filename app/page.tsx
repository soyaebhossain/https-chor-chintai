import Landing from "@/components/landing";
import { RegistryNav } from "@/components/page-bits";
import SiteShell from "@/components/site-shell";
import { getSession, isStaff } from "@/lib/server/auth";
import { recentAlerts, registryStats } from "@/lib/server/claims";

// Reads the session cookie and live alerts on every request; never prerender at build time.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [session, alerts, stats] = await Promise.all([getSession(), recentAlerts(3), registryStats()]);
  return <SiteShell>
    <div id="registry" className="mx-auto max-w-7xl scroll-mt-28 px-5 py-7 lg:px-8 lg:py-10">
      <RegistryNav active="search" showAdmin={session ? isStaff(session.user.role) : false} />
      <Landing alerts={alerts} stats={stats} />
    </div>
  </SiteShell>;
}
