"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { passwordAuthAction, type PasswordState } from "@/app/login/password-actions";
import LoginForm from "@/components/login-form";
import { buttonClass, FieldError, inputClass } from "@/components/page-bits";
import Turnstile, { type TurnstileHandle } from "@/components/turnstile";
import { suggestEmail } from "@/lib/email-typo";

const tab = (active: boolean) =>
  `flex-1 rounded-xl px-4 py-2.5 text-sm font-bold ${active ? "bg-emerald-900 text-white" : "text-slate-500 hover:bg-emerald-50"}`;

/** Email + password login and sign-up; the email-code login is offered too when the site can send email. */
export default function PasswordForm({ next, codeLogin }: { next: string; codeLogin: boolean }) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(passwordAuthAction, { mode: "login" });
  // The tab the user picked applies until the server answers; then the server's mode wins
  // (e.g. "this email already has an account" switches to the login tab).
  const [picked, setPicked] = useState<{ mode: "login" | "signup"; for: PasswordState }>({ mode: state.mode, for: state });
  const mode = picked.for === state ? picked.mode : state.mode;
  const setMode = (m: "login" | "signup") => setPicked({ mode: m, for: state });
  const [useCode, setUseCode] = useState(false);
  const [show, setShow] = useState(false);
  const [emailHint, setEmailHint] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const turnstile = useRef<TurnstileHandle>(null);
  useEffect(() => { turnstile.current?.reset(); }, [state]);

  if (useCode) {
    return <div className="grid gap-4">
      <LoginForm next={next} />
      <button type="button" onClick={() => setUseCode(false)} className="text-sm font-bold text-emerald-700 underline underline-offset-4">পাসওয়ার্ড দিয়ে লগইন</button>
    </div>;
  }

  const signup = mode === "signup";
  return <div className="grid gap-5">
    <div role="tablist" aria-label="লগইন বা নতুন অ্যাকাউন্ট" className="flex gap-2 rounded-2xl bg-slate-100 p-1.5">
      <button type="button" role="tab" aria-selected={!signup} onClick={() => setMode("login")} className={tab(!signup)}>লগইন</button>
      <button type="button" role="tab" aria-selected={signup} onClick={() => setMode("signup")} className={tab(signup)}>নতুন অ্যাকাউন্ট</button>
    </div>

    <form action={action} className="grid gap-4">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="pw-email" className="mb-2 block text-sm font-bold text-emerald-950">ইমেইল ঠিকানা</label>
        <input id="pw-email" ref={emailRef} name="email" type="email" autoComplete="email" required defaultValue={state.email} onBlur={(e) => setEmailHint(suggestEmail(e.target.value))} onChange={() => emailHint && setEmailHint(null)} aria-describedby={emailHint ? "pw-email-hint" : undefined} className={inputClass} placeholder="you@example.com" />
        {emailHint && <p id="pw-email-hint" role="status" className="mt-1.5 text-sm text-amber-800">আপনি কি <b>{emailHint}</b> লিখতে চেয়েছেন?{" "}
          <button type="button" onClick={() => { if (emailRef.current) emailRef.current.value = emailHint; setEmailHint(null); }} className="font-bold text-emerald-700 underline underline-offset-4">হ্যাঁ, ঠিক করুন</button></p>}
      </div>
      <div>
        <label htmlFor="pw-password" className="mb-2 block text-sm font-bold text-emerald-950">পাসওয়ার্ড</label>
        <div className="relative">
          <input id="pw-password" name="password" type={show ? "text" : "password"} autoComplete={signup ? "new-password" : "current-password"} required minLength={signup ? 10 : undefined} maxLength={128} aria-describedby={signup ? "pw-hint" : undefined} className={`${inputClass} pr-12`} />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখুন"} aria-controls="pw-password" className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-500">{show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}</button>
        </div>
        {signup && <p id="pw-hint" className="mt-1.5 text-xs text-slate-500">কমপক্ষে ১০ অক্ষর। মনে রাখার মতো একটি বাক্য ভালো, যেমন: “আমার-বাইক-লাল-২০২৬”।</p>}
      </div>
      {signup && <div>
        <label htmlFor="pw-confirm" className="mb-2 block text-sm font-bold text-emerald-950">পাসওয়ার্ড আবার লিখুন</label>
        <input id="pw-confirm" name="confirm" type={show ? "text" : "password"} autoComplete="new-password" required maxLength={128} className={inputClass} />
      </div>}
      <FieldError message={state.error} />
      <Turnstile ref={turnstile} action={signup ? "signup" : "password-login"} />
      <button disabled={pending} className={buttonClass}>{pending ? "অপেক্ষা করুন…" : signup ? "অ্যাকাউন্ট খুলুন" : "লগইন করুন"} <ArrowRight className="size-4" /></button>
      {signup
        ? <p className="text-xs leading-5 text-slate-500">ইতিমধ্যে অ্যাকাউন্ট আছে? <button type="button" onClick={() => setMode("login")} className="font-bold text-emerald-700 underline underline-offset-4">লগইন করুন</button></p>
        : <p className="text-xs leading-5 text-slate-500">পাসওয়ার্ড ভুলে গেলে আপাতত সাইটের যোগাযোগ ঠিকানায় জানান; ইমেইল চালু হলে নিজেই রিসেট করতে পারবেন।</p>}
    </form>

    {codeLogin && <button type="button" onClick={() => setUseCode(true)} className="text-sm font-bold text-emerald-700 underline underline-offset-4">পাসওয়ার্ড ছাড়া, ইমেইলে কোড দিয়ে লগইন</button>}
  </div>;
}
