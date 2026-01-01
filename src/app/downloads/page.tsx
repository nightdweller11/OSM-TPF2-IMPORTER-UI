'use client';

import Link from 'next/link';

const MOD_BUNDLES = [
  {
    name: 'Required Mods',
    filename: 'osm-mods-required.zip',
    size: '1.6 GB',
    description: 'Core mods needed for basic OSM import functionality. Includes track types, street types, bridges, signals, and essential textures.',
    modCount: 28,
    recommended: false,
  },
  {
    name: 'Recommended Mods',
    filename: 'osm-mods-recommended.zip',
    size: '1.7 GB',
    description: 'Required mods plus additional enhancements like traffic assets, tram support, and sidewalk adjustments. Best balance of features and download size.',
    modCount: 37,
    recommended: true,
  },
  {
    name: 'All Mods',
    filename: 'osm-mods-all.zip',
    size: '2.4 GB',
    description: 'Complete mod collection including large mods like Freestyle Station (452MB), Ks-Signalsystem (480MB), and Spacky Trees (317MB). For the full experience.',
    modCount: 46,
    recommended: false,
  },
];

export default function DownloadsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <Link href="/" className="text-blue-400 hover:text-blue-300 flex items-center gap-2">
            ← Back to Home
          </Link>
        </div>

        <h1 className="text-4xl font-bold mb-4">Mod Downloads</h1>
        <p className="text-slate-300 mb-8 max-w-2xl">
          Download pre-packaged mod bundles for the OSM-TPF2 Importer. These bundles include all the mods 
          listed in the <a href="https://github.com/Vacuum-Tube/OSM-TPF2-Importer/blob/main/doc/Mods.md" className="text-blue-400 hover:underline" target="_blank">Mods.md</a> documentation.
        </p>

        <div className="grid gap-6 md:grid-cols-3 mb-12">
          {MOD_BUNDLES.map((bundle) => (
            <div
              key={bundle.filename}
              className={`rounded-xl p-6 ${
                bundle.recommended
                  ? 'bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-2 border-blue-500'
                  : 'bg-slate-800/50 border border-slate-700'
              }`}
            >
              {bundle.recommended && (
                <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">
                  ★ Recommended
                </div>
              )}
              <h2 className="text-2xl font-bold mb-2">{bundle.name}</h2>
              <div className="flex gap-4 text-sm text-slate-400 mb-4">
                <span>{bundle.size}</span>
                <span>•</span>
                <span>{bundle.modCount} mods</span>
              </div>
              <p className="text-slate-300 text-sm mb-6">{bundle.description}</p>
              <a
                href={`/downloads/mod-bundles/${bundle.filename}`}
                download
                className={`block text-center py-3 px-6 rounded-lg font-semibold transition-colors ${
                  bundle.recommended
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
              >
                Download ZIP
              </a>
            </div>
          ))}
        </div>

        <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h2 className="text-xl font-bold mb-4">Installation Instructions</h2>
          <ol className="list-decimal list-inside space-y-3 text-slate-300">
            <li>Download the mod bundle of your choice</li>
            <li>Extract the ZIP file</li>
            <li>
              Run the installer:
              <ul className="list-disc list-inside ml-6 mt-2 text-sm">
                <li><strong>macOS/Linux:</strong> Open Terminal, navigate to the extracted folder, run <code className="bg-slate-700 px-2 py-0.5 rounded">./install.sh</code></li>
                <li><strong>Windows:</strong> Double-click <code className="bg-slate-700 px-2 py-0.5 rounded">install.bat</code></li>
              </ul>
            </li>
            <li>The installer will automatically find your TPF2 installation and copy the mods</li>
            <li>Start Transport Fever 2 and enable the mods in Settings → Mods</li>
          </ol>
        </div>

        <div className="mt-8 bg-amber-900/30 border border-amber-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-amber-400 mb-2">⚠️ Important Notes</h3>
          <ul className="list-disc list-inside space-y-2 text-amber-200/80 text-sm">
            <li>These mods are created by various community authors - please support the original creators!</li>
            <li>The installer only copies mods that aren&apos;t already installed</li>
            <li>Some mods may conflict with each other - check the original mod pages for compatibility info</li>
            <li>Make sure to enable all mods before starting your OSM import</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

