# OSM Data Installer for Transport Fever 2
# This script copies your exported osmdata.lua to the correct mod folder
# Works on Windows (PowerShell)

param(
    [string]$SourceFile = ""
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "          OSM Data Installer for Transport Fever 2             " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

$ModName = "osm_importer_ui_1"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Find osmdata.lua
if ($SourceFile -and (Test-Path $SourceFile)) {
    $Source = $SourceFile
} elseif (Test-Path "$ScriptDir\osmdata.lua") {
    $Source = "$ScriptDir\osmdata.lua"
} elseif (Test-Path ".\osmdata.lua") {
    $Source = (Resolve-Path ".\osmdata.lua").Path
} else {
    Write-Host "ERROR: osmdata.lua not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please make sure osmdata.lua is in the same folder as this script,"
    Write-Host "or provide the path as an argument:"
    Write-Host "  .\install-osmdata.ps1 -SourceFile 'C:\path\to\osmdata.lua'"
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Found: $Source" -ForegroundColor Green
Write-Host ""

# Search paths for TPF2
$SteamPaths = @(
    "C:\Program Files (x86)\Steam\steamapps\common\Transport Fever 2\mods",
    "C:\Program Files\Steam\steamapps\common\Transport Fever 2\mods",
    "D:\Steam\steamapps\common\Transport Fever 2\mods",
    "D:\SteamLibrary\steamapps\common\Transport Fever 2\mods",
    "E:\Steam\steamapps\common\Transport Fever 2\mods",
    "E:\SteamLibrary\steamapps\common\Transport Fever 2\mods",
    "$env:USERPROFILE\Steam\steamapps\common\Transport Fever 2\mods"
)

$StandalonePaths = @(
    "$env:APPDATA\Transport Fever 2\mods",
    "$env:LOCALAPPDATA\Transport Fever 2\mods"
)

Write-Host "Searching for Transport Fever 2..."

$TPF2Mods = $null

# Check Steam locations
foreach ($path in $SteamPaths) {
    if (Test-Path $path) {
        $TPF2Mods = $path
        Write-Host "Found Steam installation: $path" -ForegroundColor Green
        break
    }
}

# Check standalone locations
if (-not $TPF2Mods) {
    foreach ($path in $StandalonePaths) {
        if (Test-Path $path) {
            $TPF2Mods = $path
            Write-Host "Found standalone installation: $path" -ForegroundColor Green
            break
        }
    }
}

if (-not $TPF2Mods) {
    Write-Host "ERROR: Could not find Transport Fever 2 mods folder!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Searched locations:"
    foreach ($path in $SteamPaths + $StandalonePaths) {
        Write-Host "  - $path"
    }
    Write-Host ""
    Write-Host "Please install Transport Fever 2 first, or manually copy osmdata.lua to:"
    Write-Host "  <TPF2 installation>\mods\$ModName\osmdata.lua"
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Find the OSM Importer mod
$ModDir = Join-Path $TPF2Mods $ModName

if (-not (Test-Path $ModDir)) {
    Write-Host "ERROR: OSM Importer UI mod not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Expected location: $ModDir"
    Write-Host ""
    Write-Host "Please install the OSM Importer UI mod first:"
    Write-Host "  1. Download from the mod repository"
    Write-Host "  2. Run install-mod.bat or install-mod.ps1"
    Write-Host "  3. Then run this script again"
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Found mod folder: $ModDir" -ForegroundColor Green
Write-Host ""

# Check if osmdata.lua already exists
$DestFile = Join-Path $ModDir "osmdata.lua"

if (Test-Path $DestFile) {
    $existingFile = Get-Item $DestFile
    
    Write-Host "WARNING: osmdata.lua already exists!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Existing file: $DestFile"
    Write-Host "File size: $([math]::Round($existingFile.Length / 1KB, 2)) KB"
    Write-Host "Modified: $($existingFile.LastWriteTime)"
    Write-Host ""
    
    # Create backup filename
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $BackupFile = Join-Path $ModDir "osmdata.lua.backup.$timestamp"
    
    $confirm = Read-Host "Do you want to replace it? (y/n)"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-Host "Installation cancelled."
        exit 0
    }
    
    Write-Host "Creating backup: $BackupFile"
    Copy-Item $DestFile $BackupFile
}

# Copy the file
Write-Host ""
Write-Host "Copying osmdata.lua..."

try {
    Copy-Item $Source $DestFile -Force
    
    if (Test-Path $DestFile) {
        $newFile = Get-Item $DestFile
        
        Write-Host ""
        Write-Host "================================================================" -ForegroundColor Green
        Write-Host "                  Installation successful!                      " -ForegroundColor Green
        Write-Host "================================================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "osmdata.lua has been copied to:"
        Write-Host "  $DestFile"
        Write-Host ""
        Write-Host "File size: $([math]::Round($newFile.Length / 1KB, 2)) KB"
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "  1. Start Transport Fever 2"
        Write-Host "  2. Load or create a game with OSM Importer UI enabled"
        Write-Host "  3. Click 'OSM' in the bottom bar"
        Write-Host "  4. Click 'RUN IMPORT' to import your map data"
        Write-Host ""
    } else {
        throw "File was not created"
    }
} catch {
    Write-Host "ERROR: Failed to copy file!" -ForegroundColor Red
    Write-Host $_.Exception.Message
    Read-Host "Press Enter to exit"
    exit 1
}

Read-Host "Press Enter to exit"

