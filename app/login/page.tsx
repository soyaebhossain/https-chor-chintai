import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import LoginForm from "@/components/login-form";
import { Title } from "@/components/page-bits";
import PageFrame from "@/components/page-frame";
import { safeNextPath } from "@/lib/safe-path";
import { getSession, isStaff } from "@/lib/server/auth";
import { mailAvailable } from "@/lib/server/mailer";

export const metadata: Metadata = { title: "লগইন — চুরি-ছিন্তাই", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const requested = (await searchParams).next;
  // Only forward an explicit destination; otherwise the server picks one by role (admins → /admin).
  const next = requested ? safeNextPath(requested) : "";
  const session = await getSession();
  if (session) redirect(next || (isStaff(session.user.role) ? "/admin" : "/dashboard"));
  return <PageFrame>
    <section className="mx-auto max-w-md">
      <Title eyebrow="অ্যাকাউন্ট" title="লগইন করুন" text="রিপোর্ট জমা দিতে ও অবস্থা দেখতে ইমেইলে পাঠানো কোড দিয়ে লগইন করুন।" />
      <div className="rounded-[2rem] border border-emerald-950/10 bg-white p-6 shadow-xl shadow-emerald-950/5 md:p-8">{mailAvailable()
        ? <LoginForm next={next} />
        : <div role="status" className="grid gap-3 text-sm leading-6 text-slate-600"><p className="font-black text-emerald-950">লগইন শিগগিরই চালু হবে</p><p>রিপোর্ট জমা ও ড্যাশবোর্ডের জন্য ইমেইলে কোড পাঠানো হয়। সেটি এখনো চালু করা হয়নি। এর মধ্যে হোম পেজ থেকে যেকোনো IMEI, Serial বা VIN যাচাই করতে পারবেন।</p><Link href="/" className="w-fit rounded-xl bg-emerald-900 px-5 py-3 font-bold text-white">পণ্য যাচাই করুন</Link></div>}</div>
    </section>
  </PageFrame>;
}
