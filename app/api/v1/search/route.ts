import { z } from "zod";
import { searchRegistry } from "@/lib/server/registry";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";
import { TURNSTILE_ERROR, verifyTurnstile } from "@/lib/server/turnstile";

const Body = z.object({ query: z.string(), turnstileToken: z.string().max(2048).optional() });
const MAX_QUERY = 128;

const noStore = { "Cache-Control": "no-store" };

// Enough for a real buyer checking a handful of devices; far too slow to enumerate IMEI ranges.
const PER_MINUTE = 10;
const PER_DAY = 200;

export async function POST(request: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return Response.json({ error: "Body must be JSON: { \"query\": string }" }, { status: 400, headers: noStore });
  }
  if (body.query.length > MAX_QUERY) {
    return Response.json(
      { status: "invalid", error: "LENGTH", message: "নম্বরটি ৪ থেকে ৬৪ অক্ষরের হতে হবে (IMEI ১৫ অঙ্ক, VIN ১৭ অক্ষর)।" },
      { status: 422, headers: noStore },
    );
  }

  try {
    const ip = clientIp(request.headers);
    const [minute, day] = await Promise.all([rateLimit("search-min", ip, PER_MINUTE, 60), rateLimit("search-day", ip, PER_DAY, 86_400)]);
    const blocked = !minute.ok ? minute : !day.ok ? day : null;
    if (blocked) {
      return Response.json(
        { error: "অনেকগুলো অনুসন্ধান করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" },
        { status: 429, headers: { ...noStore, "Retry-After": String(blocked.retryAfterSeconds) } },
      );
    }

    if (!(await verifyTurnstile(body.turnstileToken, ip))) {
      return Response.json({ error: TURNSTILE_ERROR }, { status: 403, headers: noStore });
    }

    const result = await searchRegistry(body.query);
    return Response.json(result, { status: result.status === "invalid" ? 422 : 200, headers: noStore });
  } catch (error) {
    // Never log the identifier itself.
    console.error("registry search failed:", error instanceof Error ? error.message : error);
    return Response.json(
      { error: "অনুসন্ধান এই মুহূর্তে করা যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।" },
      { status: 503, headers: noStore },
    );
  }
}
