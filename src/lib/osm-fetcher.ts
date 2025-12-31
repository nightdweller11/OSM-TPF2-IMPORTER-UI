import fs from "fs/promises";
import path from "path";

export interface Bounds {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

export interface FetchResult {
  success: boolean;
  filePath?: string;
  fileSize?: number;
  fileSizeMB?: number;
  error?: string;
  retryable?: boolean;
}

// Overpass API endpoints (multiple for fallback)
// No API key required - rate limiting is per-IP
// See: https://dev.overpass-api.de/overpass-doc/en/preface/commons.html
const OVERPASS_ENDPOINTS = [
  // Main public instance - most reliable but often busy
  "https://overpass-api.de/api/interpreter",
  // Private.coffee instance - no rate limits, supports all features
  "https://overpass.kumi.systems/api/interpreter", 
  // Mail.ru mirror - good for European users
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  // Taiwan mirror
  "https://overpass.nchc.org.tw/api/interpreter",
];

// Note: For heavy usage, consider:
// 1. Self-hosting Overpass: https://overpass-api.de/full_installation.html
// 2. Using Geofabrik extracts: https://download.geofabrik.de/
// 3. Planet.osm for full data: https://planet.openstreetmap.org/

interface OverpassOptions {
  timeout?: number;  // Query timeout in seconds
  maxRetries?: number;
  retryDelayMs?: number;
  onProgress?: (progress: DownloadProgress) => void;
}

export interface DownloadProgress {
  phase: "connecting" | "downloading" | "writing" | "complete";
  bytesReceived: number;
  elapsedSeconds: number;
  estimatedTotalBytes?: number;
  percentComplete?: number;
  message: string;
}

const DEFAULT_OPTIONS: Required<Omit<OverpassOptions, "onProgress">> = {
  timeout: 600,      // 10 minutes query timeout (large areas need more time)
  maxRetries: 4,     // Try all 4 endpoints
  retryDelayMs: 3000, // 3 seconds between retries
};

/**
 * Parse error message from Overpass API HTML response
 */
function parseOverpassError(html: string): string {
  // Normalize the HTML by replacing newlines with spaces for regex matching
  const normalizedHtml = html.replace(/[\r\n]+/g, ' ');
  
  // Try to extract error message from HTML
  const errorMatch = normalizedHtml.match(/<p><strong[^>]*>Error<\/strong>:\s*(.*?)<\/p>/i);
  if (errorMatch) {
    // Clean up the error message
    return errorMatch[1]
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .trim();
  }
  
  // Try to find any error-like content
  const genericMatch = normalizedHtml.match(/error[:\s]+(.*?)(?:<\/|$)/i);
  if (genericMatch) {
    return genericMatch[1].replace(/<[^>]*>/g, '').trim();
  }
  
  return "Unknown Overpass API error";
}

/**
 * Build Overpass QL query for fetching map data
 */
function buildOverpassQuery(bounds: Bounds, timeout: number): string {
  const { minLat, minLon, maxLat, maxLon } = bounds;
  
  // Use Overpass QL instead of /api/map endpoint for better control
  // This query fetches all data in the bounding box
  return `
[out:xml][timeout:${timeout}][bbox:${minLat},${minLon},${maxLat},${maxLon}];
(
  node;
  way;
  relation;
);
out meta;
>;
out meta qt;
`.trim();
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetches OSM data from the Overpass API for given bounds
 * Uses Overpass QL for better control over timeout and data
 * Supports streaming with progress reporting
 */
export async function fetchOsmData(
  bounds: Bounds,
  outputDir: string,
  filename: string,
  options: OverpassOptions = {}
): Promise<FetchResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { minLat, minLon, maxLat, maxLon } = bounds;
  const onProgress = options.onProgress;
  const startTime = Date.now();

  // Validate bounds
  if (minLat >= maxLat || minLon >= maxLon) {
    return {
      success: false,
      error: "Invalid bounds: min values must be less than max values",
      retryable: false,
    };
  }

  // Check bounds size and warn for large areas
  const latDiff = maxLat - minLat;
  const lonDiff = maxLon - minLon;
  const approxAreaKm2 = latDiff * lonDiff * 111 * 111 * Math.cos((minLat + maxLat) / 2 * Math.PI / 180);
  
  // Estimate expected size based on area (very rough: ~1-10 MB per 100 km²)
  const estimatedSizeBytes = Math.max(1024 * 1024, approxAreaKm2 * 50000); // 50KB per km²
  
  console.log(`Requested area: ${latDiff.toFixed(3)}° x ${lonDiff.toFixed(3)}° (~${approxAreaKm2.toFixed(0)} km²)`);
  console.log(`Estimated download size: ~${(estimatedSizeBytes / 1024 / 1024).toFixed(1)} MB`);
  
  if (approxAreaKm2 > 2500) { // > 50km x 50km
    console.warn(`Very large area requested (${approxAreaKm2.toFixed(0)} km²) - this may timeout or be rate-limited`);
  }

  // Build the Overpass QL query
  const query = buildOverpassQuery(bounds, opts.timeout);
  
  // Ensure output directory exists
  try {
    await fs.mkdir(outputDir, { recursive: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: `Failed to create output directory: ${msg}`,
      retryable: false,
    };
  }

  const filePath = path.join(outputDir, filename);
  let lastError: string = "No attempts made";
  
  // Report initial connecting phase
  onProgress?.({
    phase: "connecting",
    bytesReceived: 0,
    elapsedSeconds: 0,
    estimatedTotalBytes: estimatedSizeBytes,
    message: "Connecting to Overpass API...",
  });
  
  // Try each endpoint with retries
  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    // Rotate through endpoints
    const endpointIndex = (attempt - 1) % OVERPASS_ENDPOINTS.length;
    const endpoint = OVERPASS_ENDPOINTS[endpointIndex];
    
    console.log(`[Attempt ${attempt}/${opts.maxRetries}] Fetching OSM data from: ${endpoint}`);
    
    onProgress?.({
      phase: "connecting",
      bytesReceived: 0,
      elapsedSeconds: (Date.now() - startTime) / 1000,
      estimatedTotalBytes: estimatedSizeBytes,
      message: `Connecting to server ${attempt}/${opts.maxRetries}...`,
    });
    
    try {
      // Create an AbortController for fetch timeout
      // Client-side timeout should be longer than server timeout to get proper error messages
      const controller = new AbortController();
      const fetchTimeout = (opts.timeout + 60) * 1000; // Server timeout + 60s buffer
      const timeoutId = setTimeout(() => controller.abort(), fetchTimeout);
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "OSM-TPF2-Importer/1.0 (https://github.com/Vacuum-Tube/OSM-TPF2-Importer)",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        const parsedError = parseOverpassError(errorText);
        
        console.error(`Overpass API error (${response.status}): ${parsedError}`);
        
        // Determine if this is a retryable error
        const isRetryable = response.status === 429 || // Rate limited
                           response.status === 503 || // Service unavailable
                           response.status === 504 || // Gateway timeout
                           parsedError.toLowerCase().includes("busy") ||
                           parsedError.toLowerCase().includes("timeout");
        
        lastError = `Overpass API error (${response.status}): ${parsedError}`;
        
        if (isRetryable && attempt < opts.maxRetries) {
          const delay = opts.retryDelayMs * attempt; // Exponential backoff
          console.log(`Server busy, waiting ${delay/1000}s before retry...`);
          onProgress?.({
            phase: "connecting",
            bytesReceived: 0,
            elapsedSeconds: (Date.now() - startTime) / 1000,
            message: `Server busy, retrying in ${delay/1000}s...`,
          });
          await sleep(delay);
          continue;
        }
        
        return {
          success: false,
          error: lastError,
          retryable: isRetryable,
        };
      }

      // Check content type - should be XML
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("xml") && !contentType.includes("osm")) {
        const text = await response.text();
        const parsedError = parseOverpassError(text);
        lastError = `Unexpected response type (${contentType}): ${parsedError}`;
        console.error(lastError);
        
        if (attempt < opts.maxRetries) {
          await sleep(opts.retryDelayMs);
          continue;
        }
        
        return { success: false, error: lastError, retryable: true };
      }

      // Get Content-Length if available for progress tracking
      const contentLength = response.headers.get("content-length");
      const expectedSize = contentLength ? parseInt(contentLength, 10) : estimatedSizeBytes;
      
      // Stream the response body with progress updates
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response body is not readable");
      }
      
