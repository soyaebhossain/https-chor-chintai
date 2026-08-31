import RegistryApp from "@/components/registry-app";
import SiteShell from "@/components/site-shell";

export default function Home() {
  return <SiteShell><RegistryApp initialView="search" /></SiteShell>;
}
