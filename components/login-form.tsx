"use client";

import { useActionState, useEffect, useRef } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { loginAction, type LoginState } from "@/app/login/actions";
import { buttonClass, FieldError, inputClass } from "@/components/page-bits";
import Turnstile, { type TurnstileHandle } from "@/components/turnstile";

export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { step: "email" });
  const turnstile = useRef<TurnstileHandle>(null);
  // A Turnstile token is single-use: get a fresh one after every server response.
  useEffect(() => { turnstile.current?.reset(); }, [state]);

  if (state.step === "code") {
    return <form action={action} className="grid gap-4">
      <input type="hidden" name="email" value={state.email} />
      <input type="hidden" name="next" value={next} />
      <p className="rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-900"><Mail className="mr-2 inline size-4" /><b>{state.email}</b> ঠিকানায় একটি ৬ অঙ্কের কোড পাঠানো হয়েছে। কোডটি ১০ মিনিট কার্যকর।</p>
      <label><span className="mb-2 block text-sm font-bold text-emerald-950">লগইন কোড</span>
        <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus aria-invalid={!!state.error} className={`${inputClass} text-center font-mono text-2xl tracking-[.5em]`} placeholder="••••••" /></label>
      <FieldError message={state.error} />
      <Turnstile ref={turnstile} action="login-resend" />
      <button name="intent" value="verify" disabled={pending} className={buttonClass}>{pending ? "যাচাই হচ্ছে…" : "লগইন করুন"} <ArrowRight className="size-4" /></button>
      <button name="intent" value="send" disabled={pending} formNoValidate className="text-sm font-bold text-emerald-700 underline underline-offset-4">নতুন কোড পাঠান</button>
    </form>;
  }

  return <form action={action} className="grid gap-4">
    <input type="hidden" name="next" value={next} />
    <label><span className="mb-2 block text-sm font-bold text-emerald-950">ইমেইল ঠিকানা</span>
      <input name="email" type="email" autoComplete="email" required autoFocus defaultValue={state.email} aria-invalid={!!state.error} className={inputClass} placeholder="you@example.com" /></label>
    <FieldError message={state.error} />
    <Turnstile ref={turnstile} action="login" />
    <button name="intent" value="send" disabled={pending} className={buttonClass}>{pending ? "পাঠানো হচ্ছে…" : "কোড পাঠান"} <ArrowRight className="size-4" /></button>
    <p className="text-xs leading-5 text-slate-500">পাসওয়ার্ড লাগবে না। প্রথমবার লগইন করলে স্বয়ংক্রিয়ভাবে অ্যাকাউন্ট তৈরি হবে।</p>
  </form>;
}
