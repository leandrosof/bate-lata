import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import { getSettings } from "@/lib/settings";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-barlow",
  display: "swap",
});

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  let siteName = "Arena do Vôlei";
  let tagline = "Organize. Sorteie. Jogue.";
  let logoUrl = "/icon-192.png";
  try {
    const settings = await getSettings();
    siteName = settings.siteName;
    tagline = settings.tagline;
    logoUrl = settings.logoData
      ? `/api/logo?v=${settings.logoUpdatedAt?.getTime() ?? 0}`
      : settings.logoUrl || logoUrl;
  } catch {
    // mantém os padrões quando o banco ainda não está configurado
  }

  return {
    title: { default: `${siteName} · ${tagline}`, template: `%s · ${siteName}` },
    description:
      "Organize partidas de vôlei do seu grupo: presenças, sorteio automático de times, placares, histórico e ranking.",
    applicationName: siteName,
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [
        {
          url: logoUrl,
          type: logoUrl.endsWith(".svg")
            ? "image/svg+xml"
            : logoUrl.startsWith("/api/logo")
              ? "image/webp"
              : "image/png",
        },
      ],
      apple: [{ url: "/apple-icon.png", type: "image/png" }],
    },
    appleWebApp: { capable: true, title: siteName, statusBarStyle: "black-translucent" },
    openGraph: {
      title: `${siteName} · ${tagline}`,
      description: "Presenças, sorteio de times, placar e ranking do grupo em um só lugar.",
      type: "website",
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#070b14",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${barlow.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
