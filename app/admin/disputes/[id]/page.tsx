import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, FileText } from "lucide-react";
import { decideDisputeAction } from "@/app/admin/actions";
import { formatDate, Title } from "@/components/page-bits";
import PageFrame from "@/components/page-frame";
import { INCIDENT_LABEL } from "@/lib/report-schema";
import { requireStaff } from "@/lib/server/auth";
import { logStaffAccess } from "@/lib/server/claims";
import { disputeForReview } from "@/lib/server/disputes";

export const metadata: Metadata = { title: "আপত্তি পর্যালোচনা — চোর ছিনতাই", robots: { index: false, follow: false } };

export default async function DisputeReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const session = await requireStaff(`/admin/disputes/${id}`);
  const data = await disputeForReview(id);
  if (!data) notFound();
  const { error } = await searchParams;
  const { dispute, claim, product } = data;
  await logStaffAccess(session.user.id, "DISPUTE_VIEWED", "claim", claim.id, { disputeId: dispute.id });

  const open = dispute.status === "OPEN" || dispute.status === "UNDER_REVIEW";
  const involved = dispute.raisedBy === session.user.id || claim.reporterId === session.user.id;
  const [reason, ...details] = dispute.reason.split("\n\n");
  const card = "rounded-3xl border border-emerald-950/10 bg-white p-6";

  return <PageFrame active="admin">
    <Link href="/admin" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-emerald-700"><ArrowLeft className="size-4" /> সারিতে ফিরুন</Link>
    <Title eyebrow={`APL-${dispute.id.slice(0, 8).toUpperCase()} · ${claim.trackingId}`} title={`আপত্তি: ${product.brand} ${product.model}`} text={`জমা: ${formatDate(dispute.createdAt)} · অবস্থা: ${dispute.status}`} />
    {error && <p role="alert" className="mb-5 flex gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800"><AlertTriangle className="size-5 shrink-0" />{error}</p>}

    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="grid content-start gap-6">
        <section className={card}>
          <h2 className="font-black text-emerald-950">আপত্তিকারীর বক্তব্য</h2>
          <p className="mt-3 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{reason}</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{details.join("\n\n")}</p>
          <p className="mt-3 text-xs text-slate-500">আপত্তিকারী: {data.disputerEmail} (রিপোর্টকারীকে জানানো হয় না)</p>
          <h3 className="mt-5 text-sm font-black text-emerald-950">আপত্তিকারীর প্রমাণ ({data.documents.length.toLocaleString("bn-BD")})</h3>
          {data.documents.length === 0 ? <p className="mt-2 text-sm text-amber-700">কোনো ফাইল দেওয়া হয়নি।</p> :
            <ul className="mt-2 grid gap-2">{data.documents.map((d, i) => <li key={d.id}><a href={`/admin/documents/${d.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold hover:bg-emerald-50"><FileText className="size-4 text-emerald-700" />ফাইল {(i + 1).toLocaleString("bn-BD")} · {d.mimeType.split("/")[1].toUpperCase()}</a></li>)}</ul>}
        </section>
        <section className={card}>
          <h2 className="font-black text-emerald-950">মূল রিপোর্ট</h2>
          <p className="mt-3 text-sm leading-7">{INCIDENT_LABEL[claim.incidentType]} · {formatDate(claim.incidentAt)} · {claim.location}<br />জিডি: {claim.policeReference ?? "দেওয়া হয়নি"}</p>
          <Link href={`/admin/claims/${claim.id}`} className="mt-3 inline-block text-sm font-bold text-emerald-700">রিপোর্টকারীর প্রমাণ ও পুরো ইতিহাস দেখুন →</Link>
        </section>
      </div>

      <section className={`${card} content-start`}>
        <h2 className="font-black text-emerald-950">সিদ্ধান্ত</h2>
        {!open ? <p className="mt-3 text-sm text-slate-600">সিদ্ধান্ত হয়ে গেছে: {dispute.status}{dispute.resolutionNote ? ` — ${dispute.resolutionNote}` : ""}</p>
          : involved ? <p className="mt-3 text-sm font-bold text-amber-800">যে বিষয়ে আপনি নিজে পক্ষ, তার সিদ্ধান্ত আপনি নিতে পারবেন না।</p>
          : <form action={decideDisputeAction} className="mt-4 grid gap-4">
            <input type="hidden" name="disputeId" value={dispute.id} />
            <fieldset className="grid gap-2 text-sm">
              <legend className="sr-only">সিদ্ধান্ত</legend>
              {dispute.status === "OPEN" && <label className="flex items-start gap-3 rounded-xl border border-amber-200 p-3 has-[:checked]:bg-amber-50"><input type="radio" name="decision" value="UNDER_REVIEW" required className="mt-1 accent-amber-600" /><span><b>প্রাথমিকভাবে যুক্তিসঙ্গত</b><br /><span className="text-slate-500">সার্চে “আপত্তি পর্যালোচনাধীন” দেখাবে; চূড়ান্ত সিদ্ধান্ত পরে।</span></span></label>}
              <label className="flex items-start gap-3 rounded-xl border border-emerald-200 p-3 has-[:checked]:bg-emerald-50"><input type="radio" name="decision" value="UPHOLD" required className="mt-1 accent-emerald-700" /><span><b>আপত্তি সঠিক — রিপোর্ট সরান</b><br /><span className="text-slate-500">রিপোর্ট প্রত্যাখ্যাত হবে ও সার্চ থেকে সরবে।</span></span></label>
              <label className="flex items-start gap-3 rounded-xl border border-red-200 p-3 has-[:checked]:bg-red-50"><input type="radio" name="decision" value="DISMISS" className="mt-1 accent-red-600" /><span><b>আপত্তি খারিজ</b><br /><span className="text-slate-500">রিপোর্ট বহাল থাকবে।</span></span></label>
            </fieldset>
            <label className="text-sm font-bold text-emerald-950">কারণ <span className="font-normal text-slate-500">(চূড়ান্ত সিদ্ধান্তে বাধ্যতামূলক; উভয় পক্ষকে ইমেইলে যাবে)</span>
              <textarea name="note" rows={4} maxLength={2000} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-emerald-600" /></label>
            <button className="rounded-xl bg-emerald-900 px-5 py-3 text-sm font-black text-white">সিদ্ধান্ত সংরক্ষণ করুন</button>
          </form>}
      </section>
    </div>
  </PageFrame>;
}
