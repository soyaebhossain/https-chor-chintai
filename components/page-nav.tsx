import Link from "next/link";
import { LayoutDashboard, Search, ShieldAlert } from "lucide-react";

const items = [
  { href: "/", key: "search", label: "পণ্য যাচাই", icon: Search },
  { href: "/report", key: "report", label: "রিপোর্ট করুন", icon: ShieldAlert },
  { href: "/dashboard", key: "dashboard", label: "আমার রিপোর্ট", icon: LayoutDashboard },
] as const;

export type NavKey = (typeof items)[number]["key"];

export default function PageNav({ active }: { active?: NavKey }) {
  return (
    <nav aria-label="অ্যাপ নেভিগেশন" className="mb-8 grid grid-cols-3 gap-1 rounded-2xl border border-emerald-950/10 bg-white p-1.5 shadow-sm sm:gap-2 sm:p-2 md:flex md:w-fit">
      {items.map(({ href, key, label, icon: Icon }) => (
        <Link
          key={key}
          href={key === "search" ? "/#registry" : href}
          aria-current={active === key ? "page" : undefined}
          className={`flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2.5 text-xs font-bold sm:flex-row sm:gap-2 sm:px-4 sm:text-sm ${active === key ? "bg-emerald-900 text-white" : "text-slate-500 hover:bg-emerald-50"}`}
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function PageTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="mb-7">
      <p className="text-xs font-black text-emerald-600">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-black text-emerald-950 md:text-4xl">{title}</h1>
      <p className="mt-3 max-w-2xl leading-7 text-slate-600">{text}</p>
    </div>
  );
}
