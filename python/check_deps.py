#!/usr/bin/env python3
"""
Dependency checker for OSM-TPF2 Importer Python scripts.
Run this script to verify all required packages are installed.

Usage: python3 check_deps.py
Exit codes:
  0 = All dependencies OK
  1 = Missing dependencies (listed in output)
"""

import sys
import json

REQUIRED_MODULES = [
    ("luadata", "luadata", "Lua data serialization"),
    ("geopy", "geopy", "Geocoding library"),
    ("pyproj", "pyproj", "Coordinate projections"),
    ("lxml", "lxml", "XML parsing"),
    ("networkx", "networkx", "Graph algorithms"),
    ("scipy", "scipy", "Scientific computing"),
    ("numpy", "numpy", "Numerical arrays"),
    ("osmread", "osmread", "OSM file parsing"),
    ("utm", "utm", "UTM coordinate conversion"),
    ("lupa", "lupa", "Lua-Python bridge"),
]

def check_dependencies():
    """Check all required dependencies and return status."""
    results = {
        "ok": True,
        "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "installed": [],
        "missing": [],
        "errors": []
    }
    
    for module_name, package_name, description in REQUIRED_MODULES:
        try:
            module = __import__(module_name)
            version = getattr(module, "__version__", "unknown")
            results["installed"].append({
                "module": module_name,
                "package": package_name,
                "version": version,
                "description": description
            })
        except ImportError as e:
            results["ok"] = False
            results["missing"].append({
                "module": module_name,
                "package": package_name,
                "description": description,
                "error": str(e)
            })
        except Exception as e:
            results["ok"] = False
            results["errors"].append({
                "module": module_name,
                "error": str(e)
            })
    
    return results

def main():
    """Main entry point."""
    results = check_dependencies()
    
    # Output as JSON for parsing by Node.js
    if "--json" in sys.argv:
        print(json.dumps(results, indent=2))
        sys.exit(0 if results["ok"] else 1)
    
    # Human-readable output
    print(f"Python Version: {results['python_version']}")
    print()
    
    if results["installed"]:
        print("✅ Installed packages:")
        for pkg in results["installed"]:
            print(f"   • {pkg['module']} ({pkg['version']}): {pkg['description']}")
        print()
    
    if results["missing"]:
        print("❌ Missing packages:")
        for pkg in results["missing"]:
            print(f"   • {pkg['module']}: {pkg['description']}")
            print(f"     Install with: pip install {pkg['package']}")
        print()
        print("To install all missing packages, run:")
        print("   pip install -r requirements.txt")
        print()
        print("Or if that fails, try:")
        print("   pip install protobuf")
        print("   pip install git+https://github.com/dezhin/osmread.git")
        print("   pip install luadata geopy pyproj lxml networkx scipy numpy utm lupa")
        print()
    
    if results["errors"]:
        print("⚠️  Errors encountered:")
        for err in results["errors"]:
            print(f"   • {err['module']}: {err['error']}")
        print()
    
    if results["ok"]:
        print("🎉 All dependencies are installed!")
        sys.exit(0)
    else:
        print(f"❌ {len(results['missing'])} package(s) missing")
        sys.exit(1)

if __name__ == "__main__":
    main()

