import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { markRecoveredAction } from "@/app/actions";
import LinkReportForm from "@/components/link-report-form";
import PageNav, { PageTitle } from "@/components/page-nav";
import SiteShell from "@/components/site-shell";
import { getDb } from "@/db";
import { categoryLabels, formatDate, incidentLabels, statusLabels } from "@/lib/labels";
import { listMyReports } from "@/lib/reports";
import { currentReporterId } from "@/lib/session";

export const metadata: Metadata = {
  title: "আমার রিপোর্ট — চোর ছিনতাই",
  robots: { index: false },
};

export default async function DashboardPage() {
  const reporterId = await currentReporterId();
  const reports = reporterId ? await listMyReports(await getDb(), reporterId) : [];

  return (
    <SiteShell>
      <div className="mx-auto max-w-7xl px-5 py-7 lg:px-8 lg:py-10">
        <PageNav active="dashboard" />
        <PageTitle eyebrow="ব্যক্তিগত ড্যাশবোর্ড" title="আমার রিপোর্টসমূহ" text="এই ডিভাইস থেকে জমা দেওয়া রিপোর্টগুলোর যাচাইয়ের অবস্থা এখানে দেখুন।" />

        {reports.length ? (
          <div className="grid gap-4">
            {reports.map((r) => {
              const s = statusLabels[r.status];
              return (
                <article key={r.id} className="rounded-3xl border border-emerald-950/10 bg-white p-5 shadow-sm">
                  <div className="grid gap-4 md:grid-cols-[1.2fr_1fr_auto] md:items-center">
                    <div>
                      <p className="font-mono text-xs font-bold text-slate-400">{r.trackingId}</p>
                      <h2 className="mt-1 font-black text-emerald-950">{r.brandModel}</h2>
                      <p className="mt-1 text-xs text-slate-500">{categoryLabels[r.category]} · {incidentLabels[r.incidentType]} · {formatDate(r.incidentDate)}</p>
                    </div>
                    <p className="font-mono text-sm text-slate-500">{r.identifierType} •••• {r.last4}</p>
                    <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${s.tone}`}>{s.label}</span>
                  </div>
                  <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                    <p>{r.reviewNote ? <><b className="text-emerald-950">যাচাইকারীর নোট:</b> {r.reviewNote}</> : s.help}</p>
                    {["PENDING", "NEEDS_INFO", "APPROVED"].includes(r.status) ? (
                      <form action={markRecoveredAction}>
                        <input type="hidden" name="reportId" value={r.id} />
                        <button className="whitespace-nowrap rounded-xl border border-emerald-900/15 px-4 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-50">পণ্য ফেরত পেয়েছি</button>
                      </form>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-emerald-950/15 bg-white p-10 text-center">
            <ShieldAlert className="mx-auto size-10 text-emerald-700" aria-hidden />
            <p className="mt-3 font-bold text-emerald-950">এই ডিভাইস থেকে এখনো কোনো রিপোর্ট জমা হয়নি।</p>
            <Link href="/report" className="mt-5 inline-block rounded-xl bg-emerald-900 px-5 py-3 text-sm font-bold text-white">রিপোর্ট করুন</Link>
          </div>
        )}

        <section className="mt-10 rounded-3xl bg-[#eef3e8] p-6">
          <h2 className="font-black text-emerald-950">অন্য ফোন বা ব্রাউজার থেকে রিপোর্ট করেছিলেন?</h2>
          <p className="mb-4 mt-1 text-sm text-slate-600">Tracking ID ও রিপোর্টে দেওয়া মোবাইল নম্বর দিলে রিপোর্টটি এখানে দেখাবে।</p>
          <LinkReportForm />
        </section>
      </div>
    </SiteShell>
  );
}
