import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://aubox.app";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Aubox app",
  description:
    "Manual, investigator-first onchain research cockpit for tracing funds, clustering entities, and exporting evidence.",
  icons: {
    icon: [
      { url: "/aubox-logo-dark.png", type: "image/png" },
      { url: "/icon.png", type: "image/png" },
    ],
    shortcut: "/aubox-logo-dark.png",
    apple: "/aubox-logo-dark.png",
  },
  openGraph: {
    title: "Aubox app",
    description:
      "Manual, investigator-first onchain research cockpit for tracing funds, clustering entities, and exporting evidence.",
    type: "website",
    url: siteUrl,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Aubox app",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aubox app",
    description:
      "Manual, investigator-first onchain research cockpit for tracing funds, clustering entities, and exporting evidence.",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${instrumentSans.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body className="app-shell min-h-full flex flex-col">{children}</body>
    </html>
  );
}
