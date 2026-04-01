'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to cases on root
    router.replace('/cases');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--paper)]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[var(--muted)]">Loading dashboard...</p>
      </div>
    </div>
  );
}
