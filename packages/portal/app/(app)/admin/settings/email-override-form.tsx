"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  initial: string | null;
}

export function EmailOverrideForm({ initial }: Props) {
  const [value, setValue] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/email-override", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email_override: value }),
    });
    setBusy(false);
    if (res.ok) {
      setSavedAt(new Date().toLocaleTimeString());
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "save failed");
    }
  }

  async function clearOverride() {
    setValue("");
    setBusy(true);
    await fetch("/api/admin/email-override", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email_override: "" }),
    });
    setBusy(false);
    setSavedAt(new Date().toLocaleTimeString());
  }

  return (
    <form onSubmit={save} className="space-y-4 max-w-xl">
      <div className="space-y-2">
        <Label htmlFor="override">Redirect ALL emails to</Label>
        <Input
          id="override"
          type="email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="you@example.com"
          disabled={busy}
        />
        <p className="text-xs text-slate-500">
          When set, every outbound email (welcome, manager notify, buddy intro, document
          checklist, admin confirmation) is sent to this address instead of the candidate /
          manager / buddy. The original recipient is preserved in the subject line as
          <span className="font-mono ml-1">[demo→original@…]</span>.
        </p>
      </div>
      {error && <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>}
      {savedAt && !error && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">Saved at {savedAt}.</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
        {value && (
          <Button type="button" variant="outline" onClick={clearOverride} disabled={busy}>
            Clear (let emails go to real recipients)
          </Button>
        )}
      </div>
    </form>
  );
}
