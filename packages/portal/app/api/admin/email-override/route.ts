import { NextRequest, NextResponse } from "next/server";
import { getEmailOverride, setEmailOverride } from "@/lib/demo-settings";

export async function GET() {
  const value = await getEmailOverride();
  return NextResponse.json({ email_override: value });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.email_override !== "string") {
    return NextResponse.json({ error: "email_override (string) required" }, { status: 400 });
  }
  const trimmed = body.email_override.trim();
  if (trimmed && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }
  await setEmailOverride(trimmed || null);
  return NextResponse.json({ email_override: trimmed || null });
}
