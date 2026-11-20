"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Fingerprint, LockKeyhole, Smartphone } from "lucide-react";
import Turnstile, { turnstileEnabled, type TurnstileHandle } from "@/components/turnstile";
import { IDENTIFIER_ERROR_MESSAGES, planSearch } from "@/lib/identifiers";

type PublicRecord = {
  category: string; brand: string; model: string; identifierType: string; lastFour: string;
  incidentType: "THEFT" | "ROBBERY" | "LOST" | null; incidentDate: string | null; location: string | null;
};
type Result =
  | { status: "clear" }
  | { status: "reported" | "disputed"; record: PublicRecord }
  | { status: "error"; message: string };

const INCIDENT_LABEL = { THEFT: "চুরি", ROBBERY: "ছিনতাই", LOST: "হারানো" } as const;

export default function SearchBox() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  // Load the bot check only once someone starts using the search, so it costs nothing on first paint.
  const [armed, setArmed] = useState(false);
  const turnstile = useRef<TurnstileHandle>(null);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const plan = planSearch(query);
    if (!plan.ok) { setResult({ status: "error", message: IDENTIFIER_ERROR_MESSAGES[plan.error] }); return; }
    if (turnstileEnabled && !token) { setResult({ status: "error", message: "নিরাপত্তা যাচাই চলছে—কয়েক সেকেন্ড পর আবার চেষ্টা করুন।" }); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, turnstileToken: token ?? undefined }) });
      const data = await res.json();
      if (res.ok && (data.status === "clear" || data.status === "reported" || data.status === "disputed")) setResult(data);
      else setResult({ status: "error", message: data.message ?? data.error ?? "অনুসন্ধান করা যায়নি। আবার চেষ্টা করুন।" });
    } catch {
      setResult({ status: "error", message: "সার্ভারের সাথে সংযোগ করা যায়নি। ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।" });
    } finally {
      setLoading(false);
      turnstile.current?.reset(); // tokens are single-use
    }
  }

  return <>
    <form onSubmit={runSearch} className="mt-8 flex max-w-3xl flex-col gap-3 rounded-[1.6rem] border border-emerald-900/10 bg-white p-3 shadow-2xl shadow-emerald-950/10 sm:flex-row">
      <label className="flex min-w-0 flex-1 items-center gap-3 px-3"><Fingerprint className="size-5 shrink-0 text-emerald-700"/><span className="sr-only">পণ্যের নম্বর</span><input value={query} onFocus={() => setArmed(true)} onChange={e => { setQuery(e.target.value); setResult(null); setArmed(true); }} className="h-13 w-full min-w-0 bg-transparent text-base outline-none placeholder:text-slate-400" placeholder="Serial / IMEI / VIN লিখুন" maxLength={128} autoComplete="off" spellCheck={false} /></label>
      <button disabled={loading} className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-emerald-950 px-7 font-black text-white transition hover:bg-emerald-800 disabled:opacity-60">{loading ? "যাচাই চলছে…" : "রেজিস্ট্রি যাচাই"} <ArrowRight className="size-4"/></button>
    </form>
    {armed && <Turnstile ref={turnstile} action="search" onToken={setToken} />}
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500"><span className="flex items-start gap-1.5"><Smartphone className="mt-0.5 size-3.5 shrink-0 text-emerald-600"/><span>ফোনের IMEI জানতে <b className="font-mono text-emerald-900">*#06#</b> ডায়াল করুন · ডুয়াল সিম হলে দুটিই যাচাই করুন</span></span><span className="flex items-start gap-1.5"><LockKeyhole className="mt-0.5 size-3.5 shrink-0 text-emerald-600"/><span>আপনি কী খুঁজলেন তা সংরক্ষণ করা হয় না</span></span></div>
    <div aria-live="polite">{result && <SearchCard result={result}/>}</div>
  </>;
}

function AppealLink() {
  return <p className="mt-3 text-xs text-slate-600">রিপোর্টটি ভুল মনে হলে (যেমন আপনি বৈধভাবে কিনেছেন)? <Link href="/dispute" className="font-bold text-emerald-800 underline underline-offset-4">প্রমাণসহ আপত্তি জানান</Link></p>;
}

