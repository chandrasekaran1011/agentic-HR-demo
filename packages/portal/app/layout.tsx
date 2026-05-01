import "./globals.css";
import type { Metadata } from "next";
import { getCompany } from "@/lib/company";

export async function generateMetadata(): Promise<Metadata> {
  const c = getCompany();
  return {
    title: `${c.name} HR Portal`,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const company = getCompany();
  return (
    <html lang="en">
      <body
        className="bg-slate-950 text-slate-100"
        style={{ ["--brand" as string]: company.brandColor }}
      >
        {children}
      </body>
    </html>
  );
}
