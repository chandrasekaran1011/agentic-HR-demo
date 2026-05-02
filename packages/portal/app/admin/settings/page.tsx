import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getEmailOverride } from "@/lib/demo-settings";
import { EmailOverrideForm } from "./email-override-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const override = await getEmailOverride();
  return (
    <AppShell>
      <div className="p-8 space-y-8 max-w-3xl">
        <div className="flex items-center gap-2 text-sm">
          <Link href="/admin" className="text-slate-400 hover:text-slate-200">Admin</Link>
          <span className="text-slate-600">/</span>
          <span>Settings</span>
        </div>
        <h1 className="text-2xl font-semibold">Demo settings</h1>

        <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-6">
          <h2 className="text-lg font-medium">Email safety override</h2>
          <p className="text-sm text-slate-400 mt-1 mb-4">
            Demo mode safety net. With this set, no real candidates / managers / buddies
            receive email — everything routes to you for inspection.
          </p>
          {override ? (
            <p className="text-sm text-emerald-300 mb-4">
              ● Currently active — all email goes to{" "}
              <span className="font-mono">{override}</span>
            </p>
          ) : (
            <p className="text-sm text-rose-300 mb-4">
              ○ Not set — emails go to actual recipients (candidate / manager / buddy).
            </p>
          )}
          <EmailOverrideForm initial={override} />
        </section>
      </div>
    </AppShell>
  );
}
