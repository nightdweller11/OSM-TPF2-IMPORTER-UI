"""
Progress reporting module for OSM-TPF2 Converter.
Outputs structured progress updates to stderr for real-time capture by Node.js.
"""

import sys
import json
import time
from datetime import datetime

# Store start time for duration estimation
_start_time = None
_phase_times = {}

def init():
    """Initialize progress tracking."""
    global _start_time
    _start_time = time.time()

def _emit(data):
    """Emit a progress event to stderr as JSON."""
    # Flush to ensure real-time output
    sys.stderr.write("PROGRESS:" + json.dumps(data) + "\n")
    sys.stderr.flush()

def phase(name, description, percent, details=None):
    """Report entering a new phase."""
    global _phase_times
    _phase_times[name] = time.time()
    
    elapsed = time.time() - _start_time if _start_time else 0
    
    data = {
        "type": "phase",
        "phase": name,
        "description": description,
        "percent": percent,
        "elapsed_seconds": round(elapsed, 1),
        "timestamp": datetime.now().isoformat()
    }
    if details:
        data["details"] = details
    _emit(data)

def step(message, percent=None, count=None, total=None):
    """Report a step within the current phase."""
    elapsed = time.time() - _start_time if _start_time else 0
    
    data = {
        "type": "step",
        "message": message,
        "elapsed_seconds": round(elapsed, 1),
        "timestamp": datetime.now().isoformat()
    }
    if percent is not None:
        data["percent"] = percent
    if count is not None:
        data["count"] = count
    if total is not None:
        data["total"] = total
    _emit(data)

def stats(nodes=0, ways=0, relations=0, edges=0, towns=0, areas=0, objects=0):
    """Report current statistics."""
    elapsed = time.time() - _start_time if _start_time else 0
    
    _emit({
        "type": "stats",
        "nodes": nodes,
        "ways": ways,
        "relations": relations,
        "edges": edges,
        "towns": towns,
        "areas": areas,
        "objects": objects,
        "elapsed_seconds": round(elapsed, 1)
    })

def estimate(remaining_seconds):
    """Report estimated time remaining."""
    _emit({
        "type": "estimate",
        "remaining_seconds": round(remaining_seconds, 0),
        "timestamp": datetime.now().isoformat()
    })

def complete(stats_dict):
    """Report conversion complete."""
    elapsed = time.time() - _start_time if _start_time else 0
    
    _emit({
        "type": "complete",
        "success": True,
        "elapsed_seconds": round(elapsed, 1),
        "stats": stats_dict,
        "timestamp": datetime.now().isoformat()
    })

def error(message, phase_name=None):
    """Report an error."""
    elapsed = time.time() - _start_time if _start_time else 0
    
    _emit({
        "type": "error",
        "message": message,
        "phase": phase_name,
        "elapsed_seconds": round(elapsed, 1),
        "timestamp": datetime.now().isoformat()
    })

def info(message):
    """Report informational message."""
    _emit({
        "type": "info",
        "message": message,
        "timestamp": datetime.now().isoformat()
    })

