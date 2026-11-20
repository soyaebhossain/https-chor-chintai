import Link from "next/link";
import { AlertTriangle, ArrowRight, BadgeCheck, Bike, Camera, CarFront, ChevronRight, EyeOff, FileCheck2, FileText, Laptop, MapPin, ScanSearch, ShieldCheck, Smartphone, UserRoundCheck } from "lucide-react";
import SearchBox from "@/components/search-box";
import { categoryLabels, formatDate, incidentLabels } from "@/lib/labels";
import type { recentPublicAlerts, registryStats } from "@/lib/reports";

const productTypes = [
  { name: "মোবাইল ও ট্যাব", id: "IMEI / Serial", icon: Smartphone, tone: "bg-sky-50 text-sky-700" },
  { name: "গাড়ি", id: "VIN / Chassis", icon: CarFront, tone: "bg-amber-50 text-amber-700" },
  { name: "মোটরবাইক", id: "VIN / Engine", icon: Bike, tone: "bg-rose-50 text-rose-700" },
  { name: "ল্যাপটপ", id: "Serial / Service Tag", icon: Laptop, tone: "bg-violet-50 text-violet-700" },
  { name: "ক্যামেরা", id: "Body Serial", icon: Camera, tone: "bg-cyan-50 text-cyan-700" },
];

const toBn = (n: number) => n.toLocaleString("bn-BD");

type Props = {
  alerts: Awaited<ReturnType<typeof recentPublicAlerts>>;
  stats: Awaited<ReturnType<typeof registryStats>>;
};

