"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { fileDisputeAction, type DisputeState } from "@/app/dispute/actions";
import { buttonClass, FieldError, inputClass } from "@/components/page-bits";
import { ACCEPT_ATTR, LIMIT_LABEL } from "@/lib/evidence";
import { submitWithEvidence } from "@/lib/evidence-client";
import { DISPUTE_REASONS } from "@/lib/report-schema";

const label = "mb-2 block text-sm font-bold text-emerald-950";

export default function DisputeForm() {
  const [state, action, pending] = useActionState<DisputeState, FormData>(fileDisputeAction, {});
  const e = state.errors ?? {};

  if (state.reference) {
    return <div role="status" className="rounded-[2rem] border border-emerald-200 bg-white p-8 text-center shadow-xl md:p-10">
      <CheckCircle2 className="mx-auto size-14 text-emerald-600" />
      <h2 className="mt-4 text-2xl font-black text-emerald-950">আপত্তি গ্রহণ করা হয়েছে</h2>
      <p className="mt-3 text-slate-600">রেফারেন্স: <b className="font-mono text-emerald-950">{state.reference}</b></p>
      <p className="mt-1 text-sm text-slate-500">একজন যাচাইকারী উভয় পক্ষের প্রমাণ দেখে সিদ্ধান্ত নেবেন এবং ইমেইলে জানাবেন।</p>
      <Link href="/dashboard" className="mt-6 inline-block rounded-xl bg-emerald-900 px-5 py-3 text-sm font-bold text-white">ড্যাশবোর্ডে অবস্থা দেখুন</Link>
    </div>;
  }

  return <form onSubmit={(ev) => { ev.preventDefault(); void submitWithEvidence(new FormData(ev.currentTarget), action); }} noValidate className="grid gap-5 rounded-[2rem] border border-emerald-950/10 bg-white p-5 shadow-xl shadow-emerald-950/5 md:p-8">
    {state.formError && <div role="alert" className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-800"><AlertTriangle className="size-5 shrink-0" />{state.formError}</div>}
    <label><span className={label}>যে নম্বরটি “রিপোর্টেড” দেখাচ্ছে</span>
      <input name="identifier" required maxLength={128} autoComplete="off" spellCheck={false} aria-invalid={!!e.identifier} className={`${inputClass} font-mono`} placeholder="IMEI / Serial / VIN" /><FieldError message={e.identifier} /></label>
    <fieldset><legend className={label}>আপত্তির কারণ</legend>
      <div className="grid gap-2 sm:grid-cols-2">{DISPUTE_REASONS.map((r) => <label key={r} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-bold has-[:checked]:border-emerald-700 has-[:checked]:bg-emerald-50"><input type="radio" name="reason" value={r} required className="accent-emerald-700" />{r}</label>)}</div>
      <FieldError message={e.reason} /></fieldset>
    <label><span className={label}>বিস্তারিত</span>
      <textarea name="details" required rows={4} maxLength={2000} aria-invalid={!!e.details} className="w-full rounded-xl border border-slate-200 p-4 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 aria-[invalid=true]:border-red-400" placeholder="কবে, কার কাছ থেকে, কত টাকায় কিনেছেন বা কেন রিপোর্টটি ভুল—লিখুন" /><FieldError message={e.details} /></label>
    <label><span className={label}>প্রমাণ <span className="font-normal text-slate-500">(ঐচ্ছিক, তবে খুবই সহায়ক)</span></span>
      <input name="evidence" type="file" multiple accept={ACCEPT_ATTR} className="block w-full text-sm" />
      <p className="mt-1.5 text-xs leading-5 text-slate-500">ক্রয়ের রসিদ, বিক্রেতার সাথে চুক্তি বা মেসেজের স্ক্রিনশট। PDF/JPG/PNG · {LIMIT_LABEL}।</p><FieldError message={e.evidence} /></label>
    <label className="flex items-start gap-3 text-sm leading-6 text-slate-600"><input name="attest" type="checkbox" required className="mt-1 accent-emerald-800" />আমি নিশ্চিত করছি যে তথ্যগুলো সত্য এবং মিথ্যা আপত্তির আইনগত দায় সম্পর্কে অবগত।</label>
    <FieldError message={e.attest} />
    <button disabled={pending} className={buttonClass}>{pending ? "জমা হচ্ছে…" : "আপত্তি জমা দিন"} <ArrowRight className="size-4" /></button>
  </form>;
}
