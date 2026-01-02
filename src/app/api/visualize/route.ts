import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getDb, conversions } from '@/lib/db';
import { eq } from 'drizzle-orm';

/**
 * GET /api/visualize?id=<conversion_id>
 * Returns the osmdata.lua content for a specific conversion
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing conversion id' }, { status: 400 });
  }

  try {
    // Get conversion from database
    const db = getDb();
    const conversionList = await db
      .select()
      .from(conversions)
      .where(eq(conversions.id, id))
      .limit(1);
    
    const conversion = conversionList[0];

    if (!conversion) {
      return NextResponse.json({ error: 'Conversion not found' }, { status: 404 });
    }

    // Check if lua file exists - the field is luaFile
    const luaFilePath = conversion.luaFile;
    if (!luaFilePath) {
      return NextResponse.json({ 
        error: 'No lua file for this conversion',
        conversion: { id: conversion.id, status: conversion.status }
      }, { status: 404 });
    }

    // Try to read the lua file directly
    try {
      console.log('[Visualize API] Attempting to read:', luaFilePath);
      const content = await fs.readFile(luaFilePath, 'utf-8');
      console.log('[Visualize API] File read successfully, size:', content.length, 'bytes');
      console.log('[Visualize API] First 500 chars:', content.substring(0, 500));
      console.log('[Visualize API] Content includes "nodes":', content.includes('nodes = {'));
      console.log('[Visualize API] Content includes "edges":', content.includes('edges = {'));
      return NextResponse.json({ content, path: luaFilePath });
    } catch (fileError) {
      console.log('[Visualize API] Failed to read primary path:', fileError);
      // Try some alternate paths
      const altPaths = [
        luaFilePath,
        path.join(process.cwd(), luaFilePath),
        path.join(process.cwd(), 'storage', 'conversions', conversion.id, 'osmdata.lua'),
      ];
      
      for (const altPath of altPaths) {
        try {
          const content = await fs.readFile(altPath, 'utf-8');
          return NextResponse.json({ content, path: altPath });
        } catch {
          // Continue to next path
        }
      }
      
      return NextResponse.json({ 
        error: 'osmdata.lua not found',
        luaFile: luaFilePath,
        tried: altPaths,
        fileError: String(fileError)
      }, { status: 404 });
    }
  } catch (error) {
    console.error('Error loading osmdata:', error);
    return NextResponse.json({ 
      error: 'Failed to load osmdata',
      details: String(error)
    }, { status: 500 });
  }
}

