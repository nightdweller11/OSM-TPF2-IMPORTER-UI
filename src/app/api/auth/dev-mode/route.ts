import { NextResponse } from "next/server";

// Check if any OAuth providers are configured
const hasGitHub = !!(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);
const hasGoogle = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
const hasAnyOAuth = hasGitHub || hasGoogle;

// Dev mode = no OAuth configured
const isDevMode = !hasAnyOAuth;

export async function GET() {
  return NextResponse.json({
    isDevMode,
    message: isDevMode 
      ? "Running in development mode - no authentication required" 
      : "OAuth authentication is configured",
  });
}

