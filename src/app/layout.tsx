import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
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
