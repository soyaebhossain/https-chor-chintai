import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "চোর ছিনতাই — পণ্য যাচাই ও রিপোর্ট",
  description: "Serial, IMEI বা VIN দিয়ে চুরি বা ছিনতাই হওয়া পণ্যের রিপোর্ট যাচাই করুন।",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="bn"><body className="antialiased">{children}</body></html>;
}
