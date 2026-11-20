"use client";

import { useActionState, useState } from "react";
import { PartyPopper } from "lucide-react";
import { markRecoveredAction, type RecoverState } from "@/app/dashboard/actions";
import { FieldError } from "@/components/page-bits";

/** Two-step so a stray tap cannot take down a live alert. */
export default function RecoverForm({ claimId }: { claimId: string }) {
  const [state, action, pending] = useActionState<RecoverState, FormData>(markRecoveredAction, {});
  const [open, setOpen] = useState(false);
  if (state.done) return <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">অভিনন্দন! সতর্কতাটি সরিয়ে নেওয়া হয়েছে—এই নম্বর আর “রিপোর্টেড” দেখাবে না।</p>;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-900 hover:bg-emerald-100"><PartyPopper className="size-4" />পণ্যটি ফেরত পেয়েছি</button>;
  return <form action={action} className="mt-4 grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
    <input type="hidden" name="claimId" value={claimId} />
    <p className="text-sm leading-6 text-emerald-950">নিশ্চিত করলে পাবলিক সতর্কতা সঙ্গে সঙ্গে সরে যাবে। আবার হারালে নতুন করে রিপোর্ট করতে পারবেন।</p>
    <label className="text-sm font-bold text-emerald-950">কীভাবে ফেরত পেলেন? <span className="font-normal text-slate-500">(ঐচ্ছিক, শুধু যাচাইকারীরা দেখবেন)</span>
      <input name="note" maxLength={1000} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-normal outline-none focus:border-emerald-600" placeholder="যেমন: পুলিশ উদ্ধার করেছে" /></label>
    <FieldError message={state.error} />
    <div className="flex gap-2">
      <button disabled={pending} className="rounded-xl bg-emerald-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{pending ? "সংরক্ষণ হচ্ছে…" : "হ্যাঁ, ফেরত পেয়েছি"}</button>
      <button type="button" onClick={() => setOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600">বাতিল</button>
    </div>
  </form>;
}
