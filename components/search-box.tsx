"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Fingerprint, LoaderCircle, LockKeyhole } from "lucide-react";
import { searchAction } from "@/app/actions";
import { categoryLabels, formatDate, incidentLabels } from "@/lib/labels";
import type { SearchResult } from "@/lib/reports";
import type { Category, IncidentType } from "@/db/schema";

export default function SearchBox() {
  const [result, action, pending] = useActionState(searchAction, null);
  const [query, setQuery] = useState("");

  return (
    <>
      <form action={action} className="mt-8 flex max-w-3xl flex-col gap-3 rounded-[1.6rem] border border-emerald-900/10 bg-white p-3 shadow-2xl shadow-emerald-950/10 sm:flex-row">
        <label className="flex min-w-0 flex-1 items-center gap-3 px-3">
          <Fingerprint className="size-5 shrink-0 text-emerald-700" aria-hidden />
          <span className="sr-only">পণ্যের নম্বর</span>
          <input
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            required
            autoComplete="off"
            inputMode="text"
            maxLength={64}
            className="h-13 w-full min-w-0 bg-transparent text-base outline-none placeholder:text-slate-400"
            placeholder="IMEI / Serial / VIN লিখুন"
          />
        </label>
        <button disabled={pending} className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-emerald-950 px-7 font-black text-white transition hover:bg-emerald-800 disabled:opacity-60">
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
          যাচাই করুন <ArrowRight className="size-4" aria-hidden />
        </button>
      </form>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><LockKeyhole className="size-3.5 text-emerald-600" aria-hidden /> নম্বর সংরক্ষণ করা হয় না</span>
        <span className="flex items-center gap-1.5"><Clock3 className="size-3.5 text-emerald-600" aria-hidden /> ফোনের IMEI জানতে *#06# ডায়াল করুন</span>
      </div>
      <div aria-live="polite">{result && <SearchCard result={result} />}</div>
    </>
  );
}

function SearchCard({ result }: { result: SearchResult }) {
  if (result.status === "invalid")
    return <p className="mt-6 max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">{result.error}</p>;
  if (result.status === "clear")
    return (
      <div className="mt-6 flex max-w-2xl gap-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
        <CheckCircle2 className="size-8 shrink-0 text-emerald-600" aria-hidden />
        <div>
          <h2 className="font-black text-emerald-900">কোনো যাচাইকৃত রিপোর্ট পাওয়া যায়নি</h2>
          <p className="mt-1 text-sm leading-6 text-emerald-800">এটি পণ্যটির বৈধতার নিশ্চয়তা নয়। রসিদ, বিক্রেতার পরিচয় ও মালিকানা আলাদাভাবে যাচাই করুন।</p>
        </div>
      </div>
    );
  const m = result.match;
  return (
    <div className="mt-6 max-w-2xl rounded-3xl border border-red-200 bg-red-50 p-5">
      <div className="flex gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-red-600 text-white"><AlertTriangle aria-hidden /></span>
        <div>
          <h2 className="text-lg font-black text-red-900">সতর্কতা: এই নম্বরে {incidentLabels[m.incidentType as IncidentType]}-এর রিপোর্ট আছে</h2>
          <p className="mt-1 text-sm leading-6 text-red-800">পণ্যটি কিনবেন না। নিকটস্থ থানায় বা ৯৯৯-এ জানান।</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div><dt className="text-red-500">পণ্য</dt><dd className="font-bold">{categoryLabels[m.category as Category]} · {m.brandModel}</dd></div>
            <div><dt className="text-red-500">নম্বর</dt><dd className="font-mono font-bold">•••• {m.last4}</dd></div>
            <div><dt className="text-red-500">এলাকা</dt><dd className="font-bold">{m.location}</dd></div>
            <div><dt className="text-red-500">ঘটনার তারিখ</dt><dd className="font-bold">{formatDate(m.incidentDate)}</dd></div>
          </dl>
        </div>
      </div>
    </div>
  );
}
