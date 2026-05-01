import { NextRequest, NextResponse } from "next/server";
import { toggleRoleSoftware } from "@/lib/master-data-api";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.role_id || !body?.software_id) {
    return NextResponse.json({ error: "role_id and software_id required" }, { status: 400 });
  }
  const newList = await toggleRoleSoftware(body.role_id, body.software_id);
  return NextResponse.json({ role_id: body.role_id, software_ids: newList });
}
