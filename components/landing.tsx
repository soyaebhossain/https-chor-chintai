import Link from "next/link";
import {
  AlertTriangle, ArrowRight, BadgeCheck, Bike, Camera, CarFront, ChevronRight, EyeOff, FileCheck2, FileText,
  Laptop, MapPin, ScanSearch, ShieldCheck, Smartphone, UserRoundCheck,
} from "lucide-react";
import SearchBox from "@/components/search-box";
import { formatDate, SectionHeading } from "@/components/page-bits";

export type Alert = { brand: string; model: string; identifierType: string; lastFour: string; location: string; incidentLabel: string; incidentDate: string };

const productTypes = [
  { name: "মোবাইল ও ট্যাব", id: "IMEI / Serial", icon: Smartphone, tone: "bg-sky-50 text-sky-700" },
  { name: "গাড়ি", id: "VIN / Chassis", icon: CarFront, tone: "bg-amber-50 text-amber-700" },
  { name: "মোটরবাইক", id: "VIN / Engine", icon: Bike, tone: "bg-rose-50 text-rose-700" },
  { name: "ল্যাপটপ", id: "Serial / Service Tag", icon: Laptop, tone: "bg-violet-50 text-violet-700" },
  { name: "ক্যামেরা", id: "Body Serial", icon: Camera, tone: "bg-cyan-50 text-cyan-700" },
];

const promises = [
  { Icon: EyeOff, text: "পূর্ণ serial বা IMEI কখনো প্রকাশ নয়" },
  { Icon: UserRoundCheck, text: "মালিকের নাম ও যোগাযোগ গোপন" },
  { Icon: FileCheck2, text: "প্রমাণ পর্যালোচনার পর রিপোর্ট প্রকাশ" },
];

const steps = [
  { Icon: FileText, step: "০১", title: "তথ্য ও প্রমাণ দিন", text: "পণ্যের ধরন, পরিচিতি নম্বর, ঘটনার স্থান ও মালিকানার প্রমাণ নিরাপদে জমা দিন।" },
  { Icon: UserRoundCheck, step: "০২", title: "মানব পর্যালোচনা", text: "ভুল, duplicate, ব্যক্তিগত তথ্য ও সম্ভাব্য অপব্যবহার যাচাই করে moderation সিদ্ধান্ত নেওয়া হয়।" },
  { Icon: ScanSearch, step: "০৩", title: "নিরাপদ public alert", text: "অনুমোদিত রিপোর্ট masked identifier দিয়ে খোঁজার উপযোগী হয়—মালিকের পরিচয় গোপন থাকে।" },
];

const faqs = [
  ["আমার search কি সংরক্ষণ করা হয়?", "না। পাবলিক সার্চে নাম, ফোন বা অ্যাকাউন্ট লাগে না, আর আপনি কোন নম্বর খুঁজলেন তা কোথাও লেখা হয় না। অপব্যবহার ঠেকাতে শুধু আপনার IP ঠিকানার একটি গোপন hash দিয়ে অল্প সময়ের জন্য অনুরোধের সংখ্যা গোনা হয়।"],
  ["কোনো রিপোর্ট না পেলে কি পণ্যটি বৈধ?", "না। এর অর্থ শুধু বর্তমান registry-তে মিল পাওয়া যায়নি। রসিদ, মালিকানা, বিক্রেতার পরিচয় ও পণ্যের নম্বর আলাদাভাবে যাচাই করতে হবে।"],
  ["IMEI নম্বর কোথায় পাব?", "ফোনে *#06# ডায়াল করুন। এছাড়া ফোনের বক্স, ক্রয়ের রসিদ বা Settings → About phone-এ থাকে। ডুয়াল সিম ফোনে দুটি IMEI থাকে—কেনার আগে দুটিই যাচাই করুন। গাড়ি/মোটরবাইকের জন্য রেজিস্ট্রেশন কাগজের চেসিস নম্বর ব্যবহার করুন।"],
  ["ভুল রিপোর্ট হলে কী করব?", "সার্চ ফলাফলের “প্রমাণসহ আপত্তি জানান” লিংকে ক্লিক করে রসিদ বা চুক্তির কপিসহ আপিল করুন। একজন যাচাইকারী উভয় পক্ষ দেখে সিদ্ধান্ত নেন এবং ইমেইলে জানান; আপনার পরিচয় রিপোর্টকারীকে জানানো হয় না।"],
  ["হারানো পণ্য ফেরত পেলে কী করব?", "লগইন করে “আমার রিপোর্ট” থেকে “পণ্যটি ফেরত পেয়েছি” চাপুন। সঙ্গে সঙ্গে সতর্কতা সরে যাবে, যাতে ভবিষ্যতে বৈধ ক্রেতা বিপদে না পড়েন।"],
  ["পূর্ণ IMEI বা serial কেন দেখা যায় না?", "পূর্ণ নম্বর প্রকাশ করলে অপব্যবহার ও মালিকের privacy ঝুঁকি তৈরি হতে পারে। তাই public view-তে শুধু প্রয়োজনীয় শেষ কয়েকটি অঙ্ক দেখানো হয়।"],
];

