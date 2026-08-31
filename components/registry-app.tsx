"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Bike,
  Camera,
  CarFront,
  CheckCircle2,
  ChevronRight,
  Clock3,
  EyeOff,
  FileCheck2,
  FileText,
  Fingerprint,
  Laptop,
  LayoutDashboard,
  LockKeyhole,
  MapPin,
  ScanSearch,
  Search,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  UploadCloud,
  UserRoundCheck,
} from "lucide-react";

type View = "search" | "report" | "dashboard" | "admin";
type Result = { status: "clear" | "reported" };
const claims = [
  { id: "CLM-260831-1042", product: "Apple iPhone 15 Pro", serial: "•••••••••• 4821", state: "যাচাই চলছে", ok: false },
  { id: "CLM-260725-0918", product: "Canon EOS R10", serial: "•••••• 9914", state: "অনুমোদিত", ok: true },
];
const recentAlerts = [
  { product: "Apple iPhone 15 Pro", id: "IMEI ••••••••••• 3809", place: "ধানমন্ডি, ঢাকা", date: "২৯ আগস্ট", type: "ছিনতাই" },
  { product: "Yamaha R15 V4", id: "VIN ••••••••••• 7K21", place: "পাঁচলাইশ, চট্টগ্রাম", date: "২৭ আগস্ট", type: "চুরি" },
  { product: "Canon EOS R10", id: "Serial •••••• 9914", place: "জিন্দাবাজার, সিলেট", date: "২৫ আগস্ট", type: "হারানো" },
];
const productTypes = [
  { name: "মোবাইল ও ট্যাব", id: "IMEI / Serial", icon: Smartphone, tone: "bg-sky-50 text-sky-700" },
  { name: "গাড়ি", id: "VIN / Chassis", icon: CarFront, tone: "bg-amber-50 text-amber-700" },
  { name: "মোটরবাইক", id: "VIN / Engine", icon: Bike, tone: "bg-rose-50 text-rose-700" },
  { name: "ল্যাপটপ", id: "Serial / Service Tag", icon: Laptop, tone: "bg-violet-50 text-violet-700" },
  { name: "ক্যামেরা", id: "Body Serial", icon: Camera, tone: "bg-cyan-50 text-cyan-700" },
];

