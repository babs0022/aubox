import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://aubox.app'),
  title: 'Aubox | Forensic Intelligence Platform',
  description:
    'Aubox is built to lift 70% of repetitive onchain investigation workload while investigators retain full control of critical decisions and attribution.',
  icons: {
    icon: '/images/aubox-logo-dark.png',
    shortcut: '/images/aubox-logo-dark.png',
    apple: '/images/aubox-logo-dark.png',
  },
  openGraph: {
    title: 'Aubox | Forensic Intelligence Platform',
    description:
      'Built to offload repetitive investigation work, not replace investigators. Lift 70% of process overhead and speed up case outcomes with Aubox.',
    type: 'website',
    url: 'https://aubox.app',
    images: [
      {
        url: '/images/aubox-logo-dark.png',
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aubox | Forensic Intelligence Platform',
    description:
      'Built to offload repetitive investigation work, not replace investigators.',
    images: ['/images/aubox-logo-dark.png'],
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
