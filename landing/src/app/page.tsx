import Link from 'next/link';
import Image from 'next/image';

const DASHBOARD_URL = 'https://dashboard.aubox.app';

type UseCase = {
  title: string;
  body: string;
  stat: string;
  variant: 'address' | 'trace' | 'flow' | 'cluster' | 'token' | 'osint';
};

type SceneDetail = {
  label: string;
  points: [string, string, string];
};

export default function Home() {
    const sceneDetails: Record<UseCase['variant'], SceneDetail> = {
      address: {
        label: 'Address Query',
        points: ['Wallet Profile', 'Counterparties', 'Risk Context'],
      },
      trace: {
        label: 'Funds Trace',
        points: ['Cross-Chain Hops', 'Priority Paths', 'Escalation Links'],
      },
      flow: {
        label: 'Flow Analysis',
        points: ['Deep Patterns', 'Timeline View', 'Evidence Steps'],
      },
      cluster: {
        label: 'Address Cluster',
        points: ['Entity Grouping', 'Behavior Links', 'Shared Signals'],
      },
      token: {
        label: 'Token Movement',
        points: ['Transfer Patterns', 'Concentration Shifts', 'Exposure Signals'],
      },
      osint: {
        label: 'OSINT Correlation',
        points: ['Onchain Data', 'Offchain Intel', 'Attribution Context'],
      },
    };

  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Aubox',
    url: 'https://aubox.app',
    logo: 'https://aubox.app/images/aubox-logo-dark.png',
  };

  const useCases: Array<UseCase> = [
    {
      title: 'Address Intelligence',
      body: 'Query any address profile with contextual wallet behavior, counterparties, and linked investigative clues in one workflow.',
      stat: 'Profile in seconds',
      variant: 'address',
    },
    {
      title: 'Rapid Fund Tracing',
      body: 'Trace funds in seconds across hops and chains to quickly identify key movement paths and escalation points.',
      stat: 'Fast path mapping',
      variant: 'trace',
    },
    {
      title: 'Flow Reconstruction',
      body: 'Run deeper analysis on fund flows and reconstruct case timelines with clear evidence progression.',
      stat: 'Timeline-first view',
      variant: 'flow',
    },
    {
      title: 'Entity Clustering',
      body: 'Cluster related addresses into coherent entities so teams can reason about behavior, not isolated wallets.',
      stat: 'Relationship graphs',
      variant: 'cluster',
    },
    {
      title: 'Token Movement Analysis',
      body: 'Analyze token movement patterns, concentration shifts, and transfer behavior for sharper risk and exposure decisions.',
      stat: 'Token-level signals',
      variant: 'token',
    },
    {
      title: 'Onchain + OSINT Correlation',
      body: 'Combine onchain evidence with OSINT and offchain context to support stronger attribution and reporting confidence.',
      stat: 'Cross-source context',
      variant: 'osint',
    },
  ];

  const builtForProfiles = [
    {
      title: 'Investigation teams',
      body: 'Teams tracing wallet activity, counterparties, and movement paths across multiple chains.',
    },
    {
      title: 'Compliance and AML operations',
      body: 'Analysts who need defensible case files, reviewable evidence, and clear escalation history.',
    },
    {
      title: 'Private investigators',
      body: 'Independent or boutique investigators producing client-ready forensic outputs and timelines.',
    },
    {
      title: 'Security and incident response',
      body: 'Teams handling exploit drains, suspicious flow monitoring, and post-incident analysis.',
    },
  ];

  const whyCare = [
    {
      title: 'Increase case throughput',
      body: 'Move investigations from fragmented manual steps into one continuous workflow that shortens time-to-output.',
    },
    {
      title: 'Improve decision quality',
      body: 'Teams keep control of judgement while gaining cleaner, faster context for escalation and attribution decisions.',
    },
    {
      title: 'Deliver defensible evidence',
      body: 'Generate structured artifacts and case narratives that are easier to share across compliance, legal, and leadership.',
    },
  ];

  const faqs = [
    {
      question: 'Will Aubox replace your judgement?',
      answer:
        'No. Aubox is designed to support investigator workflows while keeping final judgement and attribution decisions with your team.',
    },
    {
      question: 'How does Aubox create value for investigation teams?',
      answer:
        'Aubox reduces repetitive workflow overhead across profiling, tracing, enrichment, and reporting so teams can focus on high-value decisions and escalation quality.',
    },
    {
      question: 'Can Aubox support private investigators and client-facing reporting?',
      answer:
        'Yes. Aubox helps investigators organize findings into structured, shareable outputs for client updates, legal review, or incident stakeholders.',
    },
    {
      question: 'How are use cases priced?',
      answer:
        'Pricing combines investigation case capacity, unified storage, and feature usage credits. This lets teams scale based on actual operational workload.',
    },
    {
      question: 'Can Aubox outputs be used in compliance and legal workflows?',
      answer:
        'Yes. The platform is built for structured evidence workflows, making it easier to share case artifacts with compliance, legal, and incident response functions.',
    },
    {
      question: 'How quickly can teams start using Aubox?',
      answer:
        'Teams can begin with guided onboarding and start running real investigations quickly, then expand capacity through pricing tiers as workflows scale.',
    },
  ];

  const renderUseCaseScene = (variant: UseCase['variant']) => {
    const detail = sceneDetails[variant];

    return (
      <div className={`usecase-panel panel-${variant}`} aria-hidden="true">
        <div className="panel-dots" />
        <div className="panel-ring" />
        <div className="panel-node panel-node-a" />
        <div className="panel-node panel-node-b" />
        <div className="panel-node panel-node-c" />
        <div className="panel-node panel-node-d" />
        <div className="panel-node panel-node-e" />
        <div className="panel-node panel-node-f" />
        <div className="panel-hub-wrap">
          <span className="panel-hub">{detail.label}</span>
        </div>
        <ul className="panel-list">
          {detail.points.map((point) => (
            <li key={point} className="panel-item">
              {point}
            </li>
          ))}
        </ul>
      </div>
    );
  };


  return (
    <main className="min-h-screen bg-[var(--paper)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <header className="sticky top-0 z-30 border-b border-[var(--line-strong)] bg-[var(--panel)]/95 backdrop-blur">
        <div className="page-shell flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/images/aubox-logo-dark.png"
              alt="Aubox logo"
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
              priority
            />
            <span className="kicker text-[var(--ink)]">Aubox</span>
          </Link>
          <nav className="hidden items-center md:flex">
            <Link href="#overview" className="nav-link">
              Overview
            </Link>
            <Link href="#use-cases" className="nav-link">
              Use Cases
            </Link>
            <Link href="#built-for" className="nav-link">
              Built For
            </Link>
            <Link href="#why-care" className="nav-link">
              Why It Matters
            </Link>
            <Link href="/pricing" className="nav-link">
              Pricing
            </Link>
            <Link href="#faq" className="nav-link">
              FAQ
            </Link>
            <a href={`${DASHBOARD_URL}/guide`} className="nav-link">
              Guide
            </a>
          </nav>

          <a href={`${DASHBOARD_URL}/request-access`} className="button-secondary px-4 py-3">
            Request Access
          </a>
        </div>
      </header>

      <section className="reveal-up" id="overview">
        <div className="page-shell grid gap-10 px-4 py-14 sm:px-6 md:grid-cols-12 lg:px-8 lg:py-20">
          <div className="md:col-span-7">
            <p className="kicker">Investigation Operations Platform</p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
              Accelerate onchain investigations with stronger evidence workflows.
            </h1>
            <p className="section-copy">
              Aubox helps teams run faster profiling, tracing, clustering, token analysis, and OSINT-supported investigations without sacrificing analyst-controlled decisions.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={`${DASHBOARD_URL}/request-access`} className="button-primary">
                Request Access <span className="arrow">↗</span>
              </a>
              <a href={`${DASHBOARD_URL}/guide`} className="button-secondary">
                See Product Guide <span className="arrow">↗</span>
              </a>
            </div>
          </div>

          <div className="md:col-span-5 flex flex-col">
            <div className="relative w-full aspect-[2/3] md:aspect-square lg:aspect-[4/3]">
              <Image
                src="/images/workload-shift-model-transparent.png"
                alt="Workload Shift Model"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      <section id="use-cases">
        <div className="page-shell px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <p className="kicker">Use Cases</p>
          <h2 className="section-title">Core investigation workflows</h2>
          <p className="section-copy">
            Move from fragmented steps to a single operational flow across the workflows that matter most to investigation teams.
          </p>

          <div className="mt-12 flex flex-col gap-20 md:gap-24">
            {useCases.map((useCase, index) => (
              <article
                key={useCase.title}
                className="grid items-start gap-10 py-4 md:gap-20 md:py-8 md:grid-cols-[minmax(0,1fr)_minmax(500px,1.15fr)]"
              >
                <div className={`${index % 2 === 1 ? 'md:order-2' : ''}`}>
                  <p className="kicker">{useCase.stat}</p>
                  <h3 className="mt-4 text-2xl font-semibold leading-snug md:text-3xl">{useCase.title}</h3>
                  <p className="muted mt-6 max-w-xl text-base leading-8">{useCase.body}</p>
                </div>
                <div className={`${index % 2 === 1 ? 'md:order-1' : ''}`}>
                  {renderUseCaseScene(useCase.variant)}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="built-for">
        <div className="page-shell px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <p className="kicker">Built For</p>
          <h2 className="section-title">Teams with high-stakes investigation workflows</h2>
          <p className="section-copy">
            Aubox supports operational teams that need fast outputs, clear evidence paths, and controlled decision quality.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {builtForProfiles.map((profile) => (
              <article key={profile.title} className="frame-card p-6">
                <h3 className="text-lg font-semibold leading-snug">{profile.title}</h3>
                <p className="muted mt-3 text-sm leading-7">{profile.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="why-care">
        <div className="page-shell px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <p className="kicker">Why Should You Care</p>
          <h2 className="section-title">Clear operational impact for your investigation team</h2>
          <p className="section-copy">
            Aubox is built to improve speed, consistency, and evidence quality where investigation teams need it most.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {whyCare.map((item) => (
              <article key={item.title} className="frame-card p-6">
                <h3 className="text-lg font-semibold leading-snug">{item.title}</h3>
                <p className="muted mt-3 text-sm leading-7">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="faq">
        <div className="page-shell px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <p className="kicker">Detailed FAQ</p>
          <h2 className="section-title">Answers for teams evaluating Aubox</h2>
          <p className="section-copy">
            Practical answers to common operational, workflow, and pricing questions from investigation teams.
          </p>

          <div className="mt-10 flex flex-col gap-3">
            {faqs.map((item, index) => (
              <details
                key={item.question}
                className="faq-item border border-[var(--line-strong)] bg-[var(--panel)]"
                style={{
                  borderTopWidth: '4px',
                  borderTopColor: index % 2 === 0 ? 'var(--accent-strong)' : 'var(--ink)',
                }}
              >
                <summary className="faq-summary flex cursor-pointer list-none items-start justify-between gap-3 px-5 py-4 text-left">
                  <span className="text-lg font-semibold leading-snug">{item.question}</span>
                  <span aria-hidden="true" className="faq-indicator mt-1 text-lg leading-none">+</span>
                </summary>
                <div className="px-5 pb-5">
                  <p className="muted text-sm leading-7">{item.answer}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="page-shell px-4 py-14 text-center sm:px-6 lg:px-8 lg:py-20">
          <p className="kicker">Get Started</p>
          <h2 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
            Ready to modernize your investigation operations?
          </h2>
          <p className="section-copy mx-auto">
            Bring your team into Aubox to accelerate case throughput while keeping investigators in control of final decisions.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href={`${DASHBOARD_URL}/request-access`} className="button-primary">
              Request Access <span className="arrow">↗</span>
            </a>
            <a href={`${DASHBOARD_URL}/guide`} className="button-secondary">
              See Product Guide <span className="arrow">↗</span>
            </a>
          </div>
        </div>
      </section>

      <footer className="border-y border-[var(--line-strong)] bg-[var(--accent)] text-[var(--paper)]">
        <div className="page-shell">
          <div className="h-10 border-b border-white/35 bg-[linear-gradient(90deg,transparent_0%,transparent_6%,#f5f2eb_6%,#f5f2eb_8%,transparent_8%,transparent_14%,#f5f2eb_14%,#f5f2eb_16%,transparent_16%,transparent_23%,#f5f2eb_23%,#f5f2eb_25%,transparent_25%,transparent_31%,#f5f2eb_31%,#f5f2eb_33%,transparent_33%,transparent_41%,#f5f2eb_41%,#f5f2eb_43%,transparent_43%,transparent_52%,#f5f2eb_52%,#f5f2eb_54%,transparent_54%,transparent_63%,#f5f2eb_63%,#f5f2eb_65%,transparent_65%,transparent_74%,#f5f2eb_74%,#f5f2eb_76%,transparent_76%,transparent_84%,#f5f2eb_84%,#f5f2eb_86%,transparent_86%,transparent_100%)]" />

          <div className="px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-20">
            <div className="flex items-center justify-center gap-4">
              <Image
                src="/images/aubox-logo-dark.png"
                alt="Aubox"
                width={92}
                height={92}
                className="h-20 w-20 rounded-sm bg-[var(--paper)] p-1 object-contain sm:h-24 sm:w-24"
              />
              <p className="text-7xl font-semibold tracking-tight sm:text-8xl lg:text-9xl">aubox</p>
            </div>
            <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-[var(--paper)]/75">
              You investigate. Aubox handles the repetitive workload.
            </p>
            <p className="mt-6 text-xs text-[var(--paper)]/65">© 2026 Aubox. All rights reserved.</p>
          </div>

          <div className="grid border-t border-white/35 md:grid-cols-4">
            <div className="border-b border-white/30 px-5 py-7 md:border-b-0 md:border-r md:border-white/30">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--paper)]/75">Product</p>
              <div className="mt-5 flex flex-col gap-3 text-sm">
                <a href={DASHBOARD_URL} className="w-max border-b border-dashed border-white/50 pb-0.5 hover:text-white">Dashboard ↗</a>
                <a href="/pricing" className="w-max border-b border-dashed border-white/50 pb-0.5 hover:text-white">Pricing ↗</a>
              </div>
            </div>

            <div className="border-b border-white/30 px-5 py-7 md:border-b-0 md:border-r md:border-white/30">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--paper)]/75">Support & Resources</p>
              <div className="mt-5 flex flex-col gap-3 text-sm">
                <a href="mailto:support@aubox.app" className="w-max border-b border-dashed border-white/50 pb-0.5 hover:text-white">support@aubox.app ↗</a>
                <a href={`${DASHBOARD_URL}/guide`} className="w-max border-b border-dashed border-white/50 pb-0.5 hover:text-white">Guide ↗</a>
                <a href="#faq" className="w-max border-b border-dashed border-white/50 pb-0.5 hover:text-white">FAQ ↗</a>
              </div>
            </div>

            <div className="border-b border-white/30 px-5 py-7 md:border-b-0 md:border-r md:border-white/30">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--paper)]/75">Access</p>
              <div className="mt-5 flex flex-col gap-3 text-sm">
                <a href={`${DASHBOARD_URL}/request-access`} className="w-max border-b border-dashed border-white/50 pb-0.5 hover:text-white">Request Access ↗</a>
              </div>
            </div>

            <div className="px-5 py-7">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--paper)]/75">Connect</p>
              <div className="mt-5 flex items-center gap-3 text-sm">
                <a
                  href="https://x.com/auboxapp"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Aubox on X"
                  className="inline-flex h-9 w-9 items-center justify-center border border-white/45 text-[var(--paper)]/90 transition hover:border-white hover:text-white"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                    <path d="M18.244 2H21.5l-7.12 8.135L22.75 22h-6.555l-5.132-6.693L5.21 22H1.95l7.618-8.707L1.5 2h6.722l4.636 6.121L18.244 2Zm-1.145 18.02h1.803L7.245 3.874H5.308L17.1 20.02Z" />
                  </svg>
                </a>
                <a
                  href="https://github.com/auboxapp"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Aubox on GitHub"
                  className="inline-flex h-9 w-9 items-center justify-center border border-white/45 text-[var(--paper)]/90 transition hover:border-white hover:text-white"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                    <path d="M12 2C6.475 2 2 6.589 2 12.25c0 4.528 2.865 8.37 6.839 9.727.5.095.683-.22.683-.49 0-.24-.009-.875-.014-1.717-2.782.617-3.37-1.376-3.37-1.376-.455-1.183-1.11-1.498-1.11-1.498-.908-.636.069-.623.069-.623 1.004.073 1.532 1.054 1.532 1.054.892 1.57 2.341 1.116 2.91.853.091-.664.35-1.116.636-1.372-2.22-.259-4.555-1.14-4.555-5.071 0-1.12.389-2.036 1.026-2.754-.103-.26-.445-1.306.098-2.722 0 0 .837-.275 2.743 1.051A9.335 9.335 0 0 1 12 6.839c.852.004 1.712.118 2.515.347 1.905-1.326 2.741-1.051 2.741-1.051.544 1.416.202 2.462.1 2.722.639.718 1.025 1.634 1.025 2.754 0 3.941-2.338 4.809-4.566 5.063.359.317.679.943.679 1.9 0 1.372-.012 2.478-.012 2.815 0 .272.18.589.688.489C19.14 20.616 22 16.775 22 12.25 22 6.589 17.523 2 12 2Z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}




