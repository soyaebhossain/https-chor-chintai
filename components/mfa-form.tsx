"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { verifyMfaAction, type MfaState } from "@/app/account/mfa/actions";
import { buttonClass, FieldError, inputClass } from "@/components/page-bits";

export default function MfaForm({ next, label }: { next: string; label: string }) {
  const [state, action, pending] = useActionState<MfaState, FormData>(verifyMfaAction, {});
  return <form action={action} className="grid gap-4">
    <input type="hidden" name="next" value={next} />
    <label><span className="mb-2 block text-sm font-bold text-emerald-950">Authenticator অ্যাপের ৬ অঙ্কের কোড</span>
      <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus aria-invalid={!!state.error} className={`${inputClass} text-center font-mono text-2xl tracking-[.5em]`} placeholder="••••••" /></label>
    <FieldError message={state.error} />
    <button disabled={pending} className={buttonClass}>{pending ? "যাচাই হচ্ছে…" : label} <ArrowRight className="size-4" /></button>
  </form>;
}
