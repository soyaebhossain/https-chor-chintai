import type { Metadata } from "next";
import DisputeForm from "@/components/dispute-form";
import { Title } from "@/components/page-bits";
import PageFrame from "@/components/page-frame";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = {
  title: "রিপোর্টের বিরুদ্ধে আপত্তি — চোর ছিনতাই",
  description: "ভুল রিপোর্টের বিরুদ্ধে প্রমাণসহ আপিল করুন।",
  robots: { index: false },
};

export default async function DisputePage() {
  await requireUser("/dispute");
  return <PageFrame>
    <section className="mx-auto max-w-3xl">
      <Title eyebrow="আপিল" title="রিপোর্টটি ভুল? আপত্তি জানান" text="কোনো রিপোর্ট মানেই অপরাধ প্রমাণিত নয়। আপনি পণ্যটি বৈধভাবে কিনে থাকলে বা রিপোর্টটি ভুল হলে প্রমাণসহ জানান—একজন যাচাইকারী উভয় পক্ষ দেখে সিদ্ধান্ত নেবেন। আপনার পরিচয় রিপোর্টকারীকে জানানো হবে না।" />
      <DisputeForm />
    </section>
  </PageFrame>;
}