export type Stats = { active: number; recovered: number } | null;

const bn = (n: number) => n.toLocaleString("bn-BD");

export default function Landing({ alerts, stats }: { alerts: Alert[]; stats: Stats }) {
  const statRow: [string, string][] = [
    [stats ? bn(stats.active) : "—", "যাচাইকৃত সক্রিয় রিপোর্ট"],
    [stats ? bn(stats.recovered) : "—", "পণ্য মালিকের কাছে ফেরত"],
    ["IMEI · VIN · Serial", "যেকোনো নম্বরে খুঁজুন"],
    ["০", "পর্যালোচনা ছাড়া প্রকাশিত রিপোর্ট"],
  ];
  return <div>
    <section className="relative grid items-center gap-10 pb-16 pt-3 lg:grid-cols-[1.2fr_.8fr] lg:pb-24 lg:pt-10">
      <div className="pointer-events-none absolute -left-40 top-10 -z-10 size-96 rounded-full bg-emerald-200/40 blur-3xl" />
      <div>
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3.5 py-2 text-xs font-black text-emerald-900 shadow-sm"><BadgeCheck className="size-4 text-emerald-600" /> নিরাপদ সেকেন্ডহ্যান্ড কেনাবেচার প্রথম ধাপ</div>
        <h1 className="max-w-4xl text-4xl font-black leading-[1.08] tracking-[-.035em] text-emerald-950 sm:text-5xl md:text-7xl">কেনার আগে নম্বরটি<br/><span className="relative text-emerald-600">খাতায় মিলিয়ে নিন<span className="absolute -bottom-1 left-0 -z-10 h-2 w-full rounded-full bg-emerald-200/70" /></span></h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">Serial, IMEI, VIN বা Service Tag দিয়ে দেখুন পণ্যটি চুরি, ছিনতাই বা হারানোর কোনো যাচাইকৃত রিপোর্টে আছে কি না। কয়েক সেকেন্ডের একটি যাচাই—বাঁচাতে পারে বড় ঝুঁকি।</p>
        <SearchBox />
      </div>
      <aside className="relative overflow-hidden rounded-[2rem] bg-emerald-950 p-6 text-white shadow-2xl shadow-emerald-950/20 md:p-8">
        <div className="absolute -right-16 -top-16 size-52 rounded-full border-[35px] border-emerald-700/30" />
        <div className="relative">
          <div className="flex items-start justify-between"><span className="grid size-12 place-items-center rounded-2xl bg-emerald-400 text-emerald-950"><ShieldCheck className="size-6"/></span><span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] text-emerald-200">Privacy first</span></div>
          <p className="mt-8 text-xs font-bold uppercase tracking-[.2em] text-emerald-300">Safe check protocol</p><h2 className="mt-3 max-w-sm text-2xl font-black leading-tight md:text-3xl">রিপোর্ট দৃশ্যমান।<br/>ব্যক্তিগত পরিচয় নয়।</h2>
          <p className="mt-4 text-sm leading-7 text-emerald-100/70">নিরাপত্তার জন্য public ফলাফলে পরিচিতি নম্বরের শুধু শেষ কয়েকটি অঙ্ক দেখানো হয়।</p>
          <div className="mt-7 space-y-3">{promises.map(({ Icon, text }) => <div key={text} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/6 p-3.5"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10"><Icon className="size-4 text-emerald-300" /></span><p className="text-sm font-bold text-emerald-50">{text}</p></div>)}</div>
          <Link href="/report" className="mt-6 inline-flex w-full items-center justify-between rounded-2xl bg-white p-4 text-left text-sm font-black text-emerald-950">আমার পণ্য রিপোর্ট করুন <span className="grid size-8 place-items-center rounded-full bg-emerald-100"><ArrowRight className="size-4"/></span></Link>
        </div>
      </aside>
    </section>

    <section className="grid overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-white shadow-sm sm:grid-cols-2 lg:grid-cols-4">
      {statRow.map(([value, label], i) => <div key={label} className={`p-6 ${i ? "border-t border-emerald-950/10 sm:border-l sm:border-t-0" : ""} ${i === 2 ? "sm:border-t lg:border-t-0" : ""}`}><p className="text-2xl font-black text-emerald-950">{value}</p><p className="mt-1 text-xs font-bold text-slate-500">{label}</p></div>)}
    </section>

    <section className="py-20 lg:py-28">
      <SectionHeading eyebrow="পাবলিক অ্যালার্ট" title="সাম্প্রতিক যাচাইকৃত রিপোর্ট" text="মানব পর্যালোচনার পর প্রকাশিত সর্বশেষ রিপোর্ট। সব পরিচিতি নম্বর আংশিকভাবে গোপন রাখা হয়েছে।" />
      {alerts.length === 0
        ? <p className="mt-9 rounded-[1.6rem] border border-dashed border-emerald-950/15 bg-white p-8 text-center text-sm font-bold text-slate-500">এখনো কোনো যাচাইকৃত রিপোর্ট প্রকাশিত হয়নি।</p>
        : <div className="mt-9 grid gap-4 lg:grid-cols-3">
          {alerts.map((item) => <article key={`${item.identifierType}-${item.lastFour}-${item.incidentDate}`} className="rounded-[1.6rem] border border-emerald-950/10 bg-white p-5 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-950/5">
            <span className="rounded-full bg-red-50 px-3 py-1.5 text-[11px] font-black text-red-700">{item.incidentLabel}</span>
            <h3 className="mt-5 text-lg font-black text-emerald-950">{item.brand} {item.model}</h3><p className="mt-2 font-mono text-xs font-bold text-slate-500">{item.identifierType} •••••••• {item.lastFour}</p>
            <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500"><span className="flex items-center gap-1.5"><MapPin className="size-3.5 shrink-0"/>{item.location}</span><span className="shrink-0">{formatDate(item.incidentDate)}</span></div>
          </article>)}
        </div>}
      <p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><AlertTriangle className="size-4 shrink-0 text-amber-600"/> এটি কোনো সরকারি ডেটাবেজ নয়। রিপোর্ট মানে অপরাধ প্রমাণিত নয়—এটি মালিকের দাবি, যা প্রমাণসহ পর্যালোচনা করা হয়েছে।</p>
    </section>

    <section className="rounded-[2.5rem] bg-[#eef3e8] px-5 py-14 sm:px-8 lg:px-12 lg:py-20">
      <SectionHeading eyebrow="এক রেজিস্ট্রি, নানা পণ্য" title="কোন নম্বর দিয়ে খুঁজবেন?" text="পণ্যের গায়ে, বক্সে, রসিদে বা ডিভাইস সেটিংসে থাকা unique identifier ব্যবহার করুন।" />
      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {productTypes.map(({ name, id, icon: Icon, tone }) => <div key={name} className="rounded-2xl border border-emerald-950/8 bg-white p-5"><span className={`grid size-11 place-items-center rounded-2xl ${tone}`}><Icon className="size-5"/></span><h3 className="mt-5 font-black text-emerald-950">{name}</h3><p className="mt-1 text-xs font-bold text-slate-400">{id}</p></div>)}
      </div>
    </section>

    <section id="how-it-works" className="scroll-mt-28 py-20 lg:py-28">
      <SectionHeading eyebrow="সহজ ও পর্যালোচিত" title="যেভাবে কাজ করে—তিনটি ধাপ" text="একটি report থেকে public alert হওয়ার আগে তথ্য, প্রমাণ ও প্রকাশযোগ্যতা আলাদাভাবে দেখা হয়।" />
      <div className="relative mt-11 grid gap-5 lg:grid-cols-3">
        <div className="absolute left-[16%] right-[16%] top-8 hidden border-t-2 border-dashed border-emerald-200 lg:block" />
        {steps.map(({ Icon, step, title, text }) => <article key={step} className="relative rounded-[1.8rem] border border-emerald-950/10 bg-white p-6"><div className="flex items-center justify-between"><span className="relative z-10 grid size-16 place-items-center rounded-2xl bg-emerald-950 text-white shadow-lg"><Icon className="size-6"/></span><span className="text-4xl font-black text-emerald-100">{step}</span></div><h3 className="mt-7 text-xl font-black text-emerald-950">{title}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{text}</p></article>)}
      </div>
    </section>

    <section id="safety" className="scroll-mt-28 overflow-hidden rounded-[2.5rem] bg-emerald-950 text-white">
      <div className="grid lg:grid-cols-[.85fr_1.15fr]">
        <div className="relative p-7 sm:p-10 lg:p-12"><div className="absolute -left-20 -top-20 size-64 rounded-full bg-emerald-700/30 blur-3xl"/><div className="relative"><p className="text-xs font-black uppercase tracking-[.22em] text-emerald-400">Buyer safety checklist</p><h2 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">রেকর্ড না পেলেও<br/>আরও চারটি কাজ করুন</h2><p className="mt-5 max-w-md text-sm leading-7 text-emerald-100/70">Search result একটি safety signal—মালিকানা যাচাইয়ের চূড়ান্ত প্রমাণ নয়।</p></div></div>
        <div className="grid gap-px bg-white/10 sm:grid-cols-2">
          {["মূল রসিদ ও পণ্যের বক্স মিলিয়ে দেখুন", "বিক্রেতার পরিচয় ও যোগাযোগ সংরক্ষণ করুন", "IMEI বা serial ডিভাইস ও বক্সে এক কি না দেখুন", "অস্বাভাবিক কম দাম বা তাড়াহুড়া এড়িয়ে চলুন"].map((text, i) => <div key={text} className="bg-emerald-900/60 p-7 sm:p-8"><span className="grid size-8 place-items-center rounded-full bg-emerald-400 font-black text-emerald-950">{i + 1}</span><p className="mt-5 text-sm font-bold leading-7 text-emerald-50">{text}</p></div>)}
        </div>
      </div>
    </section>

    <section id="faq" className="scroll-mt-28 grid gap-10 py-20 lg:grid-cols-[.8fr_1.2fr] lg:py-28">
      <div><SectionHeading eyebrow="প্রশ্নোত্তর" title="জানার মতো বিষয়" text="রিপোর্ট, privacy এবং search result নিয়ে সবচেয়ে প্রয়োজনীয় উত্তরগুলো।" /><div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="text-xs font-black uppercase tracking-[.18em] text-amber-700">গুরুত্বপূর্ণ</p><p className="mt-2 text-sm leading-7 text-amber-900">অভিযোগ মানেই অপরাধ প্রমাণিত নয়। সন্দেহজনক পরিস্থিতিতে স্থানীয় আইনশৃঙ্খলা বাহিনীর সহায়তা নিন।</p></div></div>
      <div className="divide-y divide-emerald-950/10 border-y border-emerald-950/10">
        {faqs.map(([q, a], i) => <details key={q} className="group py-5" open={i === 0}><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-black text-emerald-950"><span>{q}</span><span className="grid size-7 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-800 transition group-open:rotate-90"><ChevronRight className="size-4"/></span></summary><p className="max-w-2xl pb-2 pr-10 pt-4 text-sm leading-7 text-slate-600">{a}</p></details>)}
      </div>
    </section>

    <section className="mb-12 overflow-hidden rounded-[2.5rem] border border-emerald-200 bg-emerald-100 p-7 sm:p-10 lg:p-14">
      <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center"><div><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-700">নীরবতা চোরাই বাজারকে সহজ করে</p><h2 className="mt-3 max-w-3xl text-3xl font-black leading-tight text-emerald-950 sm:text-4xl">আপনার হারানো পণ্যের নম্বরটি অন্য একজন ক্রেতাকে বাঁচাতে পারে।</h2><p className="mt-4 text-sm leading-7 text-emerald-900/70">প্রমাণসহ রিপোর্ট করুন। অনুমোদনের আগে কোনো তথ্য public হবে না।</p></div><Link href="/report" className="inline-flex shrink-0 items-center gap-3 rounded-2xl bg-emerald-950 px-6 py-4 text-sm font-black text-white shadow-xl shadow-emerald-950/15">রিপোর্ট শুরু করুন <ArrowRight className="size-4"/></Link></div>
    </section>
  </div>;
}
