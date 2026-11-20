import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, FileText, ShieldAlert } from "lucide-react";
import { decideAction } from "@/app/admin/actions";
import { formatDate, Title } from "@/components/page-bits";
import PageFrame from "@/components/page-frame";
import { INCIDENT_LABEL } from "@/lib/report-schema";
import { requireStaff } from "@/lib/server/auth";
import { claimForReview, logStaffAccess, riskLabel } from "@/lib/server/claims";
import { decryptField } from "@/lib/server/crypto";
import { getEnv } from "@/lib/server/env";

export const metadata: Metadata = { title: "রিপোর্ট পর্যালোচনা — চুরি-ছিন্তাই", robots: { index: false, follow: false } };

const ACTION_LABEL: Record<string, string> = {
  CLAIM_SUBMITTED: "রিপোর্ট জমা",
  CLAIM_INFO_ADDED: "রিপোর্টকারী তথ্য যোগ করেছেন",
  CLAIM_APPROVED: "অনুমোদিত",
  CLAIM_REJECTED: "প্রত্যাখ্যাত",
  CLAIM_NEEDS_INFO: "আরও তথ্য চাওয়া হয়েছে",
  IDENTIFIER_VIEWED: "পূর্ণ নম্বর দেখা হয়েছে",
  DOCUMENT_VIEWED: "প্রমাণ ফাইল খোলা হয়েছে",
  CLAIM_RECOVERED: "মালিক পণ্য ফেরত পেয়েছেন — সতর্কতা সরানো হয়েছে",
  DISPUTE_FILED: "আপত্তি জমা পড়েছে",
  DISPUTE_VIEWED: "আপত্তি দেখা হয়েছে",
  DISPUTE_UNDER_REVIEW: "আপত্তি পর্যালোচনাধীন ঘোষণা",
  DISPUTE_UPHOLD: "আপত্তি গৃহীত — রিপোর্ট সরানো হয়েছে",
  DISPUTE_DISMISS: "আপত্তি খারিজ",
};

