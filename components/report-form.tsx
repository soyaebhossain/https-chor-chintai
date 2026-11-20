"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowRight, CheckCircle2, LoaderCircle, UploadCloud } from "lucide-react";
import { submitReportAction, type ReportState } from "@/app/actions";
import { categoryLabels, incidentLabels } from "@/lib/labels";
import { categories, incidentTypes } from "@/db/schema";

const input = "h-12 w-full rounded-xl border border-slate-200 bg-white px-4 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 aria-[invalid=true]:border-red-400";

export default function ReportForm() {
  const [state, action, pending] = useActionState<ReportState, FormData>(submitReportAction, null);
  const [fileNames, setFileNames] = useState<string[]>([]);

  if (state?.ok) return <Success trackingId={state.trackingId} />;

  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const values = state && !state.ok ? (state.values ?? {}) : {};
  const today = new Date().toISOString().slice(0, 10);

  const a11y = (name: string) => ({ id: name, name, "aria-invalid": Boolean(errors[name]) || undefined, "aria-describedby": errors[name] ? `${name}-error` : undefined });

  return (
    <form action={action} noValidate onReset={() => setFileNames([])} className="rounded-[2rem] border border-emerald-950/10 bg-white p-5 shadow-xl shadow-emerald-950/5 md:p-8">
      {state && !state.ok && state.error ? <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-800">{state.error}</p> : null}
      {state && !state.ok && Object.keys(errors).length ? <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-800">কিছু তথ্য ঠিক করতে হবে। নিচে লাল লেখা দেখুন।</p> : null}

      <fieldset className="grid gap-5 md:grid-cols-2">
        <legend className="mb-4 text-lg font-black text-emerald-950">১. পণ্যের তথ্য</legend>
        <Field errors={errors} name="category" label="পণ্যের ধরন">
          <select {...a11y("category")} defaultValue={values.category ?? ""} className={input} required>
            <option value="" disabled>বেছে নিন</option>
            {categories.map((c) => <option key={c} value={c}>{categoryLabels[c]}</option>)}
          </select>
        </Field>
        <Field errors={errors} name="brandModel" label="ব্র্যান্ড ও মডেল">
          <input {...a11y("brandModel")} defaultValue={values.brandModel} className={input} placeholder="যেমন: Samsung Galaxy S24" required maxLength={120} />
        </Field>
        <Field errors={errors} name="identifier" label="IMEI / Serial / VIN" hint="মোবাইলের IMEI বক্সে বা রসিদে লেখা থাকে। নম্বরের ধরন আমরা নিজেই বুঝে নেব।" wide>
          <input {...a11y("identifier")} defaultValue={values.identifier} className={`${input} font-mono`} placeholder="যেমন: 356938035643809" required maxLength={64} autoComplete="off" />
        </Field>
      </fieldset>

      <fieldset className="mt-8 grid gap-5 md:grid-cols-2">
        <legend className="mb-4 text-lg font-black text-emerald-950">২. ঘটনার তথ্য</legend>
        <Field errors={errors} name="incidentType" label="কী ঘটেছে">
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-describedby={errors.incidentType ? "incidentType-error" : undefined}>
            {incidentTypes.map((t) => (
              <label key={t} className="flex h-12 cursor-pointer items-center justify-center rounded-xl border border-slate-200 text-sm font-bold has-[:checked]:border-emerald-700 has-[:checked]:bg-emerald-50 has-[:checked]:text-emerald-900">
                <input type="radio" name="incidentType" value={t} defaultChecked={values.incidentType === t} className="sr-only" required />
                {incidentLabels[t]}
              </label>
            ))}
          </div>
        </Field>
        <Field errors={errors} name="incidentDate" label="ঘটনার তারিখ">
          <input {...a11y("incidentDate")} type="date" max={today} defaultValue={values.incidentDate} className={input} required />
        </Field>
        <Field errors={errors} name="location" label="ঘটনার এলাকা" hint="শুধু এলাকা ও শহর, যেমন: ধানমন্ডি, ঢাকা। পুরো ঠিকানা দেবেন না।">
          <input {...a11y("location")} defaultValue={values.location} className={input} placeholder="এলাকা, শহর" required maxLength={120} />
        </Field>
        <Field errors={errors} name="policeReference" label="থানার জিডি / মামলা নম্বর (যদি থাকে)">
          <input {...a11y("policeReference")} defaultValue={values.policeReference} className={input} placeholder="যেমন: ধানমন্ডি থানা জিডি ১২৩৪" maxLength={80} />
        </Field>
        <Field errors={errors} name="description" label="ঘটনার বিবরণ" wide>
          <textarea {...a11y("description")} defaultValue={values.description} rows={4} className="w-full rounded-xl border border-slate-200 p-4 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 aria-[invalid=true]:border-red-400" placeholder="কখন ও কীভাবে ঘটনাটি ঘটেছে লিখুন" required minLength={20} maxLength={2000} />
        </Field>
      </fieldset>

      <fieldset className="mt-8 grid gap-5 md:grid-cols-2">
        <legend className="mb-4 text-lg font-black text-emerald-950">৩. প্রমাণ ও যোগাযোগ</legend>
        <div className="md:col-span-2">
          <label htmlFor="evidence" className="grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50 p-8 text-center focus-within:ring-4 focus-within:ring-emerald-100">
            <UploadCloud className="size-8 text-emerald-700" aria-hidden />
            <span className="mt-2 text-sm font-bold text-emerald-900">রসিদ, বক্স, জিডি কপি বা মালিকানার প্রমাণ</span>
            <span className="mt-1 text-xs text-slate-500">PDF, JPG, PNG বা WEBP · প্রতিটি সর্বোচ্চ 5MB · সর্বোচ্চ ৫টি</span>
            {fileNames.length ? <span className="mt-3 text-xs font-bold text-emerald-800">{fileNames.join(", ")}</span> : null}
            <input id="evidence" name="evidence" type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setFileNames([...(e.target.files ?? [])].map((f) => f.name))} />
          </label>
          {errors.evidence ? <p className="mt-1.5 text-sm font-bold text-red-700">{errors.evidence}</p> : <p className="mt-1.5 text-xs text-slate-500">জিডি নম্বর অথবা অন্তত একটি প্রমাণ দরকার। ফাইলগুলো শুধু যাচাইকারী দেখতে পান।</p>}
        </div>
        <Field errors={errors} name="phone" label="আপনার মোবাইল নম্বর" hint="কখনো প্রকাশ করা হয় না। অন্য ফোন থেকে রিপোর্ট দেখতে ও যাচাইকারীর যোগাযোগের জন্য লাগবে।">
          <input {...a11y("phone")} type="tel" inputMode="tel" autoComplete="tel" defaultValue={values.phone} className={input} placeholder="01XXXXXXXXX" required />
        </Field>
      </fieldset>

      <label className="mt-6 flex items-start gap-3 text-sm leading-6 text-slate-600">
        <input name="consent" required type="checkbox" className="mt-1 accent-emerald-800" aria-describedby={errors.consent ? "consent-error" : undefined} />
        আমি নিশ্চিত করছি যে তথ্যগুলো সত্য এবং মিথ্যা রিপোর্টের আইনগত দায় সম্পর্কে অবগত।
      </label>
      {errors.consent ? <p id="consent-error" className="mt-1.5 text-sm font-bold text-red-700">{errors.consent}</p> : null}

      <button disabled={pending} className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-900 font-black text-white disabled:opacity-60">
        {pending ? <><LoaderCircle className="size-4 animate-spin" aria-hidden /> জমা হচ্ছে…</> : <>রিপোর্ট জমা দিন <ArrowRight className="size-4" aria-hidden /></>}
      </button>
    </form>
  );
}

function Field({ name, label, hint, children, wide, errors }: { name: string; label: string; hint?: string; children: React.ReactNode; wide?: boolean; errors: Record<string, string> }) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <label htmlFor={name} className="mb-2 block text-sm font-bold text-emerald-950">{label}</label>
      {children}
      {errors[name] ? <p id={`${name}-error`} className="mt-1.5 text-sm font-bold text-red-700">{errors[name]}</p> : hint ? <p className="mt-1.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function Success({ trackingId }: { trackingId: string }) {
  return (
    <div role="status" className="rounded-[2rem] border border-emerald-200 bg-white p-8 text-center shadow-xl md:p-10">
      <CheckCircle2 className="mx-auto size-14 text-emerald-600" aria-hidden />
      <h2 className="mt-4 text-2xl font-black text-emerald-950">রিপোর্ট জমা হয়েছে</h2>
      <p className="mt-3 text-slate-600">আপনার Tracking ID</p>
      <p className="mt-1 font-mono text-2xl font-black tracking-wider text-emerald-900">{trackingId}</p>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">এটি লিখে রাখুন। যাচাইকারী অনুমোদন দিলে নম্বরটি সার্চে সতর্কতা হিসেবে দেখাবে।</p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/dashboard" className="rounded-xl bg-emerald-900 px-5 py-3 text-sm font-bold text-white">আমার রিপোর্টে দেখুন</Link>
        <a href="/report" className="rounded-xl border border-emerald-900/15 px-5 py-3 text-sm font-bold text-emerald-900">আরেকটি রিপোর্ট</a>
      </div>
    </div>
  );
}
