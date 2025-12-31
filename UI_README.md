# OSM-TPF2 Importer Web UI

A modern web interface for converting OpenStreetMap data to Transport Fever 2 format.

## Features

- 🗺️ **Interactive Map Selection** - Click on a Leaflet map to select your area
- 🔍 **City Search** - Search for any location using OpenStreetMap Nominatim
- ⚙️ **Configurable Imports** - Choose which data types to include (railways, streets, forests, etc.)
- 📊 **Progress Tracking** - Real-time conversion progress updates
- 🎨 **Gallery** - Browse and download pre-converted city maps
- 📥 **Filtered Downloads** - Download with custom data type filtering
- 🔐 **Optional OAuth** - Works without configuration for local development

## Quick Start (Zero Configuration)

The app works out of the box with **SQLite** and **dev mode authentication** - no database or OAuth setup required!

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and you're ready to go!

**In dev mode:**
- Uses embedded SQLite database (stored in `storage/local.db`)
- No OAuth configuration needed - use "Dev Sign In" with any username
- All features work locally without external services

## Tech Stack

- **Frontend**: Next.js 15, React 18, Tailwind CSS
- **Database**: SQLite (dev) / PostgreSQL (production) via Drizzle ORM
- **Auth**: NextAuth.js v5 with optional OAuth
- **Map**: Leaflet with react-leaflet
- **Python Integration**: Node.js child_process for running the converter

## Database Configuration

### SQLite (Default - No Setup Required)

If no `DATABASE_URL` environment variable is set, the app automatically uses SQLite:
- Database file: `storage/local.db`
- Tables are auto-created on first run
- Perfect for local development and single-user setups

### PostgreSQL (Production)

For production or multi-user setups, configure PostgreSQL:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/osm_tpf2?schema=public"
```

Then run migrations:
```bash
npm run db:push
```

## Authentication Configuration

### Dev Mode (Default - No Setup Required)

If no OAuth credentials are configured, the app enables "Dev Mode":
- Simple username-based login (no password required)
- Creates local user accounts automatically
- Perfect for local testing

### OAuth Providers (Production)

For production, configure one or both OAuth providers:

```env
# GitHub OAuth
AUTH_GITHUB_ID="your-github-client-id"
AUTH_GITHUB_SECRET="your-github-client-secret"

# Google OAuth  
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"

# Required for production
AUTH_SECRET="generate-with: openssl rand -base64 32"
```

#### GitHub OAuth Setup
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set callback URL to: `http://localhost:3000/api/auth/callback/github`

#### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Set redirect URI to: `http://localhost:3000/api/auth/callback/google`

## Full Environment Variables

Create a `.env` file (optional for local development):

```env
# Database (optional - defaults to SQLite)
DATABASE_URL="postgresql://..."

# Auth Secret (optional for dev, required for production)
AUTH_SECRET="your-secret-here"

# OAuth (optional - enables OAuth login when configured)
AUTH_GITHUB_ID=""
AUTH_GITHUB_SECRET=""
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""

# Python Configuration
PYTHON_PATH="python3"
PYTHON_SCRIPT_DIR="./python"

# Storage
OUTPUT_DIR="./storage/outputs"
```

## Python Setup

Make sure Python dependencies are installed:

```bash
cd python
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

## Project Structure

```
├── drizzle.config.ts          # Drizzle ORM configuration
├── src/
│   ├── app/
│   │   ├── api/               # API routes
│   │   ├── auth/              # Auth pages
│   │   ├── convert/           # Conversion wizard
│   │   ├── gallery/           # Gallery pages
│   │   └── page.tsx           # Home page
│   ├── components/
│   │   ├── convert/           # Conversion UI
│   │   ├── layout/            # Layout components
│   │   ├── map/               # Map components
│   │   └── ui/                # Reusable UI
│   └── lib/
│       ├── auth.ts            # NextAuth config
│       ├── db/                # Drizzle ORM
│       │   ├── index.ts       # Database connection
│       │   └── schema.ts      # Unified schema
│       ├── osm-fetcher.ts     # Overpass API
│       ├── python-runner.ts   # Python subprocess
│       └── lua-filter.ts      # Download filtering
├── storage/                   # SQLite DB & generated files
└── python/                    # Python converter
```

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/conversions` | GET | No | List public conversions |
| `/api/conversions` | POST | Yes | Create new conversion |
| `/api/conversions/[id]` | GET | No | Get conversion details |
| `/api/conversions/[id]/download` | GET | No | Download with filters |
| `/api/search` | GET | No | Geocode location search |

## Heightmap Data

**Note:** OSM data does NOT include heightmap/elevation data. For heightmaps, use:
- https://heightmap.skydark.pl/
- https://terraining.ateliernonta.com/
- SRTM/ASTER satellite data

## Building for Production

```bash
npm run build
npm start
```

For production deployments:
- Configure PostgreSQL for better performance
- Set up OAuth providers
- Use a reverse proxy (nginx/Caddy) with SSL
- Set `AUTH_SECRET` environment variable

## License

Same as the main OSM-TPF2-Importer project.
