import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://aubox.app'),
  title: 'Aubox | Investigation Operations Platform',
  description:
    'Aubox helps investigation teams accelerate onchain profiling, tracing, clustering, and OSINT correlation with structured evidence workflows.',
  applicationName: 'Aubox',
  icons: {
    icon: '/images/aubox-logo-dark.png',
    shortcut: '/images/aubox-logo-dark.png',
    apple: '/images/aubox-logo-dark.png',
  },
  openGraph: {
    title: 'Aubox | Investigation Operations Platform',
    description:
      'Run faster onchain investigations with structured workflows for address intelligence, fund tracing, flow reconstruction, and defensible reporting.',
    type: 'website',
    url: 'https://aubox.app',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Aubox | Investigation Operations Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aubox | Investigation Operations Platform',
    description:
      'Accelerate onchain investigations with structured, team-ready evidence workflows.',
    images: ['/opengraph-image'],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@500;600&family=Work+Sans:wght@400;500;600;700&display=swap');
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
