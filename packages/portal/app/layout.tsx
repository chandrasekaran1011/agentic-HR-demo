import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HR Onboarding Portal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100">{children}</body>
    </html>
  );
}
