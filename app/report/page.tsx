import type { Metadata } from "next";
import RegistryApp from "@/components/registry-app";
import SiteShell from "@/components/site-shell";

export const metadata: Metadata = {
  title: "পণ্য রিপোর্ট করুন — চোর ছিনতাই",
  description: "চুরি, ছিনতাই বা হারানো পণ্যের তথ্য ও মালিকানার প্রমাণ জমা দিন।",
};

export default function ReportPage() {
  return <SiteShell><RegistryApp initialView="report" /></SiteShell>;
}
