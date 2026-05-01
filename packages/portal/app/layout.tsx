import "./globals.css";
import type { Metadata } from "next";
import { getCompany } from "@/lib/company";
import { InboxPreview } from "@/components/inbox-preview";

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
    <html lang="en">
      <body
        className="bg-slate-950 text-slate-100"
        style={{ ["--brand" as string]: company.brandColor }}
      >
        {children}
        <InboxPreview enabled={demoMode} />
      </body>
    </html>
  );
}
