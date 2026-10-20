import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { CustomCursor } from "@/components/navigation/CustomCursor";
import { LenisProvider } from "@/components/shared/LenisProvider";
import { PageTransitionProvider } from "@/components/shared/PageTransition";
import { site } from "@/data/site";
import { ThemeProvider } from "@/components/experience/ThemeProvider";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

// Editorial headlines (Instrument Serif), clean body (Geist), technical labels (Geist Mono).
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export const metadata: Metadata = {
  title: `${site.name} ${site.family} — ${site.descriptors}`,
  description: site.intro,
  metadataBase: new URL(`https://${site.domain}`),
  openGraph: {
    title: `${site.fullName} — BUILD / CREATE`,
    description: site.intro,
    url: `https://${site.domain}`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${serif.variable} ${mono.variable}`}>
      <body className="bg-ink font-sans text-paper">
        <ThemeProvider><LenisProvider>
          <PageTransitionProvider>{children}</PageTransitionProvider>
          <CustomCursor />
        </LenisProvider></ThemeProvider>
      </body>
    </html>
  );
}