export default function Home({ alerts, stats }: Props) {
  return <div>
    <section className="relative grid items-center gap-10 pb-16 pt-3 lg:grid-cols-[1.2fr_.8fr] lg:pb-24 lg:pt-10">
      <div className="pointer-events-none absolute -left-40 top-10 -z-10 size-96 rounded-full bg-emerald-200/40 blur-3xl" />
      <div>
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3.5 py-2 text-xs font-black text-emerald-900 shadow-sm"><BadgeCheck className="size-4 text-emerald-600" /> নিরাপদ সেকেন্ডহ্যান্ড কেনাবেচার প্রথম ধাপ</div>
        <h1 className="max-w-4xl text-4xl font-black leading-[1.08] tracking-[-.035em] text-emerald-950 sm:text-5xl md:text-7xl">কেনার আগে নম্বরটি<br/><span className="relative text-emerald-600">খাতায় মিলিয়ে নিন<span className="absolute -bottom-1 left-0 h-2 w-full rounded-full bg-emerald-200/70 -z-10" /></span></h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">Serial, IMEI, VIN বা Service Tag দিয়ে দেখুন পণ্যটি চুরি, ছিনতাই বা হারানোর কোনো যাচাইকৃত রিপোর্টে আছে কি না। কয়েক সেকেন্ডের একটি যাচাই—বাঁচাতে পারে বড় ঝুঁকি।</p>
        <SearchBox />
      </div>
      <aside className="relative overflow-hidden rounded-[2rem] bg-emerald-950 p-6 text-white shadow-2xl shadow-emerald-950/20 md:p-8">
        <div className="absolute -right-16 -top-16 size-52 rounded-full border-[35px] border-emerald-700/30" />
        <div className="relative">
          <div className="flex items-start justify-between"><span className="grid size-12 place-items-center rounded-2xl bg-emerald-400 text-emerald-950"><ShieldCheck className="size-6"/></span><span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black text-emerald-200">Privacy first</span></div>
          <p className="mt-8 text-xs font-bold text-emerald-300">Safe check protocol</p><h2 className="mt-3 max-w-sm text-2xl font-black leading-tight md:text-3xl">রিপোর্ট দৃশ্যমান।<br/>ব্যক্তিগত পরিচয় নয়।</h2>
          <p className="mt-4 text-sm leading-7 text-emerald-100/70">নিরাপত্তার জন্য public ফলাফলে পরিচিতি নম্বরের শুধু শেষ কয়েকটি অঙ্ক দেখানো হয়।</p>
          <div className="mt-7 space-y-3">{[
            [EyeOff, "পূর্ণ serial বা IMEI কখনো প্রকাশ নয়"],
            [UserRoundCheck, "মালিকের নাম ও যোগাযোগ গোপন"],
            [FileCheck2, "প্রমাণ পর্যালোচনার পর রিপোর্ট প্রকাশ"],
          ].map(([Icon, text]) => { const ItemIcon = Icon as typeof EyeOff; return <div key={text as string} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/6 p-3.5"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10"><ItemIcon className="size-4 text-emerald-300" /></span><p className="text-sm font-bold text-emerald-50">{text as string}</p></div>; })}</div>
          <Link href="/report" className="mt-6 inline-flex w-full items-center justify-between rounded-2xl bg-white p-4 text-left text-sm font-black text-emerald-950">আমার পণ্য রিপোর্ট করুন <span className="grid size-8 place-items-center rounded-full bg-emerald-100"><ArrowRight className="size-4"/></span></Link>
        </div>
      </aside>
    </section>

    <section className="grid overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-white shadow-sm sm:grid-cols-2 lg:grid-cols-4">
      {[[toBn(stats.approved), "যাচাইকৃত সতর্কতা"], [toBn(stats.recovered), "পণ্য উদ্ধার হয়েছে"], [toBn(stats.pending), "রিপোর্ট যাচাই চলছে"], ["০টি", "পূর্ণ নম্বর public করা হয়"]].map(([value,label], i)=><div key={label} className={`p-6 ${i ? "border-t border-emerald-950/10 sm:border-l sm:border-t-0" : ""} ${i === 2 ? "sm:border-t lg:border-t-0" : ""}`}><p className="text-2xl font-black text-emerald-950">{value}</p><p className="mt-1 text-xs font-bold text-slate-500">{label}</p></div>)}
    </section>

    <section className="py-20 lg:py-28">
      <SectionHeading eyebrow="পাবলিক অ্যালার্ট" title="সাম্প্রতিক যাচাইকৃত রিপোর্ট" text="যাচাইকারী অনুমোদন দেওয়ার পরই একটি রিপোর্ট এখানে আসে। সব পরিচিতি নম্বর আংশিকভাবে গোপন রাখা হয়।" />
      {alerts.length ? <div className="mt-9 grid gap-4 lg:grid-cols-3">
        {alerts.map((item)=><article key={item.id} className="rounded-[1.6rem] border border-emerald-950/10 bg-white p-5">
          <div className="flex items-center justify-between"><span className="rounded-full bg-red-50 px-3 py-1.5 text-[11px] font-black text-red-700">{incidentLabels[item.incidentType]}</span><span className="text-[11px] font-bold text-slate-400">{categoryLabels[item.category]}</span></div>
          <h3 className="mt-5 text-lg font-black text-emerald-950">{item.brandModel}</h3><p className="mt-2 font-mono text-xs font-bold text-slate-500">{item.identifierType} •••• {item.last4}</p>
          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500"><span className="flex items-center gap-1.5"><MapPin className="size-3.5"/>{item.location}</span><span>{formatDate(item.incidentDate)}</span></div>
        </article>)}
      </div> : <p className="mt-9 rounded-[1.6rem] border border-dashed border-emerald-950/15 bg-white p-8 text-center text-sm text-slate-500">এখনো কোনো যাচাইকৃত রিপোর্ট প্রকাশিত হয়নি।</p>}
      <p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><AlertTriangle className="size-4 text-amber-600"/> এটি কোনো সরকারি ডেটাবেজ নয়। অভিযোগ মানেই অপরাধ প্রমাণিত নয়।</p>
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
        <div className="relative p-7 sm:p-10 lg:p-12"><div className="absolute -left-20 -top-20 size-64 rounded-full bg-emerald-700/30 blur-3xl"/><div className="relative"><p className="text-xs font-black text-emerald-400">Buyer safety checklist</p><h2 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">রেকর্ড না পেলেও<br/>আরও চারটি কাজ করুন</h2><p className="mt-5 max-w-md text-sm leading-7 text-emerald-100/70">Search result একটি safety signal—মালিকানা যাচাইয়ের চূড়ান্ত প্রমাণ নয়।</p></div></div>
        <div className="grid gap-px bg-white/10 sm:grid-cols-2">
          {["মূল রসিদ ও পণ্যের বক্স মিলিয়ে দেখুন", "বিক্রেতার পরিচয় ও যোগাযোগ সংরক্ষণ করুন", "IMEI বা serial ডিভাইস ও বক্সে এক কি না দেখুন", "অস্বাভাবিক কম দাম বা তাড়াহুড়া এড়িয়ে চলুন"].map((text,i)=><div key={text} className="bg-emerald-900/60 p-7 sm:p-8"><span className="grid size-8 place-items-center rounded-full bg-emerald-400 font-black text-emerald-950">{i+1}</span><p className="mt-5 text-sm font-bold leading-7 text-emerald-50">{text}</p></div>)}
        </div>
      </div>
    </section>

    <section id="faq" className="scroll-mt-28 grid gap-10 py-20 lg:grid-cols-[.8fr_1.2fr] lg:py-28">
      <div><SectionHeading eyebrow="প্রশ্নোত্তর" title="জানার মতো বিষয়" text="রিপোর্ট, privacy এবং search result নিয়ে সবচেয়ে প্রয়োজনীয় উত্তরগুলো।" /><div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="text-xs font-black text-amber-700">গুরুত্বপূর্ণ</p><p className="mt-2 text-sm leading-7 text-amber-900">অভিযোগ মানেই অপরাধ প্রমাণিত নয়। সন্দেহজনক পরিস্থিতিতে স্থানীয় আইনশৃঙ্খলা বাহিনীর সহায়তা নিন।</p></div></div>
      <div className="divide-y divide-emerald-950/10 border-y border-emerald-950/10">
        {[
          ["আমার search কি সংরক্ষণ করা হয়?", "না। যাচাই করতে নাম, ফোন বা অ্যাকাউন্ট লাগে না, আর আপনার লেখা নম্বরটি আমরা সংরক্ষণ করি না।"],
          ["কোনো রিপোর্ট না পেলে কি পণ্যটি বৈধ?", "না। এর অর্থ শুধু বর্তমান registry-তে মিল পাওয়া যায়নি। রসিদ, মালিকানা, বিক্রেতার পরিচয় ও পণ্যের নম্বর আলাদাভাবে যাচাই করতে হবে।"],
          ["ভুল রিপোর্ট হলে কী করব?", "রিপোর্টে থাকা tracking reference দিয়ে আপিল বা correction request করা যাবে। পর্যালোচনার সময় সংশ্লিষ্ট public alert সাময়িকভাবে সীমিত করা যেতে পারে।"],
          ["পূর্ণ IMEI বা serial কেন দেখা যায় না?", "পূর্ণ নম্বর প্রকাশ করলে অপব্যবহার ও মালিকের privacy ঝুঁকি তৈরি হতে পারে। তাই public view-তে শুধু প্রয়োজনীয় শেষ কয়েকটি অঙ্ক দেখানো হয়।"],
        ].map(([q,a],i)=><details key={q} className="group py-5" open={i===0}><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-black text-emerald-950"><span>{q}</span><span className="grid size-7 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-800 transition group-open:rotate-90"><ChevronRight className="size-4"/></span></summary><p className="max-w-2xl pb-2 pr-10 pt-4 text-sm leading-7 text-slate-600">{a}</p></details>)}
      </div>
    </section>

    <section className="mb-12 overflow-hidden rounded-[2.5rem] border border-emerald-200 bg-emerald-100 p-7 sm:p-10 lg:p-14">
      <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center"><div><p className="text-xs font-black text-emerald-700">নীরবতা চোরাই বাজারকে সহজ করে</p><h2 className="mt-3 max-w-3xl text-3xl font-black leading-tight text-emerald-950 sm:text-4xl">আপনার হারানো পণ্যের নম্বরটি অন্য একজন ক্রেতাকে বাঁচাতে পারে।</h2><p className="mt-4 text-sm leading-7 text-emerald-900/70">প্রমাণসহ রিপোর্ট করুন। অনুমোদনের আগে কোনো তথ্য public হবে না।</p></div><Link href="/report" className="inline-flex shrink-0 items-center gap-3 rounded-2xl bg-emerald-950 px-6 py-4 text-sm font-black text-white shadow-xl shadow-emerald-950/15">রিপোর্ট শুরু করুন <ArrowRight className="size-4"/></Link></div>
    </section>
  </div>;
}

function SectionHeading({eyebrow,title,text}:{eyebrow:string;title:string;text:string}) {
  return <div className="max-w-3xl"><p className="text-xs font-black text-emerald-600">{eyebrow}</p><h2 className="mt-3 text-3xl font-black leading-tight tracking-tight text-emerald-950 sm:text-4xl">{title}</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">{text}</p></div>;
}
