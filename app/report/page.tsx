import type { Metadata } from "next";
import PageNav, { PageTitle } from "@/components/page-nav";
import ReportForm from "@/components/report-form";
import SiteShell from "@/components/site-shell";

export const metadata: Metadata = {
  title: "চুরি বা ছিনতাই রিপোর্ট করুন — চোর ছিনতাই",
  description: "চুরি, ছিনতাই বা হারানো মোবাইল, ল্যাপটপ, বাইক ও গাড়ির IMEI/Serial/VIN রিপোর্ট করুন।",
  alternates: { canonical: "/report" },
};

export default function ReportPage() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-7xl px-5 py-7 lg:px-8 lg:py-10">
        <PageNav active="report" />
        <section className="mx-auto max-w-4xl">
          <PageTitle eyebrow="নতুন রিপোর্ট" title="চুরি বা ছিনতাই হওয়া পণ্য রিপোর্ট করুন" text="জমা দেওয়ার পর একজন যাচাইকারী প্রমাণ দেখবেন। অনুমোদনের আগে কোনো তথ্য public হবে না, আর আপনার নাম বা ফোন নম্বর কখনো প্রকাশ হবে না।" />
          <ReportForm />
        </section>
      </div>
    </SiteShell>
  );
}