      const chunks: Uint8Array[] = [];
      let bytesReceived = 0;
      let lastProgressReport = Date.now();
      const progressReportInterval = 500; // Report every 500ms
      
      onProgress?.({
        phase: "downloading",
        bytesReceived: 0,
        elapsedSeconds: (Date.now() - startTime) / 1000,
        estimatedTotalBytes: expectedSize,
        percentComplete: 0,
        message: "Downloading OSM data...",
      });
      
      // Read the response in chunks
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        bytesReceived += value.length;
        
        // Report progress periodically (not on every chunk to avoid overhead)
        const now = Date.now();
        if (now - lastProgressReport >= progressReportInterval) {
          const elapsedSeconds = (now - startTime) / 1000;
          const percentComplete = contentLength 
            ? Math.min(99, (bytesReceived / expectedSize) * 100)
            : undefined;
          const bytesPerSecond = bytesReceived / elapsedSeconds;
          const mbReceived = bytesReceived / 1024 / 1024;
          
          onProgress?.({
            phase: "downloading",
            bytesReceived,
            elapsedSeconds,
            estimatedTotalBytes: expectedSize,
            percentComplete,
            message: `Downloaded ${mbReceived.toFixed(1)} MB (${(bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s)`,
          });
          
          lastProgressReport = now;
        }
      }
      
      // Combine chunks into final buffer
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const data = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        data.set(chunk, offset);
        offset += chunk.length;
      }
      
      if (data.byteLength === 0) {
        lastError = "Received empty response from Overpass API";
        console.error(lastError);
        
        if (attempt < opts.maxRetries) {
          await sleep(opts.retryDelayMs);
          continue;
        }
        
        return { success: false, error: lastError, retryable: true };
      }
      
      // Write to file
      onProgress?.({
        phase: "writing",
        bytesReceived: data.byteLength,
        elapsedSeconds: (Date.now() - startTime) / 1000,
        percentComplete: 95,
        message: "Writing file to disk...",
      });
      
      await fs.writeFile(filePath, Buffer.from(data));

      const stats = await fs.stat(filePath);
      
      // Verify the file looks like valid OSM XML
      const firstBytes = Buffer.from(data.slice(0, 100)).toString("utf-8");
      if (!firstBytes.includes("<?xml") && !firstBytes.includes("<osm")) {
        lastError = `Invalid OSM data received: ${firstBytes.substring(0, 50)}...`;
        console.error(lastError);
        await fs.unlink(filePath).catch(() => {}); // Clean up invalid file
        
        if (attempt < opts.maxRetries) {
          await sleep(opts.retryDelayMs);
          continue;
        }
        
        return { success: false, error: lastError, retryable: true };
      }

      const fileSizeMB = stats.size / 1024 / 1024;
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      console.log(`OSM data saved to: ${filePath} (${fileSizeMB.toFixed(2)} MB in ${elapsedSeconds.toFixed(1)}s)`);

      onProgress?.({
        phase: "complete",
        bytesReceived: stats.size,
        elapsedSeconds,
        percentComplete: 100,
        message: `Download complete: ${fileSizeMB.toFixed(1)} MB`,
      });

      return {
        success: true,
        filePath,
        fileSize: stats.size,
        fileSizeMB,
      };
      
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          lastError = `Request timeout after ${opts.timeout + 60} seconds. The area may be too large or the server is overloaded.`;
        } else {
          lastError = `Network error: ${error.message}`;
        }
      } else {
        lastError = "Unknown network error";
      }
      
      console.error(`[Attempt ${attempt}] ${lastError}`);
      
      if (attempt < opts.maxRetries) {
        const delay = opts.retryDelayMs * attempt;
        console.log(`Waiting ${delay/1000}s before retry...`);
        onProgress?.({
          phase: "connecting",
          bytesReceived: 0,
          elapsedSeconds: (Date.now() - startTime) / 1000,
          message: `Error occurred, retrying in ${delay/1000}s...`,
        });
        await sleep(delay);
        continue;
      }
    }
  }
  
  return {
    success: false,
    error: `Failed after ${opts.maxRetries} attempts. Last error: ${lastError}`,
    retryable: true,
  };
}

