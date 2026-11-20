import { RegistryNav } from "@/components/page-bits";
import SiteShell from "@/components/site-shell";
import { getSession, isStaff } from "@/lib/server/auth";

export default async function PageFrame({ active, children }: { active?: "search" | "report" | "dashboard" | "admin"; children: React.ReactNode }) {
  const session = await getSession();
  return <SiteShell>
    <div className="mx-auto max-w-7xl px-5 py-7 lg:px-8 lg:py-10">
      {active && <RegistryNav active={active} showAdmin={session ? isStaff(session.user.role) : false} />}
      {children}
    </div>
  </SiteShell>;
}
