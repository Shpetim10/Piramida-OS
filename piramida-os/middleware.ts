// Middleware runs in Vercel's Edge Runtime (not Node.js).
// Supabase session refresh is handled in server layouts which run in Node.js.
// This file only controls which paths are matched — keeping it import-free
// prevents MIDDLEWARE_INVOCATION_FAILED on Vercel.
import { type NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
