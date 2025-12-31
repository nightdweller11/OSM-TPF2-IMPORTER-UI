import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Simple middleware that doesn't use the database
// Auth check is done in API routes instead
export function middleware(request: NextRequest) {
  // Protected routes that need authentication
  const protectedPaths = ["/my-conversions"];
  
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  // For protected paths, we'll let the page handle the auth check
  // This avoids needing database access in middleware (Edge Runtime limitation)
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes handle their own auth)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|doc|storage).*)",
  ],
};
