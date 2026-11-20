"use client";

import { useActionState } from "react";
import { LockKeyhole } from "lucide-react";
import { adminLoginAction } from "@/app/actions";

export default function AdminLogin() {
  const [error, action, pending] = useActionState(adminLoginAction, null);
  return (
    <form action={action} className="mx-auto max-w-sm rounded-3xl border border-emerald-950/10 bg-white p-6 shadow-sm">
      <LockKeyhole className="size-8 text-emerald-700" aria-hidden />
      <h1 className="mt-3 text-xl font-black text-emerald-950">যাচাইকারী লগইন</h1>
      <label className="mt-5 block text-sm font-bold text-emerald-950">
        পাসওয়ার্ড
        <input name="password" type="password" required autoComplete="current-password" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-600" />
      </label>
      {error ? <p role="alert" className="mt-3 text-sm font-bold text-red-700">{error}</p> : null}
      <button disabled={pending} className="mt-5 h-11 w-full rounded-xl bg-emerald-900 text-sm font-bold text-white disabled:opacity-60">লগইন</button>
    </form>
  );
}