export default function RegistryApp({ initialView = "search" }: { initialView?: View }) {
  const view = initialView;
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const normalized = useMemo(() => query.replace(/[\s-]/g, "").toUpperCase(), [query]);
  const runSearch = (e: React.FormEvent) => { e.preventDefault(); if (normalized) setResult({ status: normalized === "356938035643809" || normalized === "DEMOSTOLEN" ? "reported" : "clear" }); };

  return <div id="registry" className="mx-auto max-w-7xl scroll-mt-28 px-5 py-7 lg:px-8 lg:py-10">
    <nav className="mb-8 grid grid-cols-2 gap-2 rounded-2xl border border-emerald-950/10 bg-white p-2 shadow-sm md:flex md:w-fit">
      <Nav href="/#registry" active={view === "search"} icon={<Search />}>পণ্য যাচাই</Nav>
      <Nav href="/report" active={view === "report"} icon={<ShieldAlert />}>রিপোর্ট করুন</Nav>
      <Nav href="/dashboard" active={view === "dashboard"} icon={<LayoutDashboard />}>আমার রিপোর্ট</Nav>
      <Nav href="/admin" active={view === "admin"} icon={<FileCheck2 />}>অ্যাডমিন ডেমো</Nav>
    </nav>

    {view === "search" && <HomeSearch query={query} result={result} setQuery={(value) => { setQuery(value); setResult(null); }} runSearch={runSearch} openReport={() => window.location.assign("/report")} />}

    {view === "report" && <section className="mx-auto max-w-4xl"><Title eyebrow="নতুন দাবি" title="চুরি বা ছিনতাই হওয়া পণ্য রিপোর্ট করুন" text="প্রাথমিক তথ্য জমা দেওয়ার পর একজন যাচাইকারী আপনার প্রমাণ পর্যালোচনা করবেন।"/>{submitted ? <Success reset={()=>setSubmitted(false)}/> : <ReportForm submit={()=>setSubmitted(true)}/>}</section>}
    {view === "dashboard" && <section><Title eyebrow="ব্যক্তিগত ড্যাশবোর্ড" title="আমার রিপোর্টসমূহ" text="প্রতিটি দাবির যাচাই, প্রকাশ ও recovery status দেখুন।"/><div className="grid gap-4">{claims.map(c=><article key={c.id} className="grid gap-4 rounded-3xl border border-emerald-950/10 bg-white p-5 shadow-sm md:grid-cols-[1fr_1fr_auto] md:items-center"><div><p className="text-xs font-bold text-slate-400">{c.id}</p><h3 className="mt-1 font-black text-emerald-950">{c.product}</h3></div><p className="font-mono text-sm text-slate-500">{c.serial}</p><span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${c.ok ? "bg-emerald-100 text-emerald-800":"bg-amber-100 text-amber-800"}`}>{c.state}</span></article>)}</div></section>}
    {view === "admin" && <Admin/>}
  </div>;
}

function HomeSearch({ query, result, setQuery, runSearch, openReport }: {
  query: string;
  result: Result | null;
  setQuery: (value: string) => void;
  runSearch: React.FormEventHandler<HTMLFormElement>;
  openReport: () => void;
}) {
  return <div>
    <section className="relative grid items-center gap-10 pb-16 pt-3 lg:grid-cols-[1.2fr_.8fr] lg:pb-24 lg:pt-10">
      <div className="pointer-events-none absolute -left-40 top-10 -z-10 size-96 rounded-full bg-emerald-200/40 blur-3xl" />
      <div>
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3.5 py-2 text-xs font-black text-emerald-900 shadow-sm"><BadgeCheck className="size-4 text-emerald-600" /> নিরাপদ সেকেন্ডহ্যান্ড কেনাবেচার প্রথম ধাপ</div>
        <h1 className="max-w-4xl text-4xl font-black leading-[1.08] tracking-[-.035em] text-emerald-950 sm:text-5xl md:text-7xl">কেনার আগে নম্বরটি<br/><span className="relative text-emerald-600">খাতায় মিলিয়ে নিন<span className="absolute -bottom-1 left-0 h-2 w-full rounded-full bg-emerald-200/70 -z-10" /></span></h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">Serial, IMEI, VIN বা Service Tag দিয়ে দেখুন পণ্যটি চুরি, ছিনতাই বা হারানোর কোনো যাচাইকৃত রিপোর্টে আছে কি না। কয়েক সেকেন্ডের একটি যাচাই—বাঁচাতে পারে বড় ঝুঁকি।</p>
        <form onSubmit={runSearch} className="mt-8 flex max-w-3xl flex-col gap-3 rounded-[1.6rem] border border-emerald-900/10 bg-white p-3 shadow-2xl shadow-emerald-950/10 sm:flex-row">
          <label className="flex min-w-0 flex-1 items-center gap-3 px-3"><Fingerprint className="size-5 shrink-0 text-emerald-700"/><span className="sr-only">পণ্যের নম্বর</span><input value={query} onChange={e => setQuery(e.target.value)} className="h-13 w-full min-w-0 bg-transparent text-base outline-none placeholder:text-slate-400" placeholder="Serial / IMEI / VIN লিখুন" /></label>
          <button className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-emerald-950 px-7 font-black text-white transition hover:bg-emerald-800">রেজিস্ট্রি যাচাই <ArrowRight className="size-4"/></button>
        </form>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500"><span className="flex items-center gap-1.5"><LockKeyhole className="size-3.5 text-emerald-600"/> অনুসন্ধান গোপন থাকে</span><span className="flex items-center gap-1.5"><Clock3 className="size-3.5 text-emerald-600"/> ফলাফল কয়েক সেকেন্ডে</span><button onClick={() => { setQuery("356938035643809"); }} className="font-bold text-emerald-700 underline decoration-emerald-300 underline-offset-4">ডেমো নম্বর ব্যবহার করুন</button></div>
        {result && <SearchCard result={result}/>} 
      </div>
      <aside className="relative overflow-hidden rounded-[2rem] bg-emerald-950 p-6 text-white shadow-2xl shadow-emerald-950/20 md:p-8">
        <div className="absolute -right-16 -top-16 size-52 rounded-full border-[35px] border-emerald-700/30" />
        <div className="relative">
          <div className="flex items-start justify-between"><span className="grid size-12 place-items-center rounded-2xl bg-emerald-400 text-emerald-950"><ShieldCheck className="size-6"/></span><span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] text-emerald-200">Privacy first</span></div>
          <p className="mt-8 text-xs font-bold uppercase tracking-[.2em] text-emerald-300">Safe check protocol</p><h2 className="mt-3 max-w-sm text-2xl font-black leading-tight md:text-3xl">রিপোর্ট দৃশ্যমান।<br/>ব্যক্তিগত পরিচয় নয়।</h2>
          <p className="mt-4 text-sm leading-7 text-emerald-100/70">নিরাপত্তার জন্য public ফলাফলে পরিচিতি নম্বরের শুধু শেষ কয়েকটি অঙ্ক দেখানো হয়।</p>
          <div className="mt-7 space-y-3">{[
            [EyeOff, "পূর্ণ serial বা IMEI কখনো প্রকাশ নয়"],
            [UserRoundCheck, "মালিকের নাম ও যোগাযোগ গোপন"],
            [FileCheck2, "প্রমাণ পর্যালোচনার পর রিপোর্ট প্রকাশ"],
          ].map(([Icon, text]) => { const ItemIcon = Icon as typeof EyeOff; return <div key={text as string} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/6 p-3.5"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10"><ItemIcon className="size-4 text-emerald-300" /></span><p className="text-sm font-bold text-emerald-50">{text as string}</p></div>; })}</div>
          <button onClick={openReport} className="mt-6 inline-flex w-full items-center justify-between rounded-2xl bg-white p-4 text-left text-sm font-black text-emerald-950">আমার পণ্য রিপোর্ট করুন <span className="grid size-8 place-items-center rounded-full bg-emerald-100"><ArrowRight className="size-4"/></span></button>
        </div>
      </aside>
    </section>

    <section className="grid overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-white shadow-sm sm:grid-cols-2 lg:grid-cols-4">
      {[["৪ ধরনের", "পরিচিতি নম্বর সাপোর্ট"], ["৩ ধাপ", "রিপোর্ট যাচাই প্রক্রিয়া"], ["০টি", "পূর্ণ নম্বর public করা হয়"], ["২৪/৭", "রেজিস্ট্রি অনুসন্ধান"]].map(([value,label], i)=><div key={label} className={`p-6 ${i ? "border-t border-emerald-950/10 sm:border-l sm:border-t-0" : ""} ${i === 2 ? "sm:border-t lg:border-t-0" : ""}`}><p className="text-2xl font-black text-emerald-950">{value}</p><p className="mt-1 text-xs font-bold text-slate-500">{label}</p></div>)}
    </section>

    <section className="py-20 lg:py-28">
      <SectionHeading eyebrow="পাবলিক অ্যালার্ট" title="সাম্প্রতিক ডেমো রিপোর্ট" text="Public registry-তে একটি রিপোর্ট কীভাবে নিরাপদভাবে দেখা যাবে তার নমুনা। সব পরিচিতি নম্বর আংশিকভাবে গোপন রাখা হয়েছে।" />
      <div className="mt-9 grid gap-4 lg:grid-cols-3">
        {recentAlerts.map((item, i)=><article key={item.id} className="group rounded-[1.6rem] border border-emerald-950/10 bg-white p-5 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-950/5">
          <div className="flex items-center justify-between"><span className="rounded-full bg-red-50 px-3 py-1.5 text-[11px] font-black text-red-700">{item.type}</span><span className="text-[10px] font-black uppercase tracking-[.14em] text-slate-400">Demo record 0{i+1}</span></div>
          <h3 className="mt-5 text-lg font-black text-emerald-950">{item.product}</h3><p className="mt-2 font-mono text-xs font-bold text-slate-500">{item.id}</p>
          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500"><span className="flex items-center gap-1.5"><MapPin className="size-3.5"/>{item.place}</span><span>{item.date}</span></div>
        </article>)}
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><AlertTriangle className="size-4 text-amber-600"/> এটি কোনো সরকারি ডেটাবেজ নয়; বর্তমানে দেখানো রেকর্ডগুলো কেবল MVP নমুনা।</p>
    </section>

    <section className="rounded-[2.5rem] bg-[#eef3e8] px-5 py-14 sm:px-8 lg:px-12 lg:py-20">
      <SectionHeading eyebrow="এক রেজিস্ট্রি, নানা পণ্য" title="কোন নম্বর দিয়ে খুঁজবেন?" text="পণ্যের গায়ে, বক্সে, রসিদে বা ডিভাইস সেটিংসে থাকা unique identifier ব্যবহার করুন।" />
      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {productTypes.map(({name,id,icon:Icon,tone})=><div key={name} className="rounded-2xl border border-emerald-950/8 bg-white p-5"><span className={`grid size-11 place-items-center rounded-2xl ${tone}`}><Icon className="size-5"/></span><h3 className="mt-5 font-black text-emerald-950">{name}</h3><p className="mt-1 text-xs font-bold text-slate-400">{id}</p></div>)}
      </div>
    </section>

    <section id="how-it-works" className="scroll-mt-28 py-20 lg:py-28">
      <SectionHeading eyebrow="সহজ ও পর্যালোচিত" title="যেভাবে কাজ করে—তিনটি ধাপ" text="একটি report থেকে public alert হওয়ার আগে তথ্য, প্রমাণ ও প্রকাশযোগ্যতা আলাদাভাবে দেখা হয়।" />
      <div className="relative mt-11 grid gap-5 lg:grid-cols-3">
        <div className="absolute left-[16%] right-[16%] top-8 hidden border-t-2 border-dashed border-emerald-200 lg:block" />
        {[
          [FileText, "০১", "তথ্য ও প্রমাণ দিন", "পণ্যের ধরন, পরিচিতি নম্বর, ঘটনার স্থান ও মালিকানার প্রমাণ নিরাপদে জমা দিন।"],
          [UserRoundCheck, "০২", "মানব পর্যালোচনা", "ভুল, duplicate, ব্যক্তিগত তথ্য ও সম্ভাব্য অপব্যবহার যাচাই করে moderation সিদ্ধান্ত নেওয়া হয়।"],
          [ScanSearch, "০৩", "নিরাপদ public alert", "অনুমোদিত রিপোর্ট masked identifier দিয়ে খোঁজার উপযোগী হয়—মালিকের পরিচয় গোপন থাকে।"],
        ].map(([Icon,step,title,text]) => { const StepIcon = Icon as typeof FileText; return <article key={step as string} className="relative rounded-[1.8rem] border border-emerald-950/10 bg-white p-6"><div className="flex items-center justify-between"><span className="relative z-10 grid size-16 place-items-center rounded-2xl bg-emerald-950 text-white shadow-lg"><StepIcon className="size-6"/></span><span className="text-4xl font-black text-emerald-100">{step as string}</span></div><h3 className="mt-7 text-xl font-black text-emerald-950">{title as string}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{text as string}</p></article>; })}
      </div>
    </section>

    <section id="safety" className="scroll-mt-28 overflow-hidden rounded-[2.5rem] bg-emerald-950 text-white">
      <div className="grid lg:grid-cols-[.85fr_1.15fr]">
        <div className="relative p-7 sm:p-10 lg:p-12"><div className="absolute -left-20 -top-20 size-64 rounded-full bg-emerald-700/30 blur-3xl"/><div className="relative"><p className="text-xs font-black uppercase tracking-[.22em] text-emerald-400">Buyer safety checklist</p><h2 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">রেকর্ড না পেলেও<br/>আরও চারটি কাজ করুন</h2><p className="mt-5 max-w-md text-sm leading-7 text-emerald-100/70">Search result একটি safety signal—মালিকানা যাচাইয়ের চূড়ান্ত প্রমাণ নয়।</p></div></div>
        <div className="grid gap-px bg-white/10 sm:grid-cols-2">
          {["মূল রসিদ ও পণ্যের বক্স মিলিয়ে দেখুন", "বিক্রেতার পরিচয় ও যোগাযোগ সংরক্ষণ করুন", "IMEI বা serial ডিভাইস ও বক্সে এক কি না দেখুন", "অস্বাভাবিক কম দাম বা তাড়াহুড়া এড়িয়ে চলুন"].map((text,i)=><div key={text} className="bg-emerald-900/60 p-7 sm:p-8"><span className="grid size-8 place-items-center rounded-full bg-emerald-400 font-black text-emerald-950">{i+1}</span><p className="mt-5 text-sm font-bold leading-7 text-emerald-50">{text}</p></div>)}
        </div>
      </div>
    </section>

    <section id="faq" className="scroll-mt-28 grid gap-10 py-20 lg:grid-cols-[.8fr_1.2fr] lg:py-28">
      <div><SectionHeading eyebrow="প্রশ্নোত্তর" title="জানার মতো বিষয়" text="রিপোর্ট, privacy এবং search result নিয়ে সবচেয়ে প্রয়োজনীয় উত্তরগুলো।" /><div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="text-xs font-black uppercase tracking-[.18em] text-amber-700">গুরুত্বপূর্ণ</p><p className="mt-2 text-sm leading-7 text-amber-900">অভিযোগ মানেই অপরাধ প্রমাণিত নয়। সন্দেহজনক পরিস্থিতিতে স্থানীয় আইনশৃঙ্খলা বাহিনীর সহায়তা নিন।</p></div></div>
      <div className="divide-y divide-emerald-950/10 border-y border-emerald-950/10">
        {[
          ["আমার search কি সংরক্ষণ করা হয়?", "MVP-তে public ফলাফল দেখাতে নাম, ফোন বা অ্যাকাউন্ট লাগে না। Production চালুর আগে search log ও retention policy স্পষ্টভাবে প্রকাশ করা হবে।"],
          ["কোনো রিপোর্ট না পেলে কি পণ্যটি বৈধ?", "না। এর অর্থ শুধু বর্তমান registry-তে মিল পাওয়া যায়নি। রসিদ, মালিকানা, বিক্রেতার পরিচয় ও পণ্যের নম্বর আলাদাভাবে যাচাই করতে হবে।"],
          ["ভুল রিপোর্ট হলে কী করব?", "রিপোর্টে থাকা tracking reference দিয়ে আপিল বা correction request করা যাবে। পর্যালোচনার সময় সংশ্লিষ্ট public alert সাময়িকভাবে সীমিত করা যেতে পারে।"],
          ["পূর্ণ IMEI বা serial কেন দেখা যায় না?", "পূর্ণ নম্বর প্রকাশ করলে অপব্যবহার ও মালিকের privacy ঝুঁকি তৈরি হতে পারে। তাই public view-তে শুধু প্রয়োজনীয় শেষ কয়েকটি অঙ্ক দেখানো হয়।"],
        ].map(([q,a],i)=><details key={q} className="group py-5" open={i===0}><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-black text-emerald-950"><span>{q}</span><span className="grid size-7 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-800 transition group-open:rotate-90"><ChevronRight className="size-4"/></span></summary><p className="max-w-2xl pb-2 pr-10 pt-4 text-sm leading-7 text-slate-600">{a}</p></details>)}
      </div>
    </section>

    <section className="mb-12 overflow-hidden rounded-[2.5rem] border border-emerald-200 bg-emerald-100 p-7 sm:p-10 lg:p-14">
      <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center"><div><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-700">নীরবতা চোরাই বাজারকে সহজ করে</p><h2 className="mt-3 max-w-3xl text-3xl font-black leading-tight text-emerald-950 sm:text-4xl">আপনার হারানো পণ্যের নম্বরটি অন্য একজন ক্রেতাকে বাঁচাতে পারে।</h2><p className="mt-4 text-sm leading-7 text-emerald-900/70">প্রমাণসহ রিপোর্ট করুন। অনুমোদনের আগে কোনো তথ্য public হবে না।</p></div><button onClick={openReport} className="inline-flex shrink-0 items-center gap-3 rounded-2xl bg-emerald-950 px-6 py-4 text-sm font-black text-white shadow-xl shadow-emerald-950/15">রিপোর্ট শুরু করুন <ArrowRight className="size-4"/></button></div>
    </section>
  </div>;
}

function SectionHeading({eyebrow,title,text}:{eyebrow:string;title:string;text:string}) {
  return <div className="max-w-3xl"><p className="text-xs font-black uppercase tracking-[.22em] text-emerald-600">{eyebrow}</p><h2 className="mt-3 text-3xl font-black leading-tight tracking-tight text-emerald-950 sm:text-4xl">{title}</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">{text}</p></div>;
}

function Nav({href,active,icon,children}:{href:string;active:boolean;icon:React.ReactNode;children:React.ReactNode}) { return <Link href={href} aria-current={active ? "page" : undefined} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${active?"bg-emerald-900 text-white":"text-slate-500 hover:bg-emerald-50"}`}><span className="[&>svg]:size-4">{icon}</span>{children}</Link>; }
function Title({eyebrow,title,text}:{eyebrow:string;title:string;text:string}) { return <div className="mb-7"><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-600">{eyebrow}</p><h1 className="mt-2 text-3xl font-black text-emerald-950 md:text-4xl">{title}</h1><p className="mt-3 max-w-2xl leading-7 text-slate-600">{text}</p></div>; }
function SearchCard({result}:{result:Result}) { return result.status === "reported" ? <div className="mt-6 max-w-2xl rounded-3xl border border-red-200 bg-red-50 p-5"><div className="flex gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-red-600 text-white"><AlertTriangle/></span><div><h3 className="text-lg font-black text-red-900">সতর্কতা: রিপোর্ট পাওয়া গেছে</h3><p className="mt-1 text-sm leading-6 text-red-800">পণ্যটি কিনবেন না। স্থানীয় আইনশৃঙ্খলা বাহিনী বা প্ল্যাটফর্ম কর্তৃপক্ষকে জানান।</p><dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-red-500">পণ্যের ধরন</dt><dd className="font-bold">মোবাইল ফোন</dd></div><div><dt className="text-red-500">নম্বর</dt><dd className="font-mono font-bold">••••••••••• 3809</dd></div><div><dt className="text-red-500">রিপোর্টের স্থান</dt><dd className="font-bold">ঢাকা, বাংলাদেশ</dd></div><div><dt className="text-red-500">তারিখ</dt><dd className="font-bold">২৯ আগস্ট ২০২৬</dd></div></dl></div></div></div> : <div className="mt-6 flex max-w-2xl gap-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-5"><CheckCircle2 className="size-8 shrink-0 text-emerald-600"/><div><h3 className="font-black text-emerald-900">বর্তমানে কোনো রিপোর্ট পাওয়া যায়নি</h3><p className="mt-1 text-sm leading-6 text-emerald-800">এটি পণ্যটির বৈধতার নিশ্চয়তা নয়। রসিদ, পরিচয় ও মালিকানা আলাদাভাবে যাচাই করুন।</p></div></div>; }

function ReportForm({submit}:{submit:()=>void}) {
  const fields=[{l:"পণ্যের ধরন",p:"যেমন: মোবাইল ফোন"},{l:"ব্র্যান্ড ও মডেল",p:"যেমন: Samsung Galaxy S25"},{l:"Serial / IMEI / VIN",p:"প্রধান পরিচিতি নম্বর"},{l:"ঘটনার স্থান",p:"শহর, দেশ"},{l:"পুলিশ রিপোর্ট / জিডি নম্বর",p:"ঐচ্ছিক হলেও সুপারিশকৃত"}];
  return <form onSubmit={e=>{e.preventDefault();submit();}} className="rounded-[2rem] border border-emerald-950/10 bg-white p-5 shadow-xl shadow-emerald-950/5 md:p-8"><div className="grid gap-5 md:grid-cols-2">{fields.map((f,i)=><label key={f.l} className={i===4?"md:col-span-2":""}><span className="mb-2 block text-sm font-bold text-emerald-950">{f.l}</span><input required={i<4} className="h-12 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100" placeholder={f.p}/></label>)}<label className="md:col-span-2"><span className="mb-2 block text-sm font-bold text-emerald-950">ঘটনার বিবরণ</span><textarea required rows={4} className="w-full rounded-xl border border-slate-200 p-4 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100" placeholder="কখন ও কীভাবে ঘটনাটি ঘটেছে লিখুন"/></label><label className="md:col-span-2 grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50 p-8 text-center"><UploadCloud className="size-8 text-emerald-700"/><span className="mt-2 text-sm font-bold text-emerald-900">রসিদ, বক্স, জিডি বা মালিকানার প্রমাণ</span><span className="mt-1 text-xs text-slate-500">PDF, JPG বা PNG · সর্বোচ্চ 10MB</span><input type="file" className="sr-only"/></label></div><label className="mt-5 flex items-start gap-3 text-sm leading-6 text-slate-600"><input required type="checkbox" className="mt-1 accent-emerald-800"/>আমি নিশ্চিত করছি যে তথ্যগুলো সত্য এবং মিথ্যা রিপোর্টের আইনগত দায় সম্পর্কে অবগত।</label><button className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-900 font-black text-white">রিপোর্ট জমা দিন <ArrowRight className="size-4"/></button></form>;
}

function Success({reset}:{reset:()=>void}) { return <div className="rounded-[2rem] border border-emerald-200 bg-white p-10 text-center shadow-xl"><CheckCircle2 className="mx-auto size-14 text-emerald-600"/><h2 className="mt-4 text-2xl font-black text-emerald-950">রিপোর্ট গ্রহণ করা হয়েছে</h2><p className="mt-2 text-slate-600">Tracking ID: CLM-260831-1284 · যাচাই শেষ হলে আপনাকে জানানো হবে।</p><button onClick={reset} className="mt-6 rounded-xl bg-emerald-900 px-5 py-3 text-sm font-bold text-white">আরেকটি রিপোর্ট</button></div>; }

function Admin(){
  const items=[{id:"CLM-1284",name:"Samsung Galaxy S25",risk:"Low",docs:3},{id:"CLM-1279",name:"Yamaha R15 V4",risk:"Medium",docs:2},{id:"CLM-1268",name:"MacBook Air M4",risk:"High",docs:1}];
  return <section><Title eyebrow="Moderation console" title="Verification queue" text="মানব যাচাই ছাড়া কোনো দাবি public registry-তে প্রকাশিত হবে না।"/><div className="mb-5 grid gap-4 sm:grid-cols-3">{[["অপেক্ষমাণ","২৩"],["আজ যাচাই","১৭"],["Fraud alert","৩"]].map(([a,b])=><div key={a} className="rounded-3xl bg-emerald-950 p-5 text-white"><p className="text-sm text-emerald-200">{a}</p><p className="mt-2 text-3xl font-black">{b}</p></div>)}</div><div className="overflow-hidden rounded-3xl border border-emerald-950/10 bg-white"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-4">Claim</th><th className="p-4">Product</th><th className="p-4">Documents</th><th className="p-4">Risk</th><th className="p-4">Action</th></tr></thead><tbody>{items.map(x=><tr key={x.id} className="border-t border-slate-100"><td className="p-4 font-mono font-bold">{x.id}</td><td className="p-4 font-bold">{x.name}</td><td className="p-4">{x.docs} files</td><td className="p-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${x.risk==="High"?"bg-red-100 text-red-700":x.risk==="Medium"?"bg-amber-100 text-amber-700":"bg-emerald-100 text-emerald-700"}`}>{x.risk}</span></td><td className="p-4"><button className="font-bold text-emerald-700">Review →</button></td></tr>)}</tbody></table></div></div></section>;
}
