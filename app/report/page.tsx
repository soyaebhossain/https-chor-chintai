import type { Metadata } from "next";
import { Title } from "@/components/page-bits";
import PageFrame from "@/components/page-frame";
import ReportForm from "@/components/report-form";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = {
  title: "পণ্য রিপোর্ট করুন — চোর ছিনতাই",
  description: "চুরি, ছিনতাই বা হারানো পণ্যের তথ্য ও মালিকানার প্রমাণ জমা দিন।",
};

export default async function ReportPage() {
  await requireUser("/report");
  return <PageFrame active="report">
    <section className="mx-auto max-w-4xl">
      <Title eyebrow="নতুন দাবি" title="চুরি বা ছিনতাই হওয়া পণ্য রিপোর্ট করুন" text="তথ্য জমা দেওয়ার পর একজন যাচাইকারী আপনার প্রমাণ পর্যালোচনা করবেন। অনুমোদনের আগে কিছুই প্রকাশ হবে না।" />
      <ReportForm />
    </section>
  </PageFrame>;
}
