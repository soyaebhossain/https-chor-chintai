import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import AddInfoForm from "@/components/add-info-form";
import { formatDate, Title } from "@/components/page-bits";
import PageFrame from "@/components/page-frame";
import RecoverForm from "@/components/recover-form";
import { requireUser } from "@/lib/server/auth";
import { listMyClaims } from "@/lib/server/claims";
import { listMyDisputes } from "@/lib/server/disputes";

export const metadata: Metadata = {
  title: "আমার রিপোর্ট — চোর ছিনতাই",
  description: "জমা দেওয়া পণ্য রিপোর্টের যাচাই ও প্রকাশের অবস্থা দেখুন।",
  robots: { index: false },
};

type Tone = { label: string; tone: string; next?: string };

function claimStatus(status: string, productStatus: string): Tone {
  if (status === "APPROVED" && productStatus === "RECOVERED") return { label: "ফেরত পাওয়া গেছে", tone: "bg-sky-100 text-sky-800", next: "সতর্কতাটি সরিয়ে নেওয়া হয়েছে—এই নম্বর আর “রিপোর্টেড” দেখাবে না। আবার হারালে নতুন করে রিপোর্ট করুন।" };
  if (status === "APPROVED" && productStatus === "DISPUTED") return { label: "আপত্তি পর্যালোচনাধীন", tone: "bg-amber-100 text-amber-800", next: "কেউ রিপোর্টটির বিরুদ্ধে আপত্তি করেছেন; যাচাইকারী দেখছেন। সতর্কতা এখনো দেখাচ্ছে।" };
  return ({
    PENDING: { label: "যাচাই চলছে", tone: "bg-amber-100 text-amber-800", next: "যাচাইকারী আপনার প্রমাণ দেখছেন। সিদ্ধান্ত হলে ইমেইলে জানানো হবে।" },
    NEEDS_INFO: { label: "আপনার উত্তর প্রয়োজন", tone: "bg-orange-100 text-orange-800" },
    APPROVED: { label: "অনুমোদিত · প্রকাশিত", tone: "bg-emerald-100 text-emerald-800", next: "নম্বরটি এখন সার্চে “রিপোর্টেড” দেখাচ্ছে।" },
    REJECTED: { label: "প্রত্যাখ্যাত", tone: "bg-slate-200 text-slate-700" },
  } as Record<string, Tone>)[status];
}

const DISPUTE_STATUS: Record<string, Tone> = {
  OPEN: { label: "জমা হয়েছে", tone: "bg-amber-100 text-amber-800" },
  UNDER_REVIEW: { label: "পর্যালোচনাধীন", tone: "bg-amber-100 text-amber-800" },
  UPHELD: { label: "গৃহীত — রিপোর্ট সরানো হয়েছে", tone: "bg-emerald-100 text-emerald-800" },
  DISMISSED: { label: "খারিজ", tone: "bg-slate-200 text-slate-700" },
};

export default async function DashboardPage() {
  const session = await requireUser("/dashboard");
  const [claims, disputes] = await Promise.all([listMyClaims(session.user.id), listMyDisputes(session.user.id)]);

  return <PageFrame active="dashboard">
    <section>
      <Title eyebrow="ব্যক্তিগত ড্যাশবোর্ড" title="আমার রিপোর্টসমূহ" text="প্রতিটি রিপোর্টের অবস্থা, যাচাইকারীর মন্তব্য ও পরের করণীয়।" />
      {claims.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-emerald-950/15 bg-white p-10 text-center">
          <p className="font-bold text-slate-600">আপনি এখনো কোনো রিপোর্ট জমা দেননি।</p>
          <Link href="/report" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-900 px-5 py-3 text-sm font-bold text-white">রিপোর্ট করুন <ArrowRight className="size-4" /></Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {claims.map((c) => {
            const status = claimStatus(c.status, c.productStatus);
            const live = c.status === "APPROVED" && (c.productStatus === "REPORTED" || c.productStatus === "DISPUTED");
            return <article key={c.id} className="rounded-3xl border border-emerald-950/10 bg-white p-5 shadow-sm">
              <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-center">
                <div><p className="font-mono text-xs font-bold text-slate-400">{c.trackingId}</p><h3 className="mt-1 font-black text-emerald-950">{c.brand} {c.model}</h3><p className="mt-1 text-xs text-slate-500">জমা: {formatDate(c.createdAt)}</p></div>
                <div className="grid gap-0.5 font-mono text-sm text-slate-500">{c.identifiers.map((i) => <span key={`${i.type}${i.lastFour}`}>{i.type} •••• {i.lastFour}</span>)}</div>
                <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${status.tone}`}>{status.label}</span>
              </div>
              {status.next && <p className="mt-3 text-sm text-slate-500">{status.next}</p>}
              {c.reviewNote && c.status !== "APPROVED" && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700"><b>যাচাইকারীর মন্তব্য:</b> {c.reviewNote}</p>}
              {c.status === "REJECTED" && <p className="mt-3 text-sm text-slate-500">ভুল বোঝাবুঝি হলে আরও প্রমাণসহ <Link href="/report" className="font-bold text-emerald-800 underline underline-offset-4">নতুন করে রিপোর্ট</Link> করতে পারেন।</p>}
              {c.status === "NEEDS_INFO" && <AddInfoForm claimId={c.id} />}
              {live && <RecoverForm claimId={c.id} />}
            </article>;
          })}
        </div>
      )}

      {disputes.length > 0 && <>
        <h2 className="mb-4 mt-12 text-xl font-black text-emerald-950">আমার আপত্তি</h2>
        <div className="grid gap-3">{disputes.map((d) => {
          const s = DISPUTE_STATUS[d.status];
          return <article key={d.id} className="rounded-3xl border border-emerald-950/10 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-mono text-xs font-bold text-slate-400">APL-{d.id.slice(0, 8).toUpperCase()}</p><h3 className="mt-1 font-black text-emerald-950">{d.brand} {d.model}</h3><p className="mt-1 text-xs text-slate-500">জমা: {formatDate(d.createdAt)}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${s.tone}`}>{s.label}</span></div>
            {d.resolutionNote && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700"><b>সিদ্ধান্তের কারণ:</b> {d.resolutionNote}</p>}
          </article>;
        })}</div>
      </>}
    </section>
  </PageFrame>;
}
