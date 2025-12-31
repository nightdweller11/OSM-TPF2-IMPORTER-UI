@echo off
REM OSM Data Installer for Transport Fever 2
REM This script copies your exported osmdata.lua to the correct mod folder
REM Works on Windows

setlocal enabledelayedexpansion

echo.
echo ================================================================
echo          OSM Data Installer for Transport Fever 2
echo ================================================================
echo.

set "MOD_NAME=osm_importer_ui_1"
set "SOURCE_FILE="
set "TPF2_MODS="

REM Find osmdata.lua in script directory or current directory
set "SCRIPT_DIR=%~dp0"
if exist "%SCRIPT_DIR%osmdata.lua" (
    set "SOURCE_FILE=%SCRIPT_DIR%osmdata.lua"
) else if exist "osmdata.lua" (
    set "SOURCE_FILE=%CD%\osmdata.lua"
) else (
    echo ERROR: osmdata.lua not found!
    echo.
    echo Please make sure osmdata.lua is in the same folder as this script,
    echo or run this script from the folder containing osmdata.lua.
    echo.
    pause
    exit /b 1
)

echo Found: %SOURCE_FILE%
echo.

REM Detect Windows and find TPF2 mods folder
echo Searching for Transport Fever 2...

REM Check common Steam locations
set "STEAM_PATHS[0]=C:\Program Files (x86)\Steam\steamapps\common\Transport Fever 2\mods"
set "STEAM_PATHS[1]=C:\Program Files\Steam\steamapps\common\Transport Fever 2\mods"
set "STEAM_PATHS[2]=D:\Steam\steamapps\common\Transport Fever 2\mods"
set "STEAM_PATHS[3]=D:\SteamLibrary\steamapps\common\Transport Fever 2\mods"
set "STEAM_PATHS[4]=E:\Steam\steamapps\common\Transport Fever 2\mods"
set "STEAM_PATHS[5]=E:\SteamLibrary\steamapps\common\Transport Fever 2\mods"
set "STEAM_PATHS[6]=%USERPROFILE%\Steam\steamapps\common\Transport Fever 2\mods"

REM Check standalone locations
set "STANDALONE_PATHS[0]=%APPDATA%\Transport Fever 2\mods"
set "STANDALONE_PATHS[1]=%LOCALAPPDATA%\Transport Fever 2\mods"

REM Search Steam locations
for /L %%i in (0,1,6) do (
    if exist "!STEAM_PATHS[%%i]!" (
        set "TPF2_MODS=!STEAM_PATHS[%%i]!"
        echo Found Steam installation: !TPF2_MODS!
        goto :found_mods
    )
)

REM Search standalone locations
for /L %%i in (0,1,1) do (
    if exist "!STANDALONE_PATHS[%%i]!" (
        set "TPF2_MODS=!STANDALONE_PATHS[%%i]!"
        echo Found standalone installation: !TPF2_MODS!
        goto :found_mods
    )
)

REM Not found
echo ERROR: Could not find Transport Fever 2 mods folder!
echo.
echo Searched locations:
echo   - C:\Program Files (x86)\Steam\steamapps\common\Transport Fever 2\mods
echo   - C:\Program Files\Steam\steamapps\common\Transport Fever 2\mods
echo   - D:\Steam, D:\SteamLibrary, E:\Steam, E:\SteamLibrary
echo   - %%APPDATA%%\Transport Fever 2\mods
echo.
echo Please install Transport Fever 2 first, or manually copy osmdata.lua to:
echo   ^<TPF2 installation^>\mods\%MOD_NAME%\res\scripts\osm_importer\osmdata.lua
echo.
pause
exit /b 1

:found_mods
echo.

REM Find the OSM Importer mod
set "MOD_DIR=%TPF2_MODS%\%MOD_NAME%"

if not exist "%MOD_DIR%" (
    echo ERROR: OSM Importer UI mod not found!
    echo.
    echo Expected location: %MOD_DIR%
    echo.
    echo Please install the OSM Importer UI mod first:
    echo   1. Download from the mod repository
    echo   2. Run install-mod.bat
    echo   3. Then run this script again
    echo.
    pause
    exit /b 1
)

echo Found mod folder: %MOD_DIR%
echo.

REM The osmdata.lua must go in res\scripts\osm_importer\
set "SCRIPTS_DIR=%MOD_DIR%\res\scripts\osm_importer"

if not exist "%SCRIPTS_DIR%" (
    echo ERROR: Scripts folder not found!
    echo Expected: %SCRIPTS_DIR%
    echo The mod installation may be incomplete.
    pause
    exit /b 1
)

REM Check if osmdata.lua already exists
set "DEST_FILE=%SCRIPTS_DIR%\osmdata.lua"

if exist "%DEST_FILE%" (
    echo WARNING: osmdata.lua already exists!
    echo.
    echo Existing file: %DEST_FILE%
    for %%A in ("%DEST_FILE%") do echo File size: %%~zA bytes
    echo.
    
    REM Create backup filename with timestamp
    for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
    set "BACKUP_FILE=%MOD_DIR%\osmdata.lua.backup.%datetime:~0,8%_%datetime:~8,6%"
    
    set /p "CONFIRM=Do you want to replace it? (y/n): "
    if /i "!CONFIRM!" neq "y" (
        echo Installation cancelled.
        pause
        exit /b 0
    )
    
    echo Creating backup: !BACKUP_FILE!
    copy "%DEST_FILE%" "!BACKUP_FILE!" > nul
)

REM Copy the file
echo.
echo Copying osmdata.lua...
copy /y "%SOURCE_FILE%" "%DEST_FILE%" > nul

REM Verify
if exist "%DEST_FILE%" (
    echo.
    echo ================================================================
    echo                  Installation successful!
    echo ================================================================
    echo.
    echo osmdata.lua has been copied to:
    echo   %DEST_FILE%
    echo.
    for %%A in ("%DEST_FILE%") do echo File size: %%~zA bytes
    echo.
    echo Next steps:
    echo   1. Start Transport Fever 2
    echo   2. Load or create a game with OSM Importer UI enabled
    echo   3. Click 'OSM' in the bottom bar
    echo   4. Click 'RUN IMPORT' to import your map data
    echo.
) else (
    echo ERROR: Failed to copy file!
    pause
    exit /b 1
)

pause