export default async function ClaimReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const session = await requireStaff(`/admin/claims/${id}`);
  const data = await claimForReview(id);
  if (!data) notFound();
  const { error } = await searchParams;

  const { claim, product } = data;
  const key = getEnv().FIELD_ENCRYPTION_KEY;
  // Reviewers need the full number to compare against the receipt/box photo. Every view is audited.
  await logStaffAccess(session.user.id, "IDENTIFIER_VIEWED", "claim", claim.id);
  const open = claim.reviewStatus === "PENDING" || claim.reviewStatus === "NEEDS_INFO";
  const ownClaim = claim.reporterId === session.user.id;
  const unscanned = data.documents.some((d) => d.scanStatus !== "CLEAN");
  const row = "grid gap-1 border-b border-slate-100 py-3 sm:grid-cols-[180px_1fr]";

  return <PageFrame active="admin">
    <Link href="/admin" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-emerald-700"><ArrowLeft className="size-4" /> সারিতে ফিরুন</Link>
    <Title eyebrow={claim.trackingId} title={`${product.brand} ${product.model}`} text={`ঝুঁকি: ${riskLabel(claim.riskScore)} (${claim.riskScore}) · জমা: ${formatDate(claim.createdAt)}`} />
    {error && <p role="alert" className="mb-5 flex gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800"><AlertTriangle className="size-5 shrink-0" />{error}</p>}

    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="grid gap-6">
        <section className="rounded-3xl border border-emerald-950/10 bg-white p-6">
          <h2 className="font-black text-emerald-950">রিপোর্টের তথ্য</h2>
          <dl className="mt-3 text-sm">
            <div className={row}><dt className="text-slate-500">পণ্যের ধরন</dt><dd className="font-bold">{product.category}</dd></div>
            {data.identifiers.map((i) => <div key={i.id} className={row}><dt className="text-slate-500">{i.type}</dt><dd className="font-mono font-bold">{decryptField(key, i.valueEncrypted)}</dd></div>)}
            <div className={row}><dt className="text-slate-500">ঘটনা</dt><dd className="font-bold">{INCIDENT_LABEL[claim.incidentType]} · {formatDate(claim.incidentAt)}</dd></div>
            <div className={row}><dt className="text-slate-500">স্থান</dt><dd className="font-bold">{claim.location}</dd></div>
            <div className={row}><dt className="text-slate-500">জিডি / পুলিশ রিপোর্ট</dt><dd className="font-bold">{claim.policeReference ?? <span className="text-amber-700">দেওয়া হয়নি</span>}</dd></div>
            <div className={row}><dt className="text-slate-500">রিপোর্টকারী</dt><dd className="font-bold">{data.reporterEmail}</dd></div>
            <div className={row}><dt className="text-slate-500">বর্তমান অবস্থা</dt><dd className="font-bold">{claim.reviewStatus} · পণ্য: {product.status}</dd></div>
            {data.disputes.length > 0 && <div className={row}><dt className="text-slate-500">আপত্তি</dt><dd className="grid gap-1">{data.disputes.map((d) => <Link key={d.id} href={`/admin/disputes/${d.id}`} className="font-bold text-emerald-700">APL-{d.id.slice(0, 8).toUpperCase()} · {d.status}</Link>)}</dd></div>}
            <div className="py-3"><dt className="text-slate-500">বিবরণ</dt><dd className="mt-2 whitespace-pre-wrap leading-7">{claim.description}</dd></div>
          </dl>
        </section>

        <section className="rounded-3xl border border-emerald-950/10 bg-white p-6">
          <h2 className="font-black text-emerald-950">প্রমাণ ফাইল ({data.documents.length.toLocaleString("bn-BD")})</h2>
          {unscanned && <p className="mt-3 flex gap-2 rounded-xl bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800"><ShieldAlert className="size-4 shrink-0" />ফাইলগুলো এখনো ম্যালওয়্যার স্ক্যান হয়নি। ফাইল ধরন যাচাই করা হয়েছে; সতর্কতার সাথে খুলুন।</p>}
          <ul className="mt-3 grid gap-2">{data.documents.map((d, i) => <li key={d.id}>
            <a href={`/admin/documents/${d.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm hover:bg-emerald-50">
              <span className="flex items-center gap-2 font-bold"><FileText className="size-4 text-emerald-700" />ফাইল {(i + 1).toLocaleString("bn-BD")} · {d.mimeType.split("/")[1].toUpperCase()}</span>
              <span className="text-xs text-slate-500">{(d.sizeBytes / 1024).toFixed(0)} KB · {formatDate(d.createdAt)}</span>
            </a></li>)}</ul>
        </section>
      </div>

      <div className="grid content-start gap-6">
        <section className="rounded-3xl border border-emerald-950/10 bg-white p-6">
          <h2 className="font-black text-emerald-950">সিদ্ধান্ত</h2>
          {!open ? <p className="mt-3 text-sm text-slate-600">এই রিপোর্টে সিদ্ধান্ত হয়ে গেছে ({claim.reviewStatus})।</p>
            : ownClaim ? <p className="mt-3 text-sm font-bold text-amber-800">নিজের জমা দেওয়া রিপোর্ট নিজে পর্যালোচনা করা যাবে না।</p>
            : <form action={decideAction} className="mt-4 grid gap-4">
              <input type="hidden" name="claimId" value={claim.id} />
              <input type="hidden" name="trackingId" value={claim.trackingId} />
              <fieldset className="grid gap-2 text-sm font-bold">
                <legend className="sr-only">সিদ্ধান্ত</legend>
                <label className="flex items-center gap-3 rounded-xl border border-emerald-200 p-3 has-[:checked]:bg-emerald-50"><input type="radio" name="decision" value="APPROVE" required className="accent-emerald-700" />অনুমোদন ও প্রকাশ</label>
                <label className="flex items-center gap-3 rounded-xl border border-amber-200 p-3 has-[:checked]:bg-amber-50"><input type="radio" name="decision" value="NEEDS_INFO" className="accent-amber-600" />আরও তথ্য চাই</label>
                <label className="flex items-center gap-3 rounded-xl border border-red-200 p-3 has-[:checked]:bg-red-50"><input type="radio" name="decision" value="REJECT" className="accent-red-600" />প্রত্যাখ্যান</label>
              </fieldset>
              <label className="text-sm font-bold text-emerald-950">রিপোর্টকারীর জন্য মন্তব্য <span className="font-normal text-slate-500">(প্রত্যাখ্যান / তথ্য চাইলে বাধ্যতামূলক)</span>
                <textarea name="note" rows={4} maxLength={2000} className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-emerald-600" /></label>
              <button className="rounded-xl bg-emerald-900 px-5 py-3 text-sm font-black text-white">সিদ্ধান্ত সংরক্ষণ করুন</button>
              <p className="text-xs leading-5 text-slate-500">অনুমোদনের আগে নিশ্চিত হোন: নম্বরটি রসিদ/বক্সের সাথে মেলে, মালিকানার প্রমাণ বিশ্বাসযোগ্য, এবং জিডি থাকলে তা সংগত।</p>
            </form>}
        </section>

        <section className="rounded-3xl border border-emerald-950/10 bg-white p-6">
          <h2 className="font-black text-emerald-950">ইতিহাস</h2>
          <ol className="mt-3 grid gap-3 text-sm">{data.history.map((h, i) => {
            const meta = (h.metadata ?? {}) as { note?: string; message?: string };
            return <li key={i} className="border-l-2 border-emerald-200 pl-3">
              <p className="font-bold">{ACTION_LABEL[h.action] ?? h.action}</p>
              <p className="text-xs text-slate-500">{h.actorEmail ?? "system"} · {h.createdAt.toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })}</p>
              {(meta.note || meta.message) && <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-xs leading-5">{meta.note ?? meta.message}</p>}
            </li>;
          })}</ol>
        </section>
      </div>
    </div>
  </PageFrame>;
}
