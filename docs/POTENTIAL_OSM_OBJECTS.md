# Potential OSM Objects for TPF2 Import

This document lists OSM features that could potentially be imported into Transport Fever 2.

## Currently Implemented

| OSM Tag | Object Type | TPF2 Asset | Status |
|---------|-------------|------------|--------|
| `natural=tree` | tree | `tree/shingle_oak.mdl` + variations | ✅ Working (vanilla) |
| `natural=tree` + conifer | tree_conifer | `tree/norway_spruce.mdl` + variations | ✅ Working (vanilla) |
| `amenity=fountain` | fountain | `asset/ground/fountain_1.mdl` | ✅ Working (vanilla) |
| `barrier=bollard` | bollard | `asset/connum_poller_gehweg_rund_1.mdl` | ✅ Needs mod |
| `advertising=column` | litfass | `asset/sab_LitV2_3.mdl` | ✅ Needs mod |
| `amenity=bench` | bench | `asset/bench_1.mdl` | ✅ Needs mod |
| `highway=bus_stop` | bus_stop | `asset/bus_stop_sign.mdl` | ✅ Needs mod |
| `amenity=shelter` | shelter | `asset/shelter_modern.mdl` | ✅ Needs mod |
| `amenity=bicycle_parking` | bike_rack | `asset/bike_rack_1.mdl` | ✅ Needs mod |
| `highway=street_lamp` | street_lamp | `asset/street_lamp_modern.mdl` | ✅ Needs mod |
| `amenity=waste_basket` | trash_bin | `asset/trash_bin_1.mdl` | ✅ Needs mod |
| `amenity=post_box` | post_box | `asset/post_box_1.mdl` | ✅ Needs mod |

## Potential Additions - Street Furniture

| OSM Tag | Object Type | Suggested TPF2 Asset | Priority |
|---------|-------------|---------------------|----------|
| `amenity=telephone` | phone_booth | `asset/phone_booth_*.mdl` | Low |
| `amenity=vending_machine` | vending | `asset/vending_*.mdl` | Low |
| `tourism=information` | info_board | `asset/info_board_*.mdl` | Low |

## Potential Additions - Transit Infrastructure

| OSM Tag | Object Type | Suggested TPF2 Asset | Priority |
|---------|-------------|---------------------|----------|
| `railway=platform` | platform | Construction | Medium |
| `railway=station` | station | Construction | Low (complex) |
| `amenity=parking` | parking_lot | Paver ground texture | Medium |

## Potential Additions - Traffic Infrastructure

| OSM Tag | Object Type | Suggested TPF2 Asset | Priority |
|---------|-------------|---------------------|----------|
| `highway=traffic_signals` | traffic_light | `asset/traffic_light_1.mdl` | ✅ Working (needs mod) |
| `highway=crossing` | crossing | `asset/crossing_sign_1.mdl` | ✅ Working (needs mod) |
| `highway=stop` | stop_sign | `asset/stop_sign_1.mdl` | ✅ Working (needs mod) |
| `highway=give_way` | yield_sign | `asset/yield_sign_1.mdl` | ✅ Working (needs mod) |
| `highway=traffic_mirror` | traffic_mirror | `asset/traffic_mirror_1.mdl` | ✅ Working (needs mod) |
| `highway=speed_camera` | speed_camera | `asset/speed_camera_1.mdl` | ✅ Working (needs mod) |
| `emergency=fire_hydrant` | fire_hydrant | `asset/fire_hydrant_1.mdl` | ✅ Working (needs mod) |
| `amenity=telephone` | phone_booth | `asset/phone_booth_1.mdl` | ✅ Working (needs mod) |
| `amenity=clock` | clock | `asset/clock_1.mdl` | ✅ Working (needs mod) |
| `man_made=flagpole` | flagpole | `asset/flagpole_1.mdl` | ✅ Working (needs mod) |
| `traffic_calming=bump` | speed_bump | Ground decal | Low (not implemented) |

## Potential Additions - Decorative

| OSM Tag | Object Type | Suggested TPF2 Asset | Priority |
|---------|-------------|---------------------|----------|
| `amenity=clock` | clock | `asset/clock_*.mdl` | Low |
| `historic=memorial` | monument | `asset/monument_*.mdl` | Low |
| `tourism=artwork` | sculpture | `asset/sculpture_*.mdl` | Low |
| `man_made=flagpole` | flagpole | `asset/flagpole_*.mdl` | Low |

## Potential Additions - Railway Signals

| OSM Tag | Object Type | Notes | Priority |
|---------|-------------|-------|----------|
| `railway=signal` | signal | Already extracted in Python, needs Lua placement | High |
| `railway=switch` | switch | Already extracted, affects track geometry | High |
| `railway=buffer_stop` | buffer_stop | End of track | Medium |
| `railway=level_crossing` | crossing | Road/rail crossing | Medium |

## Ground Surfaces (Paver)

| OSM Tag | Surface Type | Paver Texture | Priority |
|---------|--------------|---------------|----------|
| `amenity=parking` | parking | `asphalt_parking` | High |
| `leisure=playground` | playground | `rubber_surface` | Medium |
| `leisure=pitch` | sports_field | `grass` or `artificial_turf` | Medium |
| `landuse=grass` | grass_area | `grass` | Low |

## Implementation Notes

### Adding New Objects

1. **Python side** (`convert_data.py`):
   ```python
   if tags.get("amenity") == "bench":
       add_object("bench", pos)
   ```

2. **Lua side** (`models.lua`):
   ```lua
   m.models = {
       bench = "asset/bench_modern.mdl",
       -- ... add more mappings
   }
   ```

3. **Required mods** for assets:
   - Connum's German Traffic Assets (bollards, signs)
   - Street furniture packs
   - City details mods

### TPF2 Limitations

- No building import API (buildings grow from towns)
- No water body creation
- Limited terrain modification
- Asset models must exist in game/mods

### Priority Legend

- **High**: Common objects that enhance realism
- **Medium**: Nice to have, moderate effort
- **Low**: Edge cases or complex implementation

