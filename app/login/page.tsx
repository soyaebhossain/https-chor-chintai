import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LoginForm from "@/components/login-form";
import { Title } from "@/components/page-bits";
import PageFrame from "@/components/page-frame";
import { safeNextPath } from "@/lib/safe-path";
import { getSession, isStaff } from "@/lib/server/auth";

export const metadata: Metadata = { title: "লগইন — চোর ছিনতাই", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const requested = (await searchParams).next;
  // Only forward an explicit destination; otherwise the server picks one by role (admins → /admin).
  const next = requested ? safeNextPath(requested) : "";
  const session = await getSession();
  if (session) redirect(next || (isStaff(session.user.role) ? "/admin" : "/dashboard"));
  return <PageFrame>
    <section className="mx-auto max-w-md">
      <Title eyebrow="অ্যাকাউন্ট" title="লগইন করুন" text="রিপোর্ট জমা দিতে ও অবস্থা দেখতে ইমেইলে পাঠানো কোড দিয়ে লগইন করুন।" />
      <div className="rounded-[2rem] border border-emerald-950/10 bg-white p-6 shadow-xl shadow-emerald-950/5 md:p-8"><LoginForm next={next} /></div>
    </section>
  </PageFrame>;
}
