import { NextRequest, NextResponse } from "next/server";
import { getDb, conversions } from "@/lib/db";
import { eq } from "drizzle-orm";

// GET /api/conversions/[id] - Get single conversion
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    
    const result = await db
      .select()
      .from(conversions)
      .where(eq(conversions.id, id))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Conversion not found" },
        { status: 404 }
      );
    }

    const conversion = result[0];
    
    return NextResponse.json({
      conversion: {
        ...conversion,
        config: conversion.config ? JSON.parse(conversion.config as string) : {},
        stats: conversion.stats ? JSON.parse(conversion.stats as string) : null,
        user: null,
      },
    });
  } catch (error) {
    console.error("Error fetching conversion:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversion" },
      { status: 500 }
    );
  }
}
