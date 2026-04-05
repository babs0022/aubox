"use client";

import { useState } from "react";

export default function MobileAlert() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  return (
    <div className="mb-4 block border-l-4 border-amber-500 bg-amber-50 p-4 md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="font-semibold text-amber-900">📱 Mobile view detected</p>
          <p className="mt-1 text-sm text-amber-800">
            This app is optimized for desktop and larger screens. For the best experience, please switch to a desktop or tablet device.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-amber-600 hover:text-amber-800"
          aria-label="Dismiss alert"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