/**
 * Geocode a location name using Nominatim
 */
export interface GeocodingResult {
  name: string;
  displayName: string;
  lat: number;
  lon: number;
  boundingBox: Bounds;
  type: string;
  importance: number;
}

export async function geocodeLocation(query: string, limit = 5): Promise<GeocodingResult[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", limit.toString());
  url.searchParams.set("addressdetails", "1");

  console.log(`Geocoding: ${query}`);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "OSM-TPF2-Importer/1.0",
        "Accept-Language": "en",
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim API returned ${response.status}`);
    }

    const data = await response.json();

    return data.map((item: {
      name: string;
      display_name: string;
      lat: string;
      lon: string;
      boundingbox: string[];
      type: string;
      importance: number;
    }) => ({
      name: item.name,
      displayName: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      boundingBox: {
        minLat: parseFloat(item.boundingbox[0]),
        maxLat: parseFloat(item.boundingbox[1]),
        minLon: parseFloat(item.boundingbox[2]),
        maxLon: parseFloat(item.boundingbox[3]),
      },
      type: item.type,
      importance: item.importance,
    }));
  } catch (error) {
    console.error("Geocoding error:", error);
    return [];
  }
}

/**
 * Calculate bounds for a given center point and map size
 */
export function calculateBoundsFromCenter(
  centerLat: number,
  centerLon: number,
  mapWidthMeters: number,
  mapHeightMeters: number
): Bounds {
  // Approximate degrees per meter at this latitude
  const metersPerDegreeLat = 111320; // roughly constant
  const metersPerDegreeLon = 111320 * Math.cos((centerLat * Math.PI) / 180);

  const latOffset = (mapHeightMeters / 2) / metersPerDegreeLat;
  const lonOffset = (mapWidthMeters / 2) / metersPerDegreeLon;

  return {
    minLat: centerLat - latOffset,
    maxLat: centerLat + latOffset,
    minLon: centerLon - lonOffset,
    maxLon: centerLon + lonOffset,
  };
}

/**
 * Calculate map size in meters from bounds
 */
export function calculateMapSizeFromBounds(bounds: Bounds): { width: number; height: number } {
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLon = 111320 * Math.cos((centerLat * Math.PI) / 180);

  const height = (bounds.maxLat - bounds.minLat) * metersPerDegreeLat;
  const width = (bounds.maxLon - bounds.minLon) * metersPerDegreeLon;

  return { width: Math.round(width), height: Math.round(height) };
}
