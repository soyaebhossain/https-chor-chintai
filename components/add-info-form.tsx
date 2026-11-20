"use client";

import { useActionState } from "react";
import { addInfoAction, type AddInfoState } from "@/app/dashboard/actions";
import { FieldError } from "@/components/page-bits";
import { ACCEPT_ATTR } from "@/lib/evidence";

export default function AddInfoForm({ claimId }: { claimId: string }) {
  const [state, action, pending] = useActionState<AddInfoState, FormData>(addInfoAction, {});
  if (state.done) return <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">তথ্য পাঠানো হয়েছে। রিপোর্টটি আবার যাচাইয়ের সারিতে গেছে।</p>;
  return <form action={action} className="mt-4 grid gap-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
    <input type="hidden" name="claimId" value={claimId} />
    <label className="text-sm font-bold text-emerald-950">যাচাইকারীর জন্য উত্তর
      <textarea name="message" rows={3} maxLength={2000} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 font-normal outline-none focus:border-emerald-600" placeholder="যা জানতে চাওয়া হয়েছে তা লিখুন" /></label>
    <label className="text-sm font-bold text-emerald-950">অতিরিক্ত প্রমাণ (ঐচ্ছিক)
      <input name="evidence" type="file" multiple accept={ACCEPT_ATTR} className="mt-2 block w-full text-sm font-normal" /></label>
    <FieldError message={state.error} />
    <button disabled={pending} className="w-fit rounded-xl bg-emerald-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{pending ? "পাঠানো হচ্ছে…" : "তথ্য পাঠান"}</button>
  </form>;
}
