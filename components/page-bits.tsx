import Link from "next/link";
import { FileCheck2, LayoutDashboard, Search, ShieldAlert } from "lucide-react";

export function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[.22em] text-emerald-600">{eyebrow}</p><h2 className="mt-3 text-3xl font-black leading-tight tracking-tight text-emerald-950 sm:text-4xl">{title}</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">{text}</p></div>;
}

export function Title({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return <div className="mb-7"><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-600">{eyebrow}</p><h1 className="mt-2 text-3xl font-black text-emerald-950 md:text-4xl">{title}</h1>{text && <p className="mt-3 max-w-2xl leading-7 text-slate-600">{text}</p>}</div>;
}

type Tab = "search" | "report" | "dashboard" | "admin";

/** Section tabs. The admin tab is rendered only for reviewers/admins — the route itself checks role and MFA again. */
export function RegistryNav({ active, showAdmin }: { active: Tab; showAdmin: boolean }) {
  return <nav className="mb-8 grid grid-cols-2 gap-2 rounded-2xl border border-emerald-950/10 bg-white p-2 shadow-sm md:flex md:w-fit">
    <NavTab href="/#registry" active={active === "search"} icon={<Search />}>পণ্য যাচাই</NavTab>
    <NavTab href="/report" active={active === "report"} icon={<ShieldAlert />}>রিপোর্ট করুন</NavTab>
    <NavTab href="/dashboard" active={active === "dashboard"} icon={<LayoutDashboard />}>আমার রিপোর্ট</NavTab>
    {showAdmin && <NavTab href="/admin" active={active === "admin"} icon={<FileCheck2 />}>যাচাই কনসোল</NavTab>}
  </nav>;
}

function NavTab({ href, active, icon, children }: { href: string; active: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return <Link href={href} aria-current={active ? "page" : undefined} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${active ? "bg-emerald-900 text-white" : "text-slate-500 hover:bg-emerald-50"}`}><span className="[&>svg]:size-4">{icon}</span>{children}</Link>;
}

export const inputClass = "h-12 w-full rounded-xl border border-slate-200 bg-white px-4 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 aria-[invalid=true]:border-red-400";
export const buttonClass = "inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-900 px-6 font-black text-white transition hover:bg-emerald-800 disabled:opacity-60";

export function FieldError({ message }: { message?: string }) {
  return message ? <p role="alert" className="mt-1.5 text-xs font-bold text-red-600">{message}</p> : null;
}

export function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" });
}
