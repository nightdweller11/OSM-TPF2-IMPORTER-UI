import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Toaster } from "@/components/ui/toaster";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "OSM-TPF2 Importer | Import OpenStreetMap to Transport Fever 2",
  description:
    "Convert OpenStreetMap data to Transport Fever 2 format. Import real-world cities, railways, and streets into your TPF2 maps.",
  keywords: [
    "Transport Fever 2",
    "TPF2",
    "OpenStreetMap",
    "OSM",
    "map importer",
    "railway",
    "simulation",
  ],
  authors: [{ name: "OSM-TPF2 Community" }],
  openGraph: {
    title: "OSM-TPF2 Importer",
    description: "Import real-world cities into Transport Fever 2",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} font-sans antialiased min-h-screen`}
      >
        <div className="flex min-h-screen flex-col">
          <Header />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-border py-6 mt-auto">
            <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
              <p>
                OSM-TPF2 Importer • Data © OpenStreetMap contributors •{" "}
                <a
                  href="https://github.com/Vacuum-Tube/OSM-TPF2-Importer"
                  className="underline hover:text-foreground"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub
                </a>
              </p>
            </div>
          </footer>
        </div>
        <Toaster />
      </body>
    </html>
  );
}

