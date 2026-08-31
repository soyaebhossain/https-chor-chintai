import type { Metadata } from "next";
import RegistryApp from "@/components/registry-app";
import SiteShell from "@/components/site-shell";

export const metadata: Metadata = {
  title: "Verification Console — চোর ছিনতাই",
  description: "রিপোর্ট পর্যালোচনা ও moderation queue-এর ডেমো।",
};

export default function AdminPage() {
  return <SiteShell><RegistryApp initialView="admin" /></SiteShell>;
}
