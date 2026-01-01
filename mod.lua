function data()
	return {
		info = {
			name = "OSM Importer UI",
			description = [[
Import real-world OpenStreetMap data into Transport Fever 2.
Automatically builds streets, tracks, forests, and more from OSM exports.

HOW TO USE:
1. Look for the OSM Import checkbox in the bottom toolbar
2. Click it to open the import window
3. Or press ` and type: osm()

REQUIRED MODS (for full functionality):
- Forester (for forests)
- Paver (for ground textures)
- Natural Environment Professional 2 (for tracks)

Download mod bundles from the OSM Importer website.
]],
			minorVersion = 11,
			severityAdd = "NONE",
			severityRemove = "NONE",
			tags = {"Script Mod", "Misc"},
			authors = {
				{
					name = "nightdweller",
					role = "CREATOR",
				},
				{
					name = "VacuumTube",
					role = "CONTRIBUTOR",
					tfnetId = 29264,
				},
			},
			url = "https://github.com/Vacuum-Tube/OSM-TPF2-Importer",
		},
		
		-- Optional dependencies - game will suggest enabling these if installed
		-- Note: These use the mod folder names, not Steam IDs
		-- The game will show a warning if these are not enabled
		optionalDependencies = {
			"snowball_forester_1",           -- Forester (required for forests)
			"unixroot_natural_environment_pro_tpf2_2",  -- NEP2 (track types)
		},
		-- postRunFn runs when mod is loaded with a game
		postRunFn = function (settings)
			-- Register model placement script (for placing objects)
			local modelsOk, modelsErr = pcall(function()
				(require"osm_importer.models").postRunFnScript()
			end)
			if not modelsOk then
				print("[OSM Importer UI] Warning: models script: " .. tostring(modelsErr))
			end
			
			-- Create console shortcut (backup method)
			_G.osm = function()
				require "osm_importer.main"
				m.gui.show()
			end
			
			print("[OSM Importer UI] Mod loaded! Look for 'OSM Import' button in bottom bar.")
		end
	}
end
