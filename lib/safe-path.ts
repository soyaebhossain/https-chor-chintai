/** Only same-site relative paths are allowed as post-login destinations (no open redirects). */
export function safeNextPath(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const url = new URL(value, "https://app.invalid");
    if (url.origin !== "https://app.invalid" || url.pathname.startsWith("/login")) return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}
