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
  try {
    const settings = await getSettings();
    siteName = settings.siteName;
    tagline = settings.tagline;
  } catch {
    // mantém os padrões quando o banco ainda não está configurado
  }

  return {
    title: { default: `${siteName} · ${tagline}`, template: `%s · ${siteName}` },
    description:
      "Presença, times, placar e ranking do vôlei do grupo.",
    applicationName: siteName,
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [
        { url: "/api/icon/32", sizes: "32x32", type: "image/png" },
        { url: "/api/icon/192", sizes: "192x192", type: "image/png" },
      ],
      apple: [{ url: "/api/icon/180", sizes: "180x180", type: "image/png" }],
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
  themeColor: "#f3f6fb",
  colorScheme: "light dark",
};

const themeScript = `(function(){try{var theme=localStorage.getItem("arena-theme");document.documentElement.dataset.theme=theme==="dark"?"dark":"light";}catch(e){document.documentElement.dataset.theme="light";}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      data-theme="light"
      suppressHydrationWarning
      className={`${inter.variable} ${barlow.variable} antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
