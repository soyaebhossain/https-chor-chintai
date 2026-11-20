import type { Metadata } from "next";
import Link from "next/link";
import { FileText, TriangleAlert } from "lucide-react";
import { adminLogoutAction, decideAction } from "@/app/actions";
import AdminLogin from "@/components/admin-login";
import PageNav, { PageTitle } from "@/components/page-nav";
import SiteShell from "@/components/site-shell";
import { getDb } from "@/db";
import { categoryLabels, formatDate, incidentLabels, statusLabels } from "@/lib/labels";
import { listForReview, registryStats } from "@/lib/reports";
import { isAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "যাচাইকারী কনসোল — চোর ছিনতাই",
  robots: { index: false, follow: false },
};

const tabs = { queue: "অপেক্ষমাণ", published: "প্রকাশিত", closed: "বন্ধ" } as const;
type Tab = keyof typeof tabs;

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  if (!(await isAdmin()))
    return (
      <SiteShell>
        <div className="mx-auto max-w-7xl px-5 py-7 lg:px-8 lg:py-10">
          <PageNav />
          <AdminLogin />
        </div>
      </SiteShell>
    );

  const requested = (await searchParams).tab;
  const tab: Tab = requested && requested in tabs ? (requested as Tab) : "queue";
  const db = await getDb();
  const [items, stats] = await Promise.all([listForReview(db, tab), registryStats(db)]);

  return (
    <SiteShell>
      <div className="mx-auto max-w-7xl px-5 py-7 lg:px-8 lg:py-10">
        <PageNav />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageTitle eyebrow="Moderation console" title="রিপোর্ট যাচাই" text="প্রমাণ দেখে অনুমোদন দিলে নম্বরটি public সার্চে সতর্কতা হিসেবে দেখাবে। প্রতিটি সিদ্ধান্ত audit log-এ থাকে।" />
          <form action={adminLogoutAction}><button className="rounded-xl border border-emerald-900/15 px-4 py-2 text-sm font-bold text-emerald-900">লগআউট</button></form>
        </div>

        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          {[["অপেক্ষমাণ", stats.pending], ["প্রকাশিত", stats.approved], ["উদ্ধার", stats.recovered]].map(([label, n]) => (
            <div key={label} className="rounded-3xl bg-emerald-950 p-5 text-white"><p className="text-sm text-emerald-200">{label}</p><p className="mt-2 text-3xl font-black">{Number(n).toLocaleString("bn-BD")}</p></div>
          ))}
        </div>

        <nav className="mb-5 flex gap-2" aria-label="তালিকা">
          {(Object.keys(tabs) as Tab[]).map((t) => (
            <Link key={t} href={`/admin?tab=${t}`} aria-current={t === tab ? "page" : undefined} className={`rounded-xl px-4 py-2 text-sm font-bold ${t === tab ? "bg-emerald-900 text-white" : "bg-white text-slate-600"}`}>{tabs[t]}</Link>
          ))}
        </nav>

        {items.length ? (
          <div className="grid gap-4">
            {items.map((r) => (
              <article key={r.id} className="rounded-3xl border border-emerald-950/10 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs font-bold text-slate-400">{r.trackingId} · জমা {formatDate(r.createdAt)}</p>
                    <h2 className="mt-1 text-lg font-black text-emerald-950">{r.brandModel} <span className="text-sm font-bold text-slate-400">({categoryLabels[r.category]})</span></h2>
                  </div>
                  <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusLabels[r.status].tone}`}>{statusLabels[r.status].label}</span>
                </div>
                {r.otherReports > 0 ? (
                  <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900"><TriangleAlert className="size-4" aria-hidden /> এই নম্বরে আরও {r.otherReports.toLocaleString("bn-BD")}টি রিপোর্ট আছে। মালিকানা বিরোধ হতে পারে।</p>
                ) : null}
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div><dt className="text-xs text-slate-400">{r.identifierType}</dt><dd className="font-mono font-bold">{r.identifier}</dd></div>
                  <div><dt className="text-xs text-slate-400">ঘটনা</dt><dd className="font-bold">{incidentLabels[r.incidentType]} · {formatDate(r.incidentDate)}</dd></div>
                  <div><dt className="text-xs text-slate-400">এলাকা</dt><dd className="font-bold">{r.location}</dd></div>
                  <div><dt className="text-xs text-slate-400">মোবাইল</dt><dd className="font-bold"><a href={`tel:${r.phone}`}>{r.phone}</a></dd></div>
                  <div className="sm:col-span-2"><dt className="text-xs text-slate-400">জিডি / মামলা</dt><dd className="font-bold">{r.policeReference ?? "—"}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-xs text-slate-400">প্রমাণ</dt><dd className="flex flex-wrap gap-2">{r.files.length ? r.files.map((f) => <a key={f.id} href={`/admin/evidence/${f.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-emerald-900"><FileText className="size-3.5" aria-hidden />{f.fileName}</a>) : "—"}</dd></div>
                </dl>
                <p className="mt-4 whitespace-pre-line rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{r.description}</p>
                {r.reviewNote ? <p className="mt-3 text-sm text-slate-600"><b>নোট:</b> {r.reviewNote}</p> : null}
                {tab !== "closed" ? (
                  <form action={decideAction} className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 lg:flex-row lg:items-center">
                    <input type="hidden" name="reportId" value={r.id} />
                    <input name="note" maxLength={500} placeholder="রিপোর্টকারীর জন্য নোট (ঐচ্ছিক)" className="h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-600" />
                    <div className="flex gap-2">
                      {tab === "queue" ? <button name="decision" value="APPROVED" className="rounded-xl bg-emerald-900 px-4 py-2 text-sm font-bold text-white">অনুমোদন ও প্রকাশ</button> : null}
                      {tab === "queue" ? <button name="decision" value="NEEDS_INFO" className="rounded-xl bg-orange-100 px-4 py-2 text-sm font-bold text-orange-900">আরও তথ্য চাই</button> : null}
                      <button name="decision" value="REJECTED" className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">{tab === "queue" ? "প্রত্যাখ্যান" : "প্রকাশ বাতিল"}</button>
                    </div>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-3xl border border-dashed border-emerald-950/15 bg-white p-10 text-center text-sm text-slate-500">এই তালিকায় কোনো রিপোর্ট নেই।</p>
        )}
      </div>
    </SiteShell>
  );
}
