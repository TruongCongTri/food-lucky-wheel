import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, hasLocale, LOCALE_COOKIE, type Locale } from "@/i18n/config";

function detectLocale(request: NextRequest): Locale {
  const fromCookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (fromCookie && hasLocale(fromCookie)) return fromCookie;

  const accept = request.headers.get("accept-language")?.toLowerCase() ?? "";
  if (!accept) return defaultLocale;
  // Vietnamese speakers (or anyone listing vi) get vi, everyone else en.
  return /(^|,)\s*vi\b/.test(accept) ? "vi" : "en";
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Static files (icon.svg, manifest.webmanifest, …) pass straight through.
  if (pathname.includes(".")) return;
  const first = pathname.split("/")[1] ?? "";
  if (hasLocale(first)) return;

  request.nextUrl.pathname = `/${detectLocale(request)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  // Skip API routes and Next internals.
  matcher: ["/((?!api|_next).*)"],
};
