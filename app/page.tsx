import Home from "@/components/home";
import PageNav from "@/components/page-nav";
import SiteShell from "@/components/site-shell";
import { getDb } from "@/db";
import { recentPublicAlerts, registryStats } from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const db = await getDb();
  const [alerts, stats] = await Promise.all([recentPublicAlerts(db), registryStats(db)]);
  return (
    <SiteShell>
      <div id="registry" className="mx-auto max-w-7xl scroll-mt-28 px-5 py-7 lg:px-8 lg:py-10">
        <PageNav active="search" />
        <Home alerts={alerts} stats={stats} />
      </div>
    </SiteShell>
  );
}
