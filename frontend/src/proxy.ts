import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const selected = request.nextUrl.searchParams.get("lang");
  const remembered = request.cookies.get("signhearing_language")?.value;
  const locale =
    selected === "vi" || selected === "en"
      ? selected
      : remembered === "en"
        ? "en"
        : "vi";
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-sh-locale", locale);
  // Public header links never interpolate an unknown user-supplied path.
  requestHeaders.set(
    "x-sh-page",
    request.nextUrl.pathname === "/"
      ? "/"
      : /^\/features\/?$/.test(request.nextUrl.pathname)
        ? "/features"
        : /^\/app(?:\/[a-zA-Z0-9_-]+)*\/?$/.test(request.nextUrl.pathname)
          ? request.nextUrl.pathname
          : /^\/login\/?$/.test(request.nextUrl.pathname)
            ? "/login"
            : "/404",
  );
  let response: NextResponse;
  if (/^\/khu-hoc-tap\/?$/.test(request.nextUrl.pathname)) {
    const destination = new URL("/app", request.url);
    destination.searchParams.set("lang", locale);
    response = NextResponse.redirect(destination, 302);
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }
  response.cookies.set("signhearing_language", locale, {
    path: "/",
    maxAge: 31536000,
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });
  response.headers.set("Content-Language", locale);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.append("Vary", "Cookie");
  return response;
}
export const config = {
  matcher: [
    "/((?!api|_next|assets|static|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
