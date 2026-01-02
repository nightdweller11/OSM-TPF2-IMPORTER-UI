import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb, conversions, users } from "@/lib/db";
import { fetchOsmData, calculateBoundsFromCenter } from "@/lib/osm-fetcher";
import { getPythonRunner, initConversionLogs, pushConversionLog } from "@/lib/python-runner";
import { eq, desc, and, sql } from "drizzle-orm";
import path from "path";
import fs from "fs/promises";
import { z } from "zod";

// Check if dev mode (no OAuth configured)
const hasGitHub = !!(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET);
const hasGoogle = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
const isDevMode = !hasGitHub && !hasGoogle;

const createConversionSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  centerLat: z.number().min(-90).max(90),
  centerLon: z.number().min(-180).max(180),
  mapWidth: z.number().min(256).max(53760),   // Allow small test sizes
  mapHeight: z.number().min(256).max(53760),  // Allow small test sizes
  mapPreset: z.string().optional(),
  config: z.object({
    railTypes: z.array(z.string()).optional(),
    highwayTypes: z.array(z.string()).optional(),
    includeForests: z.boolean().optional(),
    includeGrounds: z.boolean().optional(),
    includeObjects: z.boolean().optional(),
    includeTowns: z.boolean().optional(),
    includeSignals: z.boolean().optional(),
    includeStreams: z.boolean().optional(),
    includePaths: z.boolean().optional(),
    scaleRatio: z.number().min(1).max(5).optional(),
  }).optional(),
});

// GET /api/conversions - List conversions (public gallery)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const featured = searchParams.get("featured") === "true";
    const userId = searchParams.get("userId");

    const db = getDb();
    const offset = (page - 1) * limit;

    // Get all completed public conversions
    let query = db
      .select({
        id: conversions.id,
        name: conversions.name,
        description: conversions.description,
        centerLat: conversions.centerLat,
        centerLon: conversions.centerLon,
        minLat: conversions.minLat,
        minLon: conversions.minLon,
        maxLat: conversions.maxLat,
        maxLon: conversions.maxLon,
        mapWidth: conversions.mapWidth,
        mapHeight: conversions.mapHeight,
        mapPreset: conversions.mapPreset,
        config: conversions.config,
        stats: conversions.stats,
        downloads: conversions.downloads,
        createdAt: conversions.createdAt,
        completedAt: conversions.completedAt,
        status: conversions.status,
        progress: conversions.progress,
        errorMsg: conversions.errorMsg,
        userId: conversions.userId,
      })
      .from(conversions)
      .orderBy(desc(conversions.createdAt))
      .limit(limit)
      .offset(offset);

    const conversionList = await query;
    
    // Filter in memory for simplicity (SQLite doesn't have great compound where support)
    const filteredList = conversionList.filter(c => {
      if (c.status !== "COMPLETED") return false;
      if (userId && c.userId !== userId) return false;
      return true;
    });

    // Get total count
    const allConversions = await db.select({ id: conversions.id, status: conversions.status }).from(conversions);
    const total = allConversions.filter(c => c.status === "COMPLETED").length;

    // Format response
    const formattedConversions = filteredList.map((c) => ({
      ...c,
      config: c.config ? JSON.parse(c.config as string) : {},
      stats: c.stats ? JSON.parse(c.stats as string) : null,
      user: null, // Simplified - no user join for now
    }));

    return NextResponse.json({
      conversions: formattedConversions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching conversions:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversions" },
      { status: 500 }
    );
  }
}

// POST /api/conversions - Create new conversion (requires auth, unless dev mode)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    // In dev mode, allow unauthenticated conversions
    // Otherwise, require authentication
    if (!isDevMode && !session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required to create conversions" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = createConversionSchema.parse(body);

    // Calculate bounds from center point and map size, accounting for scale ratio
    const scaleRatio = (validatedData.config?.scaleRatio as number) || 1;
    const bounds = calculateBoundsFromCenter(
      validatedData.centerLat,
      validatedData.centerLon,
      validatedData.mapWidth * scaleRatio,
      validatedData.mapHeight * scaleRatio
    );

    const db = getDb();
    const conversionId = crypto.randomUUID();
    
    // In dev mode without session, set userId to null
    const userId = session?.user?.id || null;

    // Create conversion record
    await db.insert(conversions).values({
      id: conversionId,
      userId,
      name: validatedData.name,
      description: validatedData.description || null,
      centerLat: validatedData.centerLat,
      centerLon: validatedData.centerLon,
      minLat: bounds.minLat,
      minLon: bounds.minLon,
      maxLat: bounds.maxLat,
      maxLon: bounds.maxLon,
      mapWidth: validatedData.mapWidth,
      mapHeight: validatedData.mapHeight,
      mapPreset: validatedData.mapPreset || null,
      config: JSON.stringify(validatedData.config || {}),
      status: "PENDING",
      progress: 0,
    });

    // Fetch the created conversion
    const created = await db
      .select()
      .from(conversions)
      .where(eq(conversions.id, conversionId))
      .limit(1);

    // Initialize file-based logs BEFORE returning response
    // This ensures the log files exist when frontend starts polling
    initConversionLogs(conversionId);
    console.log(`[${conversionId}] Log files initialized before response`);

    // Start conversion process asynchronously
    processConversion(conversionId).catch((error) => {
      console.error(`Conversion ${conversionId} failed:`, error);
    });

    return NextResponse.json({ conversion: created[0] }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Error creating conversion:", error);
    return NextResponse.json(
      { error: "Failed to create conversion" },
      { status: 500 }
    );
  }
}