function RecordDetails({record,tone}:{record:PublicRecord;tone:string}) {
  const date = record.incidentDate ? new Date(`${record.incidentDate}T00:00:00Z`).toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "—";
  return <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
    <div><dt className={tone}>পণ্য</dt><dd className="font-bold">{record.category} · {record.brand} {record.model}</dd></div>
    <div><dt className={tone}>{record.identifierType}</dt><dd className="font-mono font-bold">•••••••• {record.lastFour}</dd></div>
    <div><dt className={tone}>ঘটনার ধরন ও স্থান</dt><dd className="font-bold">{record.incidentType ? INCIDENT_LABEL[record.incidentType] : "—"}{record.location ? ` · ${record.location}` : ""}</dd></div>
    <div><dt className={tone}>তারিখ</dt><dd className="font-bold">{date}</dd></div>
  </dl>;
}

function SearchCard({result}:{result:Result}) {
  if (result.status === "error") return <div role="alert" className="mt-6 flex max-w-2xl gap-4 rounded-3xl border border-amber-200 bg-amber-50 p-5"><AlertTriangle className="size-7 shrink-0 text-amber-600"/><p className="text-sm font-bold leading-6 text-amber-900">{result.message}</p></div>;
  if (result.status === "disputed") return <div className="mt-6 max-w-2xl rounded-3xl border border-amber-200 bg-amber-50 p-5"><div className="flex gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-500 text-white"><Clock3/></span><div><h3 className="text-lg font-black text-amber-900">রিপোর্টটি নিয়ে আপত্তি পর্যালোচনাধীন</h3><p className="mt-1 text-sm leading-6 text-amber-800">এই নম্বরে একটি রিপোর্ট আছে, তবে এর বিরুদ্ধে আপিল জমা পড়েছে। সিদ্ধান্ত না হওয়া পর্যন্ত কেনার আগে বাড়তি সতর্ক থাকুন ও মালিকানার কাগজ দেখে নিন।</p><RecordDetails record={result.record} tone="text-amber-600"/><AppealLink /></div></div></div>;
  if (result.status === "reported") return <div className="mt-6 max-w-2xl rounded-3xl border border-red-200 bg-red-50 p-5"><div className="flex gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-red-600 text-white"><AlertTriangle/></span><div><h3 className="text-lg font-black text-red-900">সতর্কতা: রিপোর্ট পাওয়া গেছে</h3><p className="mt-1 text-sm leading-6 text-red-800">মালিক এই পণ্যটি চুরি/ছিনতাই/হারানো বলে প্রমাণসহ জানিয়েছেন এবং তা যাচাই করা হয়েছে।</p><RecordDetails record={result.record} tone="text-red-500"/>
    <div className="mt-4 rounded-2xl bg-white/70 p-4 text-sm leading-6 text-red-900"><p className="font-black">এখন কী করবেন</p><ol className="mt-1 grid gap-1"><li>১. পণ্যটি কিনবেন না, অগ্রিম টাকা দেবেন না।</li><li>২. নিরাপদ থাকুন—বিক্রেতার সাথে তর্ক করবেন না; তার নাম, নম্বর ও বিজ্ঞাপনের লিংক সংরক্ষণ করুন।</li><li>৩. ৯৯৯-এ কল করুন বা নিকটস্থ থানাকে জানান।</li></ol></div>
    <AppealLink /></div></div></div>;
  return <div className="mt-6 flex max-w-2xl gap-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-5"><CheckCircle2 className="size-8 shrink-0 text-emerald-600"/><div><h3 className="font-black text-emerald-900">বর্তমানে কোনো রিপোর্ট পাওয়া যায়নি</h3><p className="mt-1 text-sm leading-6 text-emerald-800">এটি পণ্যটির বৈধতার নিশ্চয়তা নয়—অনেকে রিপোর্টই করেন না। কেনার আগে: নম্বরটি ডিভাইস, বক্স ও রসিদে এক কি না মেলান, বিক্রেতার NID দেখুন, আর লেনদেন প্রকাশ্য জায়গায় করুন।</p></div></div>;
}
