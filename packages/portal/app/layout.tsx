import "./globals.css";
import type { Metadata } from "next";
import { Fraunces, Geist_Mono, Geist } from "next/font/google";
import { getCompany } from "@/lib/company";
import { InboxPreview } from "@/components/inbox-preview";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const c = getCompany();
  return {
    title: `${c.name} HR Portal`,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const company = getCompany();
  const demoMode = process.env.DEMO_MODE === "true";
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${geistMono.variable} ${geistSans.variable}`}
    >
      <body
        className="bg-slate-950 text-slate-100 font-sans"
        style={{ ["--brand" as string]: company.brandColor }}
      >
        {children}
        <InboxPreview enabled={demoMode} />
      </body>
    </html>
  );
}
