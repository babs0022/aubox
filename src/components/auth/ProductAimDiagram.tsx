type ProductAimDiagramProps = {
  className?: string;
};

export default function ProductAimDiagram({ className = "" }: ProductAimDiagramProps) {
  return (
    <div className={`mx-auto w-full max-w-[320px] rounded-2xl border border-[var(--line)] bg-white/90 p-4 shadow-[0_14px_32px_rgba(0,0,0,0.08)] ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Investigation Flow</p>

      <svg viewBox="0 0 320 170" className="mt-3 w-full" role="img" aria-label="Wallet to bridge to cluster investigation flow">
        <defs>
          <linearGradient id="flowLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0a6e5d" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#01493d" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        <line x1="52" y1="70" x2="145" y2="70" stroke="url(#flowLine)" strokeWidth="2.5" />
        <line x1="175" y1="70" x2="268" y2="70" stroke="url(#flowLine)" strokeWidth="2.5" />
        <line x1="160" y1="84" x2="160" y2="128" stroke="#0a6e5d" strokeOpacity="0.7" strokeWidth="2" strokeDasharray="5 4" />

        <circle cx="40" cy="70" r="16" fill="#f2eee5" stroke="#0a6e5d" strokeWidth="2" />
        <text x="40" y="74" fontSize="10" textAnchor="middle" fill="#01493d">W1</text>

        <rect x="142" y="52" width="36" height="36" rx="8" fill="#0a6e5d" />
        <text x="160" y="74" fontSize="10" textAnchor="middle" fill="#ffffff">BR</text>

        <circle cx="280" cy="70" r="16" fill="#f2eee5" stroke="#0a6e5d" strokeWidth="2" />
        <text x="280" y="74" fontSize="10" textAnchor="middle" fill="#01493d">W2</text>

        <rect x="24" y="128" width="70" height="26" rx="13" fill="#ffffff" stroke="#d8d2c8" />
        <text x="59" y="145" fontSize="10" textAnchor="middle" fill="#574f46">Profile</text>

        <rect x="124" y="128" width="72" height="26" rx="13" fill="#ffffff" stroke="#d8d2c8" />
        <text x="160" y="145" fontSize="10" textAnchor="middle" fill="#574f46">Cluster</text>

        <rect x="226" y="128" width="70" height="26" rx="13" fill="#ffffff" stroke="#d8d2c8" />
        <text x="261" y="145" fontSize="10" textAnchor="middle" fill="#574f46">Report</text>
      </svg>

      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-[var(--muted)]">
        <span className="rounded-full bg-[var(--paper)] px-2 py-1 text-center">wallet trace</span>
        <span className="rounded-full bg-[var(--paper)] px-2 py-1 text-center">bridge hint</span>
        <span className="rounded-full bg-[var(--paper)] px-2 py-1 text-center">case output</span>
      </div>
    </div>
  );
}
