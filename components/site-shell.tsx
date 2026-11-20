import Link from "next/link";
import { ArrowUpRight, LogOut, Menu, ShieldCheck } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { getSession, isStaff } from "@/lib/server/auth";

export default async function SiteShell({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const staff = session ? isStaff(session.user.role) : false;

  return (
    <main id="top" className="min-h-screen overflow-hidden bg-[#f7f8f3] text-[#10231b]">
      <header className="sticky top-0 z-40 border-b border-emerald-950/10 bg-[#f7f8f3]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="চুরি-ছিন্তাই হোম">
            <span className="grid size-11 place-items-center rounded-2xl bg-emerald-950 text-white shadow-lg shadow-emerald-950/15"><ShieldCheck className="size-6" /></span>
            <div><p className="text-lg font-black leading-none">চুরি-ছিন্তাই</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.16em] text-emerald-700">Trusted registry</p></div>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-bold text-slate-600 md:flex" aria-label="প্রধান নেভিগেশন">
            <Link className="transition hover:text-emerald-800" href="/#registry">যাচাই</Link>
            <Link className="transition hover:text-emerald-800" href="/#how-it-works">যেভাবে কাজ করে</Link>
            <Link className="transition hover:text-emerald-800" href="/#safety">নিরাপদ কেনাকাটা</Link>
            <Link className="transition hover:text-emerald-800" href="/#faq">প্রশ্নোত্তর</Link>
          </nav>
          <div className="flex items-center gap-2">
            {session ? <>
              <Link href={staff ? "/admin" : "/dashboard"} className="hidden max-w-48 truncate rounded-xl border border-emerald-900/10 bg-white px-3 py-2.5 text-xs font-bold text-emerald-950 sm:block" title={session.user.email ?? undefined}>{session.user.email}</Link>
              <form action={logoutAction} className="hidden sm:block"><button className="inline-flex items-center gap-2 rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-950/10">লগআউট <LogOut className="size-4" /></button></form>
            </> : <Link href="/login" className="hidden items-center gap-2 rounded-xl bg-emerald-950 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-950/10 sm:inline-flex">লগইন <ArrowUpRight className="size-4" /></Link>}
            <details className="relative md:hidden">
              <summary className="grid size-10 cursor-pointer list-none place-items-center rounded-xl border border-emerald-950/10 bg-white" aria-label="মেনু"><Menu className="size-5" /></summary>
              <div className="absolute right-0 top-12 grid w-56 gap-1 rounded-2xl border border-emerald-950/10 bg-white p-2 text-sm font-bold text-emerald-950 shadow-xl">
                <Link className="rounded-lg px-3 py-2 hover:bg-emerald-50" href="/#registry">পণ্য যাচাই</Link>
                <Link className="rounded-lg px-3 py-2 hover:bg-emerald-50" href="/report">রিপোর্ট করুন</Link>
                <Link className="rounded-lg px-3 py-2 hover:bg-emerald-50" href="/dashboard">আমার রিপোর্ট</Link>
                {staff && <Link className="rounded-lg px-3 py-2 hover:bg-emerald-50" href="/admin">যাচাই কনসোল</Link>}
                <Link className="rounded-lg px-3 py-2 hover:bg-emerald-50" href="/#faq">প্রশ্নোত্তর</Link>
                {session
                  ? <form action={logoutAction}><button className="w-full rounded-lg px-3 py-2 text-left hover:bg-emerald-50">লগআউট</button></form>
                  : <Link className="rounded-lg px-3 py-2 hover:bg-emerald-50" href="/login">লগইন</Link>}
              </div>
            </details>
          </div>
        </div>
      </header>

      {children}

      <footer className="border-t border-emerald-950/10 bg-emerald-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-[1.2fr_.8fr_.8fr] lg:px-8">
          <div className="max-w-md"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-white text-emerald-950"><ShieldCheck className="size-5" /></span><p className="text-lg font-black">চুরি-ছিন্তাই</p></div><p className="mt-4 text-sm leading-7 text-emerald-100/70">চুরি বা ছিনতাই হওয়া পণ্যের পরিচিতি নম্বর রিপোর্ট ও যাচাইয়ের একটি জনস্বার্থমূলক রেজিস্ট্রি।</p></div>
          <div><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-400">দ্রুত লিংক</p><div className="mt-4 grid gap-3 text-sm text-emerald-50/80"><Link href="/#registry">পণ্য যাচাই</Link><Link href="/report">রিপোর্ট করুন</Link><Link href="/dashboard">আমার রিপোর্ট</Link></div></div>
          <div><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-400">মনে রাখুন</p><p className="mt-4 text-sm leading-7 text-emerald-50/70">কোনো রেকর্ড না পাওয়া পণ্যটির বৈধতা নিশ্চিত করে না। রসিদ, বিক্রেতার পরিচয় ও মালিকানা আলাদাভাবে যাচাই করুন।</p></div>
        </div>
        <div className="border-t border-white/10"><div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-5 text-xs text-emerald-100/75 sm:flex-row sm:justify-between lg:px-8"><p>© ২০২৬ চুরি-ছিন্তাই · জনস্বার্থে নিরাপদ পণ্য রেজিস্ট্রি</p><nav aria-label="আইনি তথ্য" className="flex flex-wrap gap-x-4 gap-y-1"><Link href="/privacy" className="hover:text-white">গোপনীয়তা নীতি</Link><Link href="/terms" className="hover:text-white">শর্তাবলী</Link><Link href="/takedown" className="hover:text-white">অপসারণ ও আপিল</Link></nav></div></div>
      </footer>
    </main>
  );
}
