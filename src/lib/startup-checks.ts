/**
 * Startup checks for the OSM-TPF2 Importer server.
 * 
 * These checks run when the server starts to verify the environment
 * is properly configured. Server will exit if Python is not available
 * or required dependencies are missing.
 */

import { getPythonRunner } from "./python-runner";

/**
 * Check Python environment on startup.
 * Exits the process with code 1 if Python or dependencies are missing.
 */
export async function checkPythonEnvironment() {
  console.log("\n🔍 Checking Python environment...\n");
  
  try {
    const runner = getPythonRunner();
    const check = await runner.checkDependencies();
    
    if (check.ok) {
      console.log("✅ Python environment is ready!");
      console.log(`   Python version: ${check.pythonVersion}`);
      console.log(`   Installed packages: ${check.installed.length}`);
      check.installed.forEach((pkg) => {
        console.log(`     • ${pkg.module} (${pkg.version})`);
      });
      console.log("");
      return; // Success - continue startup
    }
    
    // Python check failed - print details and exit
    console.error("\n❌ FATAL: Python dependencies are missing!\n");
    console.error(`   Python version: ${check.pythonVersion}`);
    console.error("");
    
    if (check.missing.length > 0) {
      console.error("   Missing packages:");
      check.missing.forEach((mod) => {
        console.error(`     ❌ ${mod}`);
      });
      console.error("");
    }
    
    if (check.errors.length > 0) {
      console.error("   Errors:");
      check.errors.forEach((err) => {
        console.error(`     ⚠️  ${err.module}: ${err.error}`);
      });
      console.error("");
    }
    
    printInstallInstructions();
    exitWithError("Missing Python dependencies");
    
  } catch (error) {
    console.error("\n❌ FATAL: Failed to check Python environment!\n");
    console.error(`   ${error instanceof Error ? error.message : String(error)}`);
    console.error("");
    console.error("   Make sure Python 3 is installed and available as 'python3'");
    console.error("   Or set PYTHON_PATH environment variable to your Python executable");
    console.error("");
    
    printInstallInstructions();
    exitWithError("Python not available");
  }
}

function printInstallInstructions() {
  console.error("   ╔════════════════════════════════════════════════════════════════╗");
  console.error("   ║                     HOW TO FIX                                 ║");
  console.error("   ╠════════════════════════════════════════════════════════════════╣");
  console.error("   ║  Run one of these commands:                                    ║");
  console.error("   ║                                                                ║");
  console.error("   ║    pip install -r python/requirements.txt                      ║");
  console.error("   ║                                                                ║");
  console.error("   ║  Or if that fails (due to osmread build issues):               ║");
  console.error("   ║                                                                ║");
  console.error("   ║    pip install protobuf                                        ║");
  console.error("   ║    pip install git+https://github.com/dezhin/osmread.git       ║");
  console.error("   ║    pip install luadata geopy pyproj lxml networkx \\            ║");
  console.error("   ║                 scipy numpy utm lupa                           ║");
  console.error("   ║                                                                ║");
  console.error("   ╚════════════════════════════════════════════════════════════════╝");
  console.error("");
}

function exitWithError(reason: string) {
  console.error(`\n🛑 Server startup aborted: ${reason}\n`);
  process.exit(1);
}

