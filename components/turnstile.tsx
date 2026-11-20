"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window { turnstile?: TurnstileApi }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** False in local development without keys: the server skips the check too. */
export const turnstileEnabled = Boolean(SITE_KEY);

let loading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { loading = null; reject(new Error("Turnstile failed to load")); };
    document.head.appendChild(s);
  });
  return loading;
}

export type TurnstileHandle = { reset: () => void };

/**
 * Cloudflare Turnstile bot check. Invisible unless Cloudflare needs the person
 * to click. Inside a <form> it adds a hidden `cf-turnstile-response` field;
 * `onToken` also receives the token for fetch() callers. Tokens are single-use:
 * call `reset()` after every submission.
 */
export default function Turnstile({ action, onToken, ref }: { action: string; onToken?: (token: string | null) => void; ref?: Ref<TurnstileHandle> }) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const callback = useRef(onToken);
  useEffect(() => { callback.current = onToken; }, [onToken]);

  useImperativeHandle(ref, () => ({
    reset() {
      callback.current?.(null);
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
    },
  }), []);

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled || !container.current || !window.turnstile) return;
      widgetId.current = window.turnstile.render(container.current, {
        sitekey: SITE_KEY,
        action,
        appearance: "interaction-only",
        callback: (token: string) => callback.current?.(token),
        "expired-callback": () => callback.current?.(null),
        "error-callback": () => callback.current?.(null),
      });
    }).catch(() => callback.current?.(null));
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [action]);

  if (!SITE_KEY) return null;
  return <div ref={container} />;
}
