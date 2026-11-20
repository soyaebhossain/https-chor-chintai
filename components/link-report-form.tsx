"use client";

import { useActionState } from "react";
import { linkReportAction } from "@/app/actions";

export default function LinkReportForm() {
  const [message, action, pending] = useActionState(linkReportAction, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className="text-sm font-bold text-emerald-950">
        Tracking ID
        <input name="trackingId" required placeholder="CC-XXXX-XXXX" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono uppercase outline-none focus:border-emerald-600" />
      </label>
      <label className="text-sm font-bold text-emerald-950">
        রিপোর্টে দেওয়া মোবাইল নম্বর
        <input name="phone" type="tel" required placeholder="01XXXXXXXXX" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-emerald-600" />
      </label>
      <button disabled={pending} className="h-11 rounded-xl bg-emerald-900 px-5 text-sm font-bold text-white disabled:opacity-60">যোগ করুন</button>
      {message ? <p role="status" className="text-sm font-bold text-emerald-900 sm:col-span-3">{message}</p> : null}
    </form>
  );
}
