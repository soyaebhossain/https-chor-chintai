"use client";

import ScrollHere from "@/components/scroll-here";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, FileText, UploadCloud, X } from "lucide-react";
import { submitReportAction, type ReportState } from "@/app/report/actions";
import { buttonClass, FieldError, inputClass } from "@/components/page-bits";
import Turnstile, { type TurnstileHandle } from "@/components/turnstile";
import { ACCEPT_ATTR, LIMIT_LABEL } from "@/lib/evidence";
import { prepareEvidence } from "@/lib/evidence-client";
import { CATEGORIES, INCIDENT_LABEL, INCIDENT_TYPES, KIND_OF, NUMBER_HELP, type Category } from "@/lib/report-schema";

const label = "mb-2 block text-sm font-bold text-emerald-950";
const hint = "mt-1.5 text-xs leading-5 text-slate-500";
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return <fieldset className="grid gap-5 border-t border-slate-100 pt-6 first:border-t-0 first:pt-0 md:grid-cols-2">
    <legend className="mb-1 flex items-center gap-3 text-base font-black text-emerald-950 md:col-span-2"><span className="grid size-7 place-items-center rounded-full bg-emerald-900 text-xs text-white">{n}</span>{title}</legend>
    {children}
  </fieldset>;
}

export default function ReportForm() {
  const [state, action, pending] = useActionState<ReportState, FormData>(submitReportAction, {});
  const [category, setCategory] = useState<Category | "">("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string>();
  const turnstile = useRef<TurnstileHandle>(null);
  // A Turnstile token is single-use: get a fresh one after every server response.
  useEffect(() => { turnstile.current?.reset(); }, [state]);
  const e = state.errors ?? {};
  const help = NUMBER_HELP[category ? KIND_OF[category] : "other"];

  if (state.trackingId) {
    return <div role="status" className="scroll-mt-28 rounded-[2rem] border border-emerald-200 bg-white p-8 text-center shadow-xl md:p-10">
      <ScrollHere />
      <CheckCircle2 className="mx-auto size-14 text-emerald-600"/>
      <h2 className="mt-4 text-2xl font-black text-emerald-950">রিপোর্ট গ্রহণ করা হয়েছে</h2>
      <p className="mt-3 text-slate-600">Tracking ID: <b className="font-mono text-emerald-950">{state.trackingId}</b></p>
      <ol className="mx-auto mt-6 grid max-w-md gap-2 text-left text-sm leading-6 text-slate-600">
        <li>১. একজন যাচাইকারী আপনার প্রমাণ দেখবেন—সাধারণত ১–২ কার্যদিবস।</li>
        <li>২. অনুমোদন হলে নম্বরটি সার্চে “রিপোর্টেড” দেখাবে; অবস্থা “আমার রিপোর্ট”-এ দেখা যাবে।</li>
        <li>৩. পণ্য ফেরত পেলে ড্যাশবোর্ডে “ফেরত পেয়েছি” চাপুন।</li>
      </ol>
      <Link href="/dashboard" className="mt-6 inline-block rounded-xl bg-emerald-900 px-5 py-3 text-sm font-bold text-white">আমার রিপোর্ট দেখুন</Link>
    </div>;
  }

  async function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const picked = Array.from(list);
    setFileError(undefined);
    const prepared = await prepareEvidence(picked, files);
    if (!prepared.ok) { setFileError(prepared.error); return; }
    setFiles(prepared.files);
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    // Submit manually so React does not reset the form — on a validation error the user keeps what they typed.
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.delete("evidence");
    files.forEach((f) => data.append("evidence", f));
    startTransition(() => action(data));
  }

  return <form onSubmit={onSubmit} noValidate className="grid gap-8 rounded-[2rem] border border-emerald-950/10 bg-white p-5 shadow-xl shadow-emerald-950/5 md:p-8">
    {state.formError && <div role="alert" className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-800"><AlertTriangle className="size-5 shrink-0"/>{state.formError}</div>}

    <Step n="১" title="কোন পণ্য?">
      <label><span className={label}>পণ্যের ধরন</span>
        <select name="category" required value={category} onChange={(ev) => setCategory(ev.target.value as Category)} aria-invalid={!!e.category} className={inputClass}><option value="" disabled>বেছে নিন</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        <FieldError message={e.category} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label><span className={label}>ব্র্যান্ড</span><input name="brand" required maxLength={60} aria-invalid={!!e.brand} className={inputClass} placeholder="Samsung"/><FieldError message={e.brand} /></label>
        <label><span className={label}>মডেল</span><input name="model" required maxLength={80} aria-invalid={!!e.model} className={inputClass} placeholder="Galaxy S25"/><FieldError message={e.model} /></label>
      </div>
      <label><span className={label}>{help.first}</span><input name="identifier" required maxLength={128} autoComplete="off" spellCheck={false} inputMode={category && KIND_OF[category] === "phone" ? "numeric" : "text"} aria-invalid={!!e.identifier} className={`${inputClass} font-mono`}/>
        <p className={hint}>{help.firstHint}</p><FieldError message={e.identifier} /></label>
      <label><span className={label}>{help.second}</span><input name="identifier2" maxLength={128} autoComplete="off" spellCheck={false} inputMode={category && KIND_OF[category] === "phone" ? "numeric" : "text"} aria-invalid={!!e.identifier2} className={`${inputClass} font-mono`}/>
        <p className={hint}>{help.secondHint}</p><FieldError message={e.identifier2} /></label>
    </Step>

    <Step n="২" title="কী ঘটেছিল?">
      <fieldset><legend className={label}>ঘটনা</legend>
        <div className="grid grid-cols-3 gap-2">{INCIDENT_TYPES.map((t) => <label key={t} className="flex h-12 cursor-pointer items-center justify-center rounded-xl border border-slate-200 text-sm font-bold has-[:checked]:border-emerald-700 has-[:checked]:bg-emerald-50 has-[:checked]:text-emerald-900"><input type="radio" name="incidentType" value={t} required className="sr-only"/>{INCIDENT_LABEL[t]}</label>)}</div>
        <FieldError message={e.incidentType} /></fieldset>
      <label><span className={label}>তারিখ</span><input name="incidentDate" type="date" required defaultValue={today()} max={today()} aria-invalid={!!e.incidentDate} className={inputClass}/><FieldError message={e.incidentDate} /></label>
      <label><span className={label}>স্থান</span><input name="location" required maxLength={120} aria-invalid={!!e.location} className={inputClass} placeholder="এলাকা, জেলা — যেমন: ধানমন্ডি, ঢাকা"/>
        <p className={hint}>শুধু এলাকা ও জেলা দিন; বাসার ঠিকানা নয়—এটি প্রকাশ্যে দেখানো হবে।</p><FieldError message={e.location} /></label>
      <label><span className={label}>থানার জিডি / মামলা নম্বর <span className="font-normal text-slate-500">(ঐচ্ছিক)</span></span><input name="policeReference" maxLength={60} aria-invalid={!!e.policeReference} className={inputClass} placeholder="যেমন: ধানমন্ডি থানা জিডি ১২৩৪"/>
        <p className={hint}>জিডি থাকলে অনুমোদন দ্রুত হয়। অনলাইনে জিডি: Online GD (gd.police.gov.bd)।</p><FieldError message={e.policeReference} /></label>
      <label className="md:col-span-2"><span className={label}>সংক্ষেপে বিবরণ</span><textarea name="description" required rows={3} maxLength={2000} aria-invalid={!!e.description} className="w-full rounded-xl border border-slate-200 p-4 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 aria-[invalid=true]:border-red-400" placeholder="কখন, কোথায়, কীভাবে—দুই-তিন লাইনে লিখুন"/><FieldError message={e.description} /></label>
    </Step>

    <Step n="৩" title="মালিকানার প্রমাণ">
      <div className="md:col-span-2">
        <label className="grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50 p-8 text-center focus-within:ring-4 focus-within:ring-emerald-100">
          <UploadCloud className="size-8 text-emerald-700"/>
          <span className="mt-2 text-sm font-bold text-emerald-900">ফাইল বা ছবি যুক্ত করুন</span>
          <span className="mt-1 text-xs leading-5 text-slate-500">যেকোনো একটি যথেষ্ট: ক্রয়ের রসিদ, নম্বরসহ বক্সের ছবি, জিডির কপি, রেজিস্ট্রেশন কাগজ।<br/>PDF, JPG বা PNG · {LIMIT_LABEL} · ফাইল এনক্রিপ্ট করে গোপনে রাখা হয়, কখনো প্রকাশ হয় না।</span>
          <input name="evidence" type="file" multiple accept={ACCEPT_ATTR} className="sr-only" onChange={(ev) => { const list = ev.target.files; void addFiles(list).finally(() => { ev.target.value = ""; }); }}/>
        </label>
        {files.length > 0 && <ul className="mt-3 grid gap-2">{files.map((f, i) => <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm"><span className="flex min-w-0 items-center gap-2"><FileText className="size-4 shrink-0 text-emerald-700"/><span className="truncate">{f.name}</span><span className="shrink-0 text-xs text-slate-400">{(f.size / 1024 / 1024).toFixed(1)}MB</span></span><button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`${f.name} সরান`} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X className="size-4"/></button></li>)}</ul>}
        <FieldError message={fileError ?? e.evidence} />
      </div>
    </Step>

    <div>
      <label className="flex items-start gap-3 text-sm leading-6 text-slate-600"><input name="attest" type="checkbox" required className="mt-1 accent-emerald-800"/>আমি নিশ্চিত করছি যে আমি এই পণ্যের বৈধ মালিক, তথ্যগুলো সত্য এবং মিথ্যা রিপোর্টের আইনগত দায় সম্পর্কে অবগত।</label>
      <FieldError message={e.attest} />
      <div className="mt-4"><Turnstile ref={turnstile} action="report" /></div>
      <button disabled={pending} className={`${buttonClass} mt-6 w-full`}>{pending ? "জমা হচ্ছে…" : "রিপোর্ট জমা দিন"} <ArrowRight className="size-4"/></button>
    </div>
  </form>;
}
