# Bundled Mods

This directory contains downloaded mods for OSM-TPF2 Importer.

**These files are NOT tracked in git** due to their size (~5.5GB total).

## Directory Structure

```
bundled_mods/
├── steam/           # Mods downloaded from Steam Workshop
├── downloads/       # Mods downloaded from transportfever.net
├── github/          # Mods cloned from GitHub
└── README.md        # This file
```

## How to Populate

### Option 1: Run the download scripts

```bash
# Subscribe to Steam mods one-by-one
./scripts/subscribe_steam_mods.sh

# Copy your Steam subscriptions
./scripts/copy_local_mods.sh

# Download from transportfever.net (opens browser)
./scripts/download_all_mods.sh
```

### Option 2: Download pre-built bundles

Download from the external storage (link TBD) and extract here.

## Creating Bundles

After populating this folder, run:

```bash
./scripts/create_mod_bundles.sh
```

This creates ZIP bundles in `public/downloads/mod-bundles/`.

