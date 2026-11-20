import Link from "next/link";
import { Title } from "@/components/page-bits";
import PageFrame from "@/components/page-frame";
import { contactEmail, LEGAL_UPDATED } from "@/lib/retention";

const LINKS = [
  { href: "/privacy", label: "গোপনীয়তা নীতি" },
  { href: "/terms", label: "ব্যবহারের শর্তাবলী" },
  { href: "/takedown", label: "অপসারণ ও আপিল" },
] as const;

export function Contact() {
  const email = contactEmail();
  return email ? <a href={`mailto:${email}`} className="font-bold text-emerald-800 underline underline-offset-4">{email}</a> : <span className="font-bold">আমাদের সাপোর্ট ইমেইল</span>;
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border-t border-slate-200 pt-7 first:border-t-0 first:pt-0">
    <h2 className="text-xl font-black text-emerald-950">{title}</h2>
    <div className="mt-3 grid gap-3 leading-7 text-slate-700 [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:grid [&_ol]:gap-2 [&_ul]:list-disc [&_ul]:grid [&_ul]:gap-2">{children}</div>
  </section>;
}

export default function LegalPage({ active, eyebrow, title, intro, children }: { active: (typeof LINKS)[number]["href"]; eyebrow: string; title: string; intro: string; children: React.ReactNode }) {
  return <PageFrame>
    <article className="mx-auto max-w-3xl">
      <Title eyebrow={eyebrow} title={title} text={intro} />
      <p className="-mt-4 mb-6 text-sm text-slate-500">সর্বশেষ হালনাগাদ: {LEGAL_UPDATED}</p>
      <nav aria-label="আইনি পাতা" className="mb-8 flex flex-wrap gap-2">
        {LINKS.map((l) => <Link key={l.href} href={l.href} aria-current={l.href === active ? "page" : undefined} className={`rounded-full border px-4 py-2 text-sm font-bold ${l.href === active ? "border-emerald-900 bg-emerald-900 text-white" : "border-emerald-900/15 bg-white text-emerald-900 hover:bg-emerald-50"}`}>{l.label}</Link>)}
      </nav>
      <div className="grid gap-8 rounded-[2rem] border border-emerald-950/10 bg-white p-6 shadow-sm md:p-9">{children}</div>
    </article>
  </PageFrame>;
}
