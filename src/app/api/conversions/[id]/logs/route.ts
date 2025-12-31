import { NextRequest, NextResponse } from "next/server";
import { getConversionLogs, getConversionProgress } from "@/lib/python-runner";

export const dynamic = "force-dynamic";

/**
 * GET /api/conversions/[id]/logs
 * 
 * Get live logs for a conversion in progress.
 * Returns structured log entries and current progress from file-based storage.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  const logs = getConversionLogs(id);
  const progress = getConversionProgress(id);
  
  return NextResponse.json({
    id,
    logs,
    progress: progress || { percent: 0, phase: "unknown" },
    logCount: logs.length,
  });
}

