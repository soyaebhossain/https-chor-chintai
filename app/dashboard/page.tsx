import type { Metadata } from "next";
import RegistryApp from "@/components/registry-app";
import SiteShell from "@/components/site-shell";

export const metadata: Metadata = {
  title: "আমার রিপোর্ট — চোর ছিনতাই",
  description: "জমা দেওয়া পণ্য রিপোর্টের যাচাই ও প্রকাশের অবস্থা দেখুন।",
};

export default function DashboardPage() {
  return <SiteShell><RegistryApp initialView="dashboard" /></SiteShell>;
}
