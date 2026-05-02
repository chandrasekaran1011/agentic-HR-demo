import "./globals.css";
import type { Metadata } from "next";
import { Fraunces, Geist_Mono, Geist } from "next/font/google";
import { getCompany } from "@/lib/company";
import { InboxPreview } from "@/components/inbox-preview";
import { ThemeProvider } from "@/components/theme-provider";

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

// Apply the saved theme BEFORE first paint to avoid the light→dark flash.
// Inlined into <head> as a synchronous script.
const themeBootstrap = `
(function() {
  try {
    var t = localStorage.getItem('hr-portal-theme');
    if (t !== 'light' && t !== 'dark') {
      t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    if (t === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const company = getCompany();
  const demoMode = process.env.DEMO_MODE === "true";
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${geistMono.variable} ${geistSans.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body
        className="bg-background text-foreground font-sans"
        style={{ ["--brand" as string]: company.brandColor }}
      >
        <ThemeProvider>
          {children}
          <InboxPreview enabled={demoMode} />
        </ThemeProvider>
      </body>
    </html>
  );
}
