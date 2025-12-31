import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { NextAuthConfig } from "next-auth";

// Lazy import to avoid edge runtime issues
const getDatabase = async () => {
  const { getDb } = await import("./db");
  return getDb();
};

const getSchema = async () => {
  const { users } = await import("./db/schema");
  return { users };
};

// Check if OAuth is configured
const hasGitHub = !!(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);
const hasGoogle = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
const hasAnyOAuth = hasGitHub || hasGoogle;

// Check if we're in dev mode (no OAuth configured)
const isDevMode = !hasAnyOAuth;

// Get or generate auth secret
// In dev mode, use a static secret to avoid the MissingSecret error
// In production, AUTH_SECRET should be set in environment variables
const getAuthSecret = (): string => {
  if (process.env.AUTH_SECRET) {
    return process.env.AUTH_SECRET;
  }
  
  // For dev mode, use a deterministic secret based on a fixed value
  // This is fine for local development but should NOT be used in production
  if (isDevMode || process.env.NODE_ENV === "development") {
    return "dev-mode-secret-do-not-use-in-production-12345";
  }
  
  // In production without AUTH_SECRET, this will cause NextAuth to throw
  // which is the correct behavior
  return "";
};

const authSecret = getAuthSecret();

// Log auth configuration once on startup (server-side only)
let hasLoggedConfig = false;
if (typeof window === "undefined" && !hasLoggedConfig) {
  hasLoggedConfig = true;
  console.log("Auth Configuration:");
  console.log(`  - GitHub OAuth: ${hasGitHub ? "enabled" : "disabled"}`);
  console.log(`  - Google OAuth: ${hasGoogle ? "enabled" : "disabled"}`);
  console.log(`  - Dev Mode (no auth): ${isDevMode ? "enabled" : "disabled"}`);
  console.log(`  - Auth Secret: ${authSecret ? "configured" : "MISSING (required for production)"}`);
}

// Build providers array dynamically
const providers: NextAuthConfig["providers"] = [];

if (hasGitHub) {
  providers.push(
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    })
  );
}

if (hasGoogle) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    })
  );
}

// In dev mode, add a simple credentials provider for local testing
if (isDevMode) {
  providers.push(
    Credentials({
      id: "dev-login",
      name: "Dev Login",
      credentials: {
        username: { label: "Username", type: "text", placeholder: "dev" },
      },
      async authorize(credentials) {
        // In dev mode, any username creates/logs in a user
        if (!credentials?.username) return null;
        
        const username = credentials.username as string;
        const db = await getDatabase();
        const { users } = await getSchema();
        const { eq } = await import("drizzle-orm");
        
        // Check if user exists
        const existingUser = await db
          .select()
          .from(users)
          .where(eq(users.email, `${username}@localhost`))
          .limit(1);
        
        if (existingUser.length > 0) {
          return {
            id: existingUser[0].id,
            name: existingUser[0].name,
            email: existingUser[0].email,
          };
        }
        
        // Create new dev user
        const newUser = {
          id: crypto.randomUUID(),
          name: username,
          email: `${username}@localhost`,
          role: "USER" as const,
        };
        
        await db.insert(users).values(newUser);
        
        return {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
        };
      },
    })
  );
}

const authConfig: NextAuthConfig = {
  providers,
  secret: authSecret,
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: {
    // Always use JWT for simplicity (works with both SQLite and credentials)
    strategy: "jwt",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.sub as string;
        session.user.role = (token.role as "USER" | "ADMIN") || "USER";
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = "USER";
      }
      return token;
    },
  },
  // Reduce log noise in dev mode
  debug: false,
  // Trust all hosts in dev mode
  trustHost: true,
};

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);

// Export dev mode flag for use in components
export const isDevModeAuth = isDevMode;

// Extend session types
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: "USER" | "ADMIN";
    };
  }
}
