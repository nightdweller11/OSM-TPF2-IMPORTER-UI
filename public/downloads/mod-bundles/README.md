# Mod Bundles

This directory contains pre-packaged mod bundles for download.

**The ZIP files are NOT tracked in git** due to their size (~5.7GB total).

## Available Bundles

| Bundle | Size | Description |
|--------|------|-------------|
| `osm-mods-required.zip` | ~1.6 GB | Core mods for basic functionality |
| `osm-mods-recommended.zip` | ~1.7 GB | Required + enhancements |
| `osm-mods-all.zip` | ~2.4 GB | Complete mod collection |

## External Storage

These bundles are hosted externally:
- **TODO**: Add external download links (Google Drive, Dropbox, etc.)

## Generating Bundles

If you have the mods downloaded locally:

```bash
./scripts/create_mod_bundles.sh
```

This requires the `bundled_mods/` directory to be populated first.