// Process conversion in background
async function processConversion(conversionId: string): Promise<void> {
  const storageDir = process.env.OUTPUT_DIR || "./storage/outputs";
  const db = getDb();
  
  try {
    // Get conversion from database
    const conversionList = await db
      .select()
      .from(conversions)
      .where(eq(conversions.id, conversionId))
      .limit(1);

    const conversion = conversionList[0];
    if (!conversion) {
      throw new Error("Conversion not found");
    }

    // Initialize runner for Python conversion
    const runner = getPythonRunner();
    runner.setConversionId(conversionId);
    console.log(`[${conversionId}] Runner initialized for processing`);

    // Helper to push logs using file-based storage
    const log = (type: "phase" | "step" | "error" | "stats" | "info" | "estimate", message: string, percent?: number) => {
      pushConversionLog(conversionId, type, message, percent);
    };

    // Update status to downloading (0-15% is download phase)
    await db
      .update(conversions)
      .set({ status: "DOWNLOADING_OSM", progress: 0 })
      .where(eq(conversions.id, conversionId));

    log("phase", "Downloading OSM data from Overpass API...", 0);

    // Fetch OSM data with progress callback
    const osmFilename = `${conversionId}.osm`;
    log("step", `Fetching area: ${conversion.minLat.toFixed(4)},${conversion.minLon.toFixed(4)} to ${conversion.maxLat.toFixed(4)},${conversion.maxLon.toFixed(4)}`);

    const osmResult = await fetchOsmData(
      {
        minLat: conversion.minLat,
        minLon: conversion.minLon,
        maxLat: conversion.maxLat,
        maxLon: conversion.maxLon,
      },
      storageDir,
      osmFilename,
      {
        onProgress: async (progress) => {
          // Map download progress to 0-15% of overall conversion
          let overallPercent = 0;
          if (progress.phase === "connecting") {
            overallPercent = 1;
          } else if (progress.phase === "downloading") {
            // Download takes 0-12%
            const downloadPercent = progress.percentComplete || 
              Math.min(80, (progress.bytesReceived / (progress.estimatedTotalBytes || 1)) * 100);
            overallPercent = Math.round(1 + (downloadPercent / 100) * 12);
          } else if (progress.phase === "writing") {
            overallPercent = 13;
          } else if (progress.phase === "complete") {
            overallPercent = 14;
          }
          
          // Update logs
          log("step", progress.message, overallPercent);
          
          // Update database progress
          try {
            await db
              .update(conversions)
              .set({ progress: overallPercent })
              .where(eq(conversions.id, conversionId));
          } catch (e) {
            console.warn("Failed to update download progress:", e);
          }
        },
      }
    );

    if (!osmResult.success || !osmResult.filePath) {
      log("error", osmResult.error || "Failed to download OSM data");
      throw new Error(osmResult.error || "Failed to download OSM data");
    }

    // Log download complete
    log("step", `Downloaded OSM data (${osmResult.fileSizeMB?.toFixed(1) || "?"} MB)`, 15);

    // Update status to processing
    await db
      .update(conversions)
      .set({ 
        status: "PROCESSING", 
        progress: 20,
        osmFile: osmResult.filePath,
      })
      .where(eq(conversions.id, conversionId));

    // Run Python conversion
    const outputFile = path.join(storageDir, `${conversionId}.lua`);
    
    // Check if heightmap generation is requested (from config JSON)
    let generateHeightmap = true;  // Default to true
    try {
      const configData = conversion.config ? JSON.parse(conversion.config) : {};
      generateHeightmap = configData.generateHeightmap !== false;  // Default true unless explicitly false
    } catch {
      // Use default
    }
    
    const heightmapFile = generateHeightmap 
      ? path.join(storageDir, `${conversionId}_heightmap.png`)
      : undefined;
    
    log("phase", "Starting Python conversion...", 20);
    if (generateHeightmap) {
      log("step", "Heightmap generation enabled");
    }

    // Set up progress listener
    runner.on("progress", async (progress) => {
      try {
        // Map phase to valid status values
        let status: "PROCESSING" | "OPTIMIZING" = "PROCESSING";
        if (progress.phase === "optimizing") {
          status = "OPTIMIZING";
        }
        
        await db
          .update(conversions)
          .set({ 
            progress: Math.min(progress.percent || 0, 95),
            status,
          })
          .where(eq(conversions.id, conversionId));
      } catch (e) {
        console.warn("Failed to update progress:", e);
      }
    });

    const result = await runner.runConversion({
      inputFile: osmResult.filePath,
      outputFile,
      bounds: {
        minLat: conversion.minLat,
        minLon: conversion.minLon,
        maxLat: conversion.maxLat,
        maxLon: conversion.maxLon,
      },
      mapSize: {
        width: conversion.mapWidth,
        height: conversion.mapHeight,
      },
      heightmapFile,
    });

    if (!result.success) {
      throw new Error(result.error || "Conversion failed");
    }

    // Check if heightmap was generated
    let heightmapGenerated = false;
    if (heightmapFile) {
      try {
        await fs.access(heightmapFile);
        heightmapGenerated = true;
        log("step", "Heightmap generated successfully", 98);
      } catch {
        log("step", "Heightmap generation skipped or failed", 98);
      }
    }

    // Update conversion as completed
    await db
      .update(conversions)
      .set({
        status: "COMPLETED",
        progress: 100,
        luaFile: result.outputFile || null,
        heightmapFile: heightmapGenerated ? heightmapFile : null,
        logFile: result.logFile || null,
        stats: result.stats ? JSON.stringify(result.stats) : null,
        completedAt: new Date(),
      })
      .where(eq(conversions.id, conversionId));

    console.log(`Conversion ${conversionId} completed successfully`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`Conversion ${conversionId} failed:`, errorMessage);
    
    await db
      .update(conversions)
      .set({
        status: "FAILED",
        errorMsg: errorMessage,
      })
      .where(eq(conversions.id, conversionId));
  }
}
