import type { Metadata, Viewport } from "next";
import { Noto_Sans_Bengali } from "next/font/google";
import "./globals.css";

const bengali = Noto_Sans_Bengali({ subsets: ["bengali", "latin"], weight: ["400", "700", "900"], display: "swap" });

import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "চোর ছিনতাই — চুরি হওয়া মোবাইল, বাইক ও ল্যাপটপ যাচাই",
  description: "সেকেন্ডহ্যান্ড কেনার আগে IMEI, Serial বা VIN দিয়ে দেখুন পণ্যটি চুরি বা ছিনতাইয়ের যাচাইকৃত রিপোর্টে আছে কি না। নিজের হারানো পণ্যও রিপোর্ট করুন।",
  alternates: { canonical: "/" },
  icons: { icon: "/favicon.svg" },
  openGraph: {
    type: "website",
    locale: "bn_BD",
    siteName: "চোর ছিনতাই",
    title: "কেনার আগে নম্বরটি মিলিয়ে নিন — চোর ছিনতাই",
    description: "IMEI, Serial বা VIN দিয়ে চুরি বা ছিনতাই হওয়া পণ্যের রিপোর্ট যাচাই করুন।",
  },
};

export const viewport: Viewport = { themeColor: "#022c22" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bn">
      <body className={`${bengali.className} antialiased`}>{children}</body>
    </html>
  );
}
