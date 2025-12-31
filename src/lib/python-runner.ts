import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { EventEmitter } from "events";

export interface ConversionConfig {
  inputFile: string;
  outputFile: string;
  bounds: {
    minLat: number;
    minLon: number;
    maxLat: number;
    maxLon: number;
  };
  mapSize: {
    width: number;
    height: number;
  };
  // Optional filtering - these determine what gets included
  railTypes?: string[];
  highwayTypes?: string[];
}

export interface ProgressEvent {
  type: string;
  phase?: string;
  description?: string;
  message?: string;
  percent?: number;
  elapsed_seconds?: number;
  remaining_seconds?: number;
  timestamp?: string;
  details?: Record<string, unknown>;
  stats?: Record<string, number>;
  count?: number;
  total?: number;
}

export interface ConversionLog {
  timestamp: string;
  type: "phase" | "step" | "info" | "error" | "stats" | "estimate";
  message: string;
  percent?: number;
  details?: Record<string, unknown>;
}

export interface ConversionResult {
  success: boolean;
  outputFile?: string;
  logFile?: string;
  stats?: {
    nodes: number;
    edges: number;
    towns: number;
    areas: number;
    objects: number;
  };
  error?: string;
  duration?: number;
}

export interface PythonDependencyCheck {
  ok: boolean;
  pythonVersion: string;
  installed: Array<{
    module: string;
    package: string;
    version: string;
    description: string;
  }>;
  missing: string[];
  errors: Array<{ module: string; error: string }>;
}

// File-based storage for conversion logs
// Note: In-memory Maps don't work in Next.js because API routes run in different contexts
const STORAGE_DIR = process.env.OUTPUT_DIR || "./storage/outputs";

function getLogsFilePath(conversionId: string): string {
  return path.join(STORAGE_DIR, `${conversionId}.logs.json`);
}

function getProgressFilePath(conversionId: string): string {
  return path.join(STORAGE_DIR, `${conversionId}.progress.json`);
}

export function getConversionLogs(conversionId: string): ConversionLog[] {
  try {
    const filePath = getLogsFilePath(conversionId);
    if (fsSync.existsSync(filePath)) {
      const content = fsSync.readFileSync(filePath, "utf-8");
      return JSON.parse(content);
    }
  } catch (error) {
    console.error(`Error reading logs for ${conversionId}:`, error);
  }
  return [];
}

export function getConversionProgress(conversionId: string): { percent: number; phase: string; estimate?: number } | null {
  try {
    const filePath = getProgressFilePath(conversionId);
    if (fsSync.existsSync(filePath)) {
      const content = fsSync.readFileSync(filePath, "utf-8");
      return JSON.parse(content);
    }
  } catch (error) {
    console.error(`Error reading progress for ${conversionId}:`, error);
  }
  return null;
}

export function getAllConversionIds(): string[] {
  try {
    if (fsSync.existsSync(STORAGE_DIR)) {
      const files = fsSync.readdirSync(STORAGE_DIR);
      return files
        .filter(f => f.endsWith(".logs.json"))
        .map(f => f.replace(".logs.json", ""));
    }
  } catch (error) {
    console.error("Error listing conversion IDs:", error);
  }
  return [];
}

