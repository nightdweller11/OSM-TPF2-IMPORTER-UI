/**
 * Next.js Instrumentation
 * 
 * This file is loaded on server startup and can be used to run
 * initialization code, health checks, etc.
 * 
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on the Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Import node-only code dynamically to avoid webpack bundling issues
    const { checkPythonEnvironment } = await import("./lib/startup-checks");
    await checkPythonEnvironment();
  }
}

