@echo off
REM OSM Importer UI - Mod Installation Script (Windows)
REM Run this script to copy the latest mod version to TPF2

setlocal enabledelayedexpansion

set "MOD_NAME=osm_importer_ui_1"
set "SCRIPT_DIR=%~dp0"

REM Check Steam location first (most common)
set "STEAM_MODS=C:\Program Files (x86)\Steam\steamapps\common\Transport Fever 2\mods"
set "STEAM_MODS_ALT=%USERPROFILE%\Steam\steamapps\common\Transport Fever 2\mods"
set "STANDALONE_MODS=%APPDATA%\Transport Fever 2\mods"

if exist "%STEAM_MODS%" (
    set "TPF2_MODS=%STEAM_MODS%"
    echo Found Steam installation (Program Files)
) else if exist "%STEAM_MODS_ALT%" (
    set "TPF2_MODS=%STEAM_MODS_ALT%"
    echo Found Steam installation (User folder)
) else if exist "%STANDALONE_MODS%" (
    set "TPF2_MODS=%STANDALONE_MODS%"
    echo Found standalone installation
) else (
    echo ERROR: Could not find Transport Fever 2 mods folder!
    echo Tried: %STEAM_MODS%
    echo Tried: %STEAM_MODS_ALT%
    echo Tried: %STANDALONE_MODS%
    pause
    exit /b 1
)

set "MOD_DIR=%TPF2_MODS%\%MOD_NAME%"

echo.
echo  OSM Importer UI - Mod Installer
echo ==================================
echo.
echo Source: %SCRIPT_DIR%
echo Target: %MOD_DIR%
echo.

REM Create mod directory
if not exist "%MOD_DIR%" (
    echo Creating mod directory...
    mkdir "%MOD_DIR%"
)

REM Copy mod files
echo Copying mod files...
copy /Y "%SCRIPT_DIR%mod.lua" "%MOD_DIR%\" >nul
xcopy /E /I /Y "%SCRIPT_DIR%res" "%MOD_DIR%\res" >nul

REM Check if osmdata.lua exists in correct location
if exist "%MOD_DIR%\res\scripts\osm_importer\osmdata.lua" (
    echo Preserved existing osmdata.lua
)

echo.
echo Mod installed successfully!
echo.
echo Installed to: %MOD_DIR%
echo.
echo Next steps:
echo   1. Restart Transport Fever 2
echo   2. Enable 'OSM Importer UI' in Mod Manager
echo   3. Also enable: CommonAPI2, Forester, Paver
echo   4. Place your osmdata.lua in:
echo      %MOD_DIR%\res\scripts\osm_importer\osmdata.lua
echo.

dir "%MOD_DIR%"
echo.
pause
