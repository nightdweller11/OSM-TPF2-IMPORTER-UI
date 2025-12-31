"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Github, Mail, User, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function SignInPage() {
  const [devUsername, setDevUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if OAuth providers are available (set via server-side props or API)
  // For now, we'll try to detect this client-side
  const hasOAuthProviders = !!(
    process.env.NEXT_PUBLIC_HAS_GITHUB_AUTH || 
    process.env.NEXT_PUBLIC_HAS_GOOGLE_AUTH
  );

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!devUsername.trim()) {
      setError("Please enter a username");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await signIn("dev-login", {
        username: devUsername,
        redirect: true,
        callbackUrl: "/",
      });
      // If redirect is true, this line won't be reached on success
    } catch (err) {
      console.error("Sign in error:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-2xl">Sign In</CardTitle>
          <CardDescription>
            Sign in to create and manage your OSM conversions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* OAuth Providers */}
          <Button
            variant="outline"
            className="w-full h-12"
            onClick={() => signIn("github", { callbackUrl: "/" })}
          >
            <Github className="h-5 w-5 mr-3" />
            Continue with GitHub
          </Button>
          
          <Button
            variant="outline"
            className="w-full h-12"
            onClick={() => signIn("google", { callbackUrl: "/" })}
          >
            <Mail className="h-5 w-5 mr-3" />
            Continue with Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or for local development
              </span>
            </div>
          </div>

          {/* Dev Mode Login */}
          <form onSubmit={handleDevLogin} className="space-y-3">
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-600 dark:text-yellow-400">
                  Dev mode login is only for local development. 
                  Configure OAuth providers for production use.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Dev Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter any username..."
                value={devUsername}
                onChange={(e) => setDevUsername(e.target.value)}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              <User className="h-4 w-4 mr-2" />
              {isLoading ? "Signing in..." : "Dev Sign In"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Why sign in?
              </span>
            </div>
          </div>

          <div className="text-sm text-muted-foreground space-y-2">
            <p>✓ Create new map conversions</p>
            <p>✓ Track your conversion history</p>
            <p>✓ Downloads are available without signing in</p>
          </div>

          <div className="text-center pt-4">
            <Link
              href="/gallery"
              className="text-sm text-primary hover:underline"
            >
              Browse gallery without signing in →
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
