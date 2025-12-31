import { NextResponse } from "next/server";
import { getPythonRunner } from "@/lib/python-runner";

export const dynamic = "force-dynamic";

/**
 * GET /api/health/python
 * 
 * Check Python environment health and dependencies.
 * Returns detailed information about installed/missing packages.
 */
export async function GET() {
  const runner = getPythonRunner();
  
  try {
    const check = await runner.checkDependencies();
    
    return NextResponse.json({
      status: check.ok ? "ok" : "error",
      python: {
        version: check.pythonVersion,
        available: check.pythonVersion !== "unknown",
      },
      dependencies: {
        installed: check.installed.length,
        missing: check.missing.length,
        details: {
          installed: check.installed,
          missing: check.missing,
          errors: check.errors,
        },
      },
      message: check.ok 
        ? "Python environment is ready"
        : `Missing dependencies: ${check.missing.join(", ")}`,
      fixInstructions: check.ok ? null : {
        primary: "pip install -r python/requirements.txt",
        alternative: [
          "pip install protobuf",
          "pip install git+https://github.com/dezhin/osmread.git",
          "pip install luadata geopy pyproj lxml networkx scipy numpy utm lupa",
        ],
      },
    }, {
      status: check.ok ? 200 : 503,
    });
  } catch (error) {
    console.error("Python health check failed:", error);
    return NextResponse.json({
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
      python: { version: "unknown", available: false },
      dependencies: { installed: 0, missing: 0, details: { installed: [], missing: [], errors: [] } },
    }, { status: 503 });
  }
}

