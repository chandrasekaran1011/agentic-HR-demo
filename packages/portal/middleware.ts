import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth|login|.*\\.(?:png|jpg|svg|ico)).*)"],
};

export function middleware(req: NextRequest) {
  const cookie = req.cookies.get("hr_session")?.value;
  if (!cookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  // Full HMAC verification happens at page-level via getCurrentUser().
  // Edge runtime here only checks cookie presence (node:crypto.createHmac
  // isn't available in middleware).
  return NextResponse.next();
}
