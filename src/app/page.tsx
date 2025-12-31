import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Map, Download, Train, TreePine, Building, ArrowRight, Github } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative py-20 px-4 gradient-hero overflow-hidden">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <Map className="h-4 w-4" />
                OpenStreetMap → Transport Fever 2
              </div>
              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                Import Real-World Cities into{" "}
                <span className="text-primary">TPF2</span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-lg">
                Transform OpenStreetMap data into Transport Fever 2 format.
                Import railways, streets, forests, and more to build your dream
                reconstruction project.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button size="lg" asChild>
                  <Link href="/convert">
                    Start Converting
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/gallery">Browse Gallery</Link>
                </Button>
              </div>
            </div>
            
            {/* Feature illustration */}
            <div className="relative hidden lg:block">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-3xl blur-3xl" />
              <div className="relative bg-card border border-border rounded-2xl p-6 shadow-2xl">
                <div className="aspect-video rounded-lg bg-gradient-to-br from-primary/20 via-secondary/10 to-accent/20 flex items-center justify-center overflow-hidden relative">
                  {/* Decorative grid pattern */}
                  <div className="absolute inset-0 opacity-20">
                    <div className="grid grid-cols-8 grid-rows-5 h-full w-full gap-px">
                      {[...Array(40)].map((_, i) => (
                        <div key={i} className="bg-foreground/10 rounded-sm" />
                      ))}
                    </div>
                  </div>
                  {/* Content overlay */}
                  <div className="relative flex flex-col items-center justify-center text-center p-6">
                    <div className="flex items-center gap-4 mb-3">
                      <div className="h-16 w-16 rounded-xl bg-blue-500/20 flex items-center justify-center">
                        <Map className="h-8 w-8 text-blue-500" />
                      </div>
                      <ArrowRight className="h-6 w-6 text-muted-foreground" />
                      <div className="h-16 w-16 rounded-xl bg-green-500/20 flex items-center justify-center">
                        <Train className="h-8 w-8 text-green-500" />
                      </div>
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      OpenStreetMap → Transport Fever 2
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-primary">24.5km</p>
                    <p className="text-xs text-muted-foreground">Max Map Size</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-secondary">9</p>
                    <p className="text-xs text-muted-foreground">Rail Types</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-accent">20+</p>
                    <p className="text-xs text-muted-foreground">Street Types</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold mb-4">
              What Gets Imported
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              The OSM-TPF2 Importer extracts and converts a wide variety of map
              data from OpenStreetMap into game-ready formats.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={Train}
              title="Railways"
              description="Standard rails, trams, subways, light rail, narrow gauge, and more. Including signals, switches, and catenary."
            />
            <FeatureCard
              icon={Building}
              title="Streets & Roads"
              description="Motorways to footpaths. Lane counts, surface types, sidewalks, and one-way information preserved."
            />
            <FeatureCard
              icon={TreePine}
              title="Vegetation"
              description="Forests, shrubs, and single trees. Leaf types are detected for accurate representation."
            />
            <FeatureCard
              icon={Map}
              title="Land Use"
              description="Ground surfaces like fields, pavement, residential areas, and more for realistic terrain."
            />
            <FeatureCard
              icon={Download}
              title="Bridges & Tunnels"
              description="Bridge and tunnel tags are preserved, allowing proper elevation handling in-game."
            />
            <FeatureCard
              icon={Building}
              title="Town Labels"
              description="City, town, and neighborhood names imported as TPF2 fake town labels."
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold mb-4">
              How It Works
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Step
              number={1}
              title="Select Your Area"
              description="Search for a city or draw a rectangle on the map to define your import area."
            />
            <Step
              number={2}
              title="Configure Options"
              description="Choose which data types to include: railways, streets, forests, and more."
            />
            <Step
              number={3}
              title="Download & Import"
              description="Get the Lua file and use it with the OSM-TPF2 mod to build in-game."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="font-display text-3xl font-bold mb-4">
            Ready to Rebuild Your City?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join the community of Transport Fever 2 players recreating real-world
            locations. Sign in to start converting your own maps.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/auth/signin">Sign In to Convert</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a
                href="https://github.com/Vacuum-Tube/OSM-TPF2-Importer"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="h-4 w-4 mr-2" />
                View on GitHub
              </a>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Card className="card-hover">
      <CardHeader>
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription>{description}</CardDescription>
      </CardContent>
    </Card>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">
        {number}
      </div>
      <h3 className="font-display text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

