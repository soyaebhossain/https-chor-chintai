import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { formatDate, Title } from "@/components/page-bits";
import PageFrame from "@/components/page-frame";
import { requireStaff } from "@/lib/server/auth";
import { queueStats, reviewQueue, riskLabel } from "@/lib/server/claims";
import { disputeQueue } from "@/lib/server/disputes";

export const metadata: Metadata = { title: "যাচাই কনসোল — চুরি-ছিন্তাই", robots: { index: false, follow: false } };

const RISK_TONE = { High: "bg-red-100 text-red-700", Medium: "bg-amber-100 text-amber-700", Low: "bg-emerald-100 text-emerald-700" } as const;

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ decided?: string }> }) {
  await requireStaff("/admin");
  const [{ decided }, items, disputes, stats] = await Promise.all([searchParams, reviewQueue(), disputeQueue(), queueStats()]);

  return <PageFrame active="admin">
    <section>
      <Title eyebrow="Moderation console" title="যাচাইয়ের সারি" text="মানব যাচাই ছাড়া কোনো দাবি public registry-তে প্রকাশিত হবে না। প্রতিটি সিদ্ধান্ত audit log-এ লেখা থাকে।" />
      {decided && /^(CLM|APL)-[0-9A-Z-]+$/.test(decided) && <p role="status" className="mb-5 flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800"><CheckCircle2 className="size-5" /> {decided}-এ সিদ্ধান্ত সংরক্ষিত হয়েছে।</p>}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[["অপেক্ষমাণ রিপোর্ট", stats.pending], ["খোলা আপত্তি", stats.openDisputes], ["আজ সিদ্ধান্ত", stats.decidedToday], ["উচ্চ ঝুঁকি (খোলা)", stats.highRisk]].map(([label, value]) =>
          <div key={label as string} className="rounded-3xl bg-emerald-950 p-5 text-white"><p className="text-sm text-emerald-200">{label}</p><p className="mt-2 text-3xl font-black">{(value as number).toLocaleString("bn-BD")}</p></div>)}
      </div>

      {disputes.length > 0 && <div className="mb-8 overflow-hidden rounded-3xl border border-amber-200 bg-white">
        <h2 className="border-b border-amber-100 bg-amber-50 px-5 py-3 font-black text-amber-900">আপত্তি (আপিল) — আগে দেখুন</h2>
        <ul>{disputes.map((d) => <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 first:border-t-0">
          <div className="min-w-0"><p className="font-mono text-xs font-bold text-slate-400">APL-{d.id.slice(0, 8).toUpperCase()} · {d.trackingId} · {formatDate(d.createdAt)}</p><p className="mt-1 font-bold">{d.brand} {d.model}</p><p className="mt-1 truncate text-sm text-slate-500">{d.reason.split("\n")[0]}</p></div>
          <div className="flex items-center gap-4"><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">{d.status === "OPEN" ? "নতুন" : "পর্যালোচনাধীন (পাবলিকে দেখাচ্ছে)"}</span><Link href={`/admin/disputes/${d.id}`} className="font-bold text-emerald-700">দেখুন →</Link></div>
        </li>)}</ul>
      </div>}

      <div className="overflow-hidden rounded-3xl border border-emerald-950/10 bg-white">
        {items.length === 0 ? <p className="p-10 text-center font-bold text-slate-500">সারি খালি — পর্যালোচনার মতো কোনো রিপোর্ট নেই।</p> :
          <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-4">Tracking ID</th><th className="p-4">পণ্য</th><th className="p-4">নম্বর</th><th className="p-4">প্রমাণ</th><th className="p-4">ঝুঁকি</th><th className="p-4">অবস্থা</th><th className="p-4"><span className="sr-only">Action</span></th></tr></thead>
            <tbody>{items.map((x) => {
              const risk = riskLabel(x.riskScore);
              return <tr key={x.id} className="border-t border-slate-100">
                <td className="p-4"><p className="font-mono font-bold">{x.trackingId}</p><p className="text-xs text-slate-400">{formatDate(x.createdAt)}</p></td>
                <td className="p-4"><p className="font-bold">{x.brand} {x.model}</p><p className="text-xs text-slate-500">{x.category}</p></td>
                <td className="p-4 font-mono text-xs">{x.identifierType} ••{x.lastFour}</td>
                <td className="p-4">{x.documents.toLocaleString("bn-BD")}টি ফাইল</td>
                <td className="p-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${RISK_TONE[risk]}`}>{risk} · {x.riskScore}</span></td>
                <td className="p-4 text-xs font-bold">{x.status === "NEEDS_INFO" ? "তথ্যের অপেক্ষায়" : "নতুন / উত্তর এসেছে"}</td>
                <td className="p-4"><Link href={`/admin/claims/${x.id}`} className="font-bold text-emerald-700">পর্যালোচনা →</Link></td>
              </tr>;
            })}</tbody>
          </table></div>}
      </div>
    </section>
  </PageFrame>;
}
