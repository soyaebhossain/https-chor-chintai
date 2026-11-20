"use client";

import { useEffect, useRef } from "react";

/**
 * Brings its parent into view when it first appears. Used for confirmation
 * cards that replace a long form: without it a phone user stays scrolled
 * near the old submit button and never sees the confirmation heading.
 */
export default function ScrollHere() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const target = ref.current?.parentElement;
    if (!target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, []);
  return <span ref={ref} hidden />;
}