function appendLog(conversionId: string, log: ConversionLog): void {
  try {
    const filePath = getLogsFilePath(conversionId);
    // Ensure directory exists
    if (!fsSync.existsSync(STORAGE_DIR)) {
      fsSync.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    // Read existing logs or create empty array
    let logs: ConversionLog[] = [];
    if (fsSync.existsSync(filePath)) {
      const content = fsSync.readFileSync(filePath, "utf-8");
      logs = JSON.parse(content);
    }
    logs.push(log);
    fsSync.writeFileSync(filePath, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error(`Error appending log for ${conversionId}:`, error);
  }
}

function updateProgress(conversionId: string, progress: { percent: number; phase: string; estimate?: number }): void {
  try {
    const filePath = getProgressFilePath(conversionId);
    // Ensure directory exists
    if (!fsSync.existsSync(STORAGE_DIR)) {
      fsSync.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    fsSync.writeFileSync(filePath, JSON.stringify(progress));
  } catch (error) {
    console.error(`Error updating progress for ${conversionId}:`, error);
  }
}

export function initConversionLogs(conversionId: string): void {
  const logsPath = getLogsFilePath(conversionId);
  const progressPath = getProgressFilePath(conversionId);
  // Ensure directory exists
  if (!fsSync.existsSync(STORAGE_DIR)) {
    fsSync.mkdirSync(STORAGE_DIR, { recursive: true });
  }
  // Initialize empty files
  if (!fsSync.existsSync(logsPath)) {
    fsSync.writeFileSync(logsPath, "[]");
  }
  fsSync.writeFileSync(progressPath, JSON.stringify({ percent: 0, phase: "init" }));
  console.log(`[Logs] Initialized log files for ${conversionId}`);
}

export function pushConversionLog(
  conversionId: string, 
  type: ConversionLog["type"], 
  message: string, 
  percent?: number
): void {
  const log: ConversionLog = {
    timestamp: new Date().toISOString(),
    type,
    message,
    ...(percent !== undefined ? { percent } : {}),
  };
  appendLog(conversionId, log);
  console.log(`[${conversionId}] Log: ${type} - ${message.substring(0, 50)}`);
}

export class PythonRunner extends EventEmitter {
  private process: ChildProcess | null = null;
  private pythonPath: string;
  private scriptDir: string;
  private logs: string[] = [];
  private structuredLogs: ConversionLog[] = [];
  private startTime: number = 0;
  private currentConversionId: string | null = null;
  private currentPercent: number = 0;
  private currentPhase: string = "init";
  private estimatedSeconds: number | null = null;

  constructor() {
    super();
    this.pythonPath = process.env.PYTHON_PATH || "python3";
    this.scriptDir = process.env.PYTHON_SCRIPT_DIR || path.join(process.cwd(), "python");
    
    // Add default error handler to prevent uncaught exceptions
    // when no external listener is attached
    this.on("error", () => {
      // Errors are logged elsewhere, this just prevents Node from throwing
    });
  }
  
  setConversionId(id: string): void {
    this.currentConversionId = id;
    this.structuredLogs = [];
    
    // Reset progress tracking
    this.currentPercent = 0;
    this.currentPhase = "init";
    this.estimatedSeconds = null;
    
    // Initialize file-based logs (if not already done)
    initConversionLogs(id);
    console.log(`[PythonRunner] Set conversion ID: ${id}`);
  }
  
  /**
   * Get the current conversion ID
   */
  getCurrentConversionId(): string | null {
    return this.currentConversionId;
  }
  
  private addLog(log: ConversionLog): void {
    this.structuredLogs.push(log);
    if (log.percent !== undefined) {
      this.currentPercent = log.percent;
    }
    // Write to file-based storage
    if (this.currentConversionId) {
      appendLog(this.currentConversionId, log);
      updateProgress(this.currentConversionId, {
        percent: this.currentPercent,
        phase: this.currentPhase,
        estimate: this.estimatedSeconds || undefined,
      });
    }
    this.emit("structured-log", log);
  }
  
  /**
   * Check if Python and all dependencies are installed using check_deps.py
   */
  async checkDependencies(): Promise<PythonDependencyCheck> {
    return new Promise((resolve) => {
      const checkScript = path.join(this.scriptDir, "check_deps.py");
      const proc = spawn(this.pythonPath, [checkScript, "--json"], {
        timeout: 30000, // 30 seconds should be enough
        cwd: this.scriptDir,
      });
      
      let stdout = "";
      let stderr = "";
      
      proc.stdout?.on("data", (data) => {
        stdout += data.toString();
      });
      
      proc.stderr?.on("data", (data) => {
        stderr += data.toString();
      });
      
      proc.on("close", (code) => {
        try {
          const result = JSON.parse(stdout);
          resolve({
            ok: result.ok,
            pythonVersion: result.python_version,
            installed: result.installed || [],
            missing: result.missing?.map((m: { module: string }) => m.module) || [],
            errors: result.errors || [],
          });
        } catch {
          // JSON parse failed - check_deps.py might not exist or Python failed
          resolve({
            ok: false,
            pythonVersion: "unknown",
            installed: [],
            missing: ["check_deps.py failed to run"],
            errors: [{ module: "check_deps", error: stderr || `Exit code: ${code}` }],
          });
        }
      });
      
      proc.on("error", (error) => {
        resolve({
          ok: false,
          pythonVersion: "unknown",
          installed: [],
          missing: ["Python not found"],
          errors: [{ module: "python", error: error.message }],
        });
      });
    });
  }
  
  /**
   * Quick check if Python is available
   */
  async isPythonAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(this.pythonPath, ["--version"], { timeout: 5000 });
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });
  }

  async runConversion(config: ConversionConfig): Promise<ConversionResult> {
    this.logs = [];
    this.startTime = Date.now();

    // Check Python dependencies first
    const deps = await this.checkDependencies();
    if (!deps.ok) {
      const missingList = deps.missing.join(", ");
      const errorLines = [
        `Python dependencies missing: ${missingList}`,
        "",
        "To fix this, run one of the following commands:",
        `  pip install -r ${path.join(this.scriptDir, "requirements.txt")}`,
        "",
        "Or if that fails (due to osmread build issues):",
        "  pip install protobuf",
        "  pip install git+https://github.com/dezhin/osmread.git",
        "  pip install luadata geopy pyproj lxml networkx scipy numpy utm lupa",
        "",
        `Python version: ${deps.pythonVersion}`,
      ];
      
      if (deps.errors.length > 0) {
        errorLines.push("", "Errors:");
        deps.errors.forEach(e => errorLines.push(`  ${e.module}: ${e.error}`));
      }
      
      const errorMessage = errorLines.join("\n");
      console.error(errorMessage);
      return { success: false, error: errorMessage };
    }

    // Convert to absolute paths (Python runs from scriptDir, so relative paths break)
    const absoluteInputFile = path.isAbsolute(config.inputFile) 
      ? config.inputFile 
      : path.resolve(process.cwd(), config.inputFile);
    const absoluteOutputFile = path.isAbsolute(config.outputFile)
      ? config.outputFile
      : path.resolve(process.cwd(), config.outputFile);
    
    // Validate input file exists
    try {
      await fs.access(absoluteInputFile);
    } catch (error) {
      const errorMessage = `Input file not found: ${absoluteInputFile}`;
      console.error(errorMessage, error);
      return { success: false, error: errorMessage };
    }

    // Build command arguments with absolute paths
    const args = [
      path.join(this.scriptDir, "main.py"),
      absoluteInputFile,
      absoluteOutputFile,
      `${config.mapSize.width},${config.mapSize.height}`,
      `${config.bounds.minLat},${config.bounds.minLon},${config.bounds.maxLat},${config.bounds.maxLon}`,
    ];
    
    // Log file path (Python script writes logs here)
    const pythonLogFile = path.join(this.scriptDir, "log.txt");

    console.log(`Running Python conversion: ${this.pythonPath} ${args.join(" ")}`);

    return new Promise((resolve) => {
      this.process = spawn(this.pythonPath, args, {
        cwd: this.scriptDir,
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
      });

      let stdout = "";
      let stderr = "";

      this.process.stdout?.on("data", (data: Buffer) => {
        const text = data.toString();
        stdout += text;
        this.logs.push(text);
        this.parseProgress(text);
        this.emit("log", text);
      });

      this.process.stderr?.on("data", (data: Buffer) => {
        const text = data.toString();
        stderr += text;
        
        // Parse PROGRESS: lines from stderr
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.startsWith("PROGRESS:")) {
            try {
              const json = JSON.parse(line.slice(9));
              this.handleProgressEvent(json);
            } catch (e) {
              // Not valid JSON, treat as regular output
              this.logs.push(line);
            }
          } else if (line.trim()) {
            // Regular stderr output (actual errors)
            this.logs.push(`[STDERR] ${line}`);
            this.addLog({
              timestamp: new Date().toISOString(),
              type: "error",
              message: line,
            });
          }
        }
        
        this.emit("stderr", text);
      });

      this.process.on("close", async (code) => {
        const duration = Date.now() - this.startTime;
        
        // Read Python's log file (it redirects stdout/stderr there)
        let pythonLog = "";
        try {
          pythonLog = await fs.readFile(pythonLogFile, "utf-8");
          this.logs.push("--- Python log.txt ---");
          this.logs.push(pythonLog);
          
          // Parse progress from log file
          this.parseProgress(pythonLog);
          this.emit("log", pythonLog);
        } catch {
          // log.txt might not exist if Python crashed early
          console.warn("Could not read Python log file:", pythonLogFile);
        }

        if (code === 0) {
          // Check if output file was created
          try {
            await fs.access(absoluteOutputFile);
            const stats = this.parseStats(pythonLog || stdout);
            
            // Save combined log file
            const logFile = absoluteOutputFile.replace(".lua", ".log");
            await fs.writeFile(logFile, this.logs.join("\n"));

            resolve({
              success: true,
              outputFile: absoluteOutputFile,
              logFile,
              stats,
              duration,
            });
          } catch (error) {
            console.error("Output file not created:", error);
            resolve({
              success: false,
              error: "Conversion completed but output file was not created",
              duration,
            });
          }
        } else {
          // Extract error from Python log or stderr
          let errorMessage = stderr || `Process exited with code ${code}`;
          
          // Check for traceback in Python log
          if (pythonLog) {
            const tracebackMatch = pythonLog.match(/Traceback[\s\S]+$/);
            if (tracebackMatch) {
              errorMessage = tracebackMatch[0];
            }
          }
          
          console.error("Python conversion failed:", errorMessage);
          resolve({
            success: false,
            error: errorMessage,
            duration,
          });
        }

        this.process = null;
      });

      this.process.on("error", (error) => {
        console.error("Python process error:", error);
        resolve({
          success: false,
          error: `Failed to start Python process: ${error.message}`,
        });
        this.process = null;
      });
    });
  }

  private handleProgressEvent(event: ProgressEvent): void {
    const timestamp = event.timestamp || new Date().toISOString();
    
    switch (event.type) {
      case "phase":
        this.currentPhase = event.phase || "unknown";
        this.addLog({
          timestamp,
          type: "phase",
          message: event.description || event.phase || "Processing...",
          percent: event.percent,
          details: event.details,
        });
        console.log(`[Phase] ${event.phase}: ${event.description} (${event.percent}%)`);
        break;
        
      case "step":
        this.addLog({
          timestamp,
          type: "step",
          message: event.message || "Step...",
          percent: event.percent,
          details: event.count !== undefined ? { count: event.count, total: event.total } : undefined,
        });
        break;
        
      case "stats":
        this.addLog({
          timestamp,
          type: "stats",
          message: `Stats: ${JSON.stringify(event.stats || event)}`,
          details: event.stats || event as unknown as Record<string, unknown>,
        });
        break;
        
      case "estimate":
        this.estimatedSeconds = event.remaining_seconds || null;
        this.addLog({
          timestamp,
          type: "estimate",
          message: `Estimated time remaining: ${Math.round((event.remaining_seconds || 0) / 60)} minutes`,
        });
        break;
        
      case "info":
        this.addLog({
          timestamp,
          type: "info",
          message: event.message || "",
        });
        break;
        
      case "error":
        this.addLog({
          timestamp,
          type: "error",
          message: event.message || "Unknown error",
        });
        break;
        
      case "complete":
        this.currentPhase = "complete";
        this.currentPercent = 100;
        this.addLog({
          timestamp,
          type: "phase",
          message: "Conversion complete!",
          percent: 100,
          details: event.stats,
        });
        break;
    }
    
    // Emit progress event for listeners
    this.emit("progress", {
      type: event.type,
      phase: this.currentPhase,
      percent: event.percent ?? this.currentPercent,
      message: event.message || event.description,
      details: event.details || event.stats,
    });
  }

  private parseProgress(text: string): void {
    // Parse log output to emit progress events (legacy format from log.txt)
    const lines = text.split("\n");
    
    for (const line of lines) {
      if (line.includes("Parse OSM XML data")) {
        this.addLog({
          timestamp: new Date().toISOString(),
          type: "phase",
          message: "Parsing OSM XML data...",
          percent: 10,
        });
      } else if (line.includes("Convert/Transform data")) {
        this.addLog({
          timestamp: new Date().toISOString(),
          type: "phase",
          message: "Converting and transforming data...",
          percent: 30,
        });
      } else if (line.includes("Optimize Edges")) {
        this.addLog({
          timestamp: new Date().toISOString(),
          type: "phase",
          message: "Optimizing edges and geometry...",
          percent: 50,
        });
      } else if (line.includes("Sort Edges")) {
        this.addLog({
          timestamp: new Date().toISOString(),
          type: "phase",
          message: "Sorting edges by type...",
          percent: 80,
        });
      } else if (line.includes("Write Lua file")) {
        this.addLog({
          timestamp: new Date().toISOString(),
          type: "phase",
          message: "Writing Lua output file...",
          percent: 90,
        });
      } else if (line.includes("Successfully converted")) {
        this.addLog({
          timestamp: new Date().toISOString(),
          type: "phase",
          message: "Conversion completed successfully!",
          percent: 100,
        });
      } else if (line.includes("Loaded") && line.includes("Nodes")) {
        // Parse stats line: "Loaded X Nodes / Y Ways / Z Relations"
        const match = line.match(/Loaded (\d+) Nodes \/ (\d+) Ways \/ (\d+) Relations/);
        if (match) {
          this.addLog({
            timestamp: new Date().toISOString(),
            type: "stats",
            message: `Loaded ${match[1]} nodes, ${match[2]} ways, ${match[3]} relations`,
            details: { nodes: parseInt(match[1]), ways: parseInt(match[2]), relations: parseInt(match[3]) },
          });
        }
      }
    }
  }

  private parseStats(stdout: string): ConversionResult["stats"] {
    const stats = {
      nodes: 0,
      edges: 0,
      towns: 0,
      areas: 0,
      objects: 0,
    };

    // Parse stats from output like:
    // Data contains:
    //   Towns: 15
    //   Nodes: 25000
    //   Edges: 12000
    //   Areas: 500
    //   Objects: 200

    const townsMatch = stdout.match(/Towns:\s*(\d+)/);
    const nodesMatch = stdout.match(/Nodes:\s*(\d+)/);
    const edgesMatch = stdout.match(/Edges:\s*(\d+)/);
    const areasMatch = stdout.match(/Areas:\s*(\d+)/);
    const objectsMatch = stdout.match(/Objects:\s*(\d+)/);

    if (townsMatch) stats.towns = parseInt(townsMatch[1], 10);
    if (nodesMatch) stats.nodes = parseInt(nodesMatch[1], 10);
    if (edgesMatch) stats.edges = parseInt(edgesMatch[1], 10);
    if (areasMatch) stats.areas = parseInt(areasMatch[1], 10);
    if (objectsMatch) stats.objects = parseInt(objectsMatch[1], 10);

    return stats;
  }

  cancel(): void {
    if (this.process) {
      console.log("Cancelling Python process...");
      this.process.kill("SIGTERM");
      this.process = null;
    }
  }

  getLogs(): string[] {
    return this.logs;
  }
}

// Singleton instance for job management
let runnerInstance: PythonRunner | null = null;

export function getPythonRunner(): PythonRunner {
  if (!runnerInstance) {
    runnerInstance = new PythonRunner();
  }
  return runnerInstance;
}

