function data()
	return {
		info = {
			name = "OSM Importer UI",
			description = [[
Import real-world OpenStreetMap data into Transport Fever 2.
Automatically builds streets, tracks, forests, and more from OSM exports.

HOW TO USE:
1. Press ` (backtick) to open console
2. Type: osm()
3. Press Enter

Or type the full command:
  require "osm_importer.main" m.gui.show()

Requires: CommonAPI2, Forester, Paver
]],
			minorVersion = 10,
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
