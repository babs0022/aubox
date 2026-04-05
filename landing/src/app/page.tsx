import Link from 'next/link';
import Image from 'next/image';

const DASHBOARD_URL = 'https://dashboard.aubox.app';

export default function Home() {
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Aubox',
    url: 'https://aubox.app',
    logo: 'https://aubox.app/images/aubox-logo-dark.png',
  };

  const valueProps = [
    {
      imagePath: '/images/module-01-collection.svg',
      title: 'You Offload Evidence Collection',
      body: 'Aubox auto-collects traces, counterparties, and exposure artifacts so you stop spending hours on repetitive evidence gathering.',
    },
    {
      imagePath: '/images/module-02-reconstruction.svg',
      title: 'You Reconstruct Flows Faster',
      body: 'You map complex cross-chain movement paths in minutes, then use your time for judgement calls and escalation decisions.',
    },
    {
      imagePath: '/images/module-03-attribution.svg',
      title: 'You Stay in Control of Attribution',
      body: 'Aubox generates entity suggestions and risk signals, but you approve what is real before anything becomes evidence.',
    },
    {
      imagePath: '/images/module-04-reporting.svg',
      title: 'You Deliver Case-Ready Output',
      body: 'You turn investigation state into clear evidence packages for compliance, legal, and incident response without manual stitching.',
    },
  ];

  const operationalPillars = [
    {
      title: 'Reduce repetitive workload',
      body: 'Aubox removes repeated tracing and evidence assembly work so you can focus on decisions and escalation quality.',
    },
    {
      title: 'Keep analyst control',
      body: 'Automation supports your workflow, but final judgement stays with you for attribution, confidence, and reporting decisions.',
    },
    {
      title: 'Ship case-ready outputs faster',
      body: 'From wallet ingestion to reporting, Aubox keeps your workflow connected so outcomes are easier to share with compliance and legal stakeholders.',
    },
  ];

  const quotes = [
    {
      body: 'Aubox removes repetitive tracing workload while you keep control over every final conclusion.',
      author: 'Security Operations',
    },
    {
      body: 'You spend more time on decisions and less on manual data wrangling, with faster investigation throughput.',
      author: 'Compliance Operations',
    },
  ];

  const faqs = [
    {
      question: 'Will Aubox replace your judgement?',
      answer:
        'No. Aubox is designed to remove repetitive operational work so you can focus on judgement, escalation, and final conclusions.',
    },
    {
      question: 'What part of the workflow does Aubox automate?',
      answer:
        'Aubox automates high-volume steps like trace collection, path reconstruction, enrichment, and evidence packaging while you remain in control of decision points.',
    },
    {
      question: 'How fast can I move from alert to case output?',
      answer:
        'You can move from hours of manual assembly to a much faster review cycle because core data and evidence artifacts are pre-structured for you.',
    },
    {
      question: 'Can Aubox outputs be used for compliance and legal workflows?',
      answer:
        'Yes. Outputs are structured so you can hand them directly to compliance, legal, and incident response stakeholders without manual reformatting.',
    },
  ];

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
            <Link href="#workflow" className="nav-link">
              Workflow
            </Link>
            <Link href="#proof" className="nav-link">
              Proof
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
            <p className="kicker">Forensic Intelligence Platform</p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
              Built to Lift 70% of Investigation Workload, Not Replace Investigators.
            </h1>
            <p className="section-copy">
              Aubox automates the repetitive 70% of onchain investigation tasks: tracing, enrichment, and evidence assembly. You stay in control of the critical 30%: reasoning, prioritization, and final attribution.
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

      <section>
        <div className="page-shell grid grid-cols-1 border-t border-[var(--line-strong)] md:grid-cols-3">
          <div className="metric-cell">
            <p className="kicker">Manual Workload Lifted</p>
            <p className="mt-3 text-4xl font-semibold">70%</p>
          </div>
          <div className="metric-cell">
            <p className="kicker">Investigator Control Retained</p>
            <p className="mt-3 text-4xl font-semibold">100%</p>
          </div>
          <div className="metric-cell">
            <p className="kicker">Time-to-Case Output</p>
            <p className="mt-3 text-4xl font-semibold">Hours</p>
          </div>
        </div>
      </section>

      <section id="workflow">
        <div className="page-shell px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <p className="kicker">Operational Workflow</p>
          <h2 className="section-title">You Automate the Busywork and Keep the Decisions.</h2>
          <p className="section-copy">
            Each module removes a manual bottleneck so you can focus on signal quality, escalation, and evidentiary confidence.
          </p>

          <div className="mt-12 flex flex-col gap-10">
            {valueProps.map((item, index) => (
              <article
                className="grid md:grid-cols-2 gap-8 md:gap-10 items-stretch border border-[var(--line-strong)] bg-[var(--panel)] p-6 md:p-8"
                key={item.title}
              >
                {/* Determine if this module is odd (text left) or even (text right) */}
                {index % 2 === 0 ? (
                  <>
                    {/* Text Left, Image Right */}
                    <div className="order-1 flex flex-col justify-center">
                      <p className="kicker">Module</p>
                      <h3 className="mt-3 text-2xl font-semibold">{item.title}</h3>
                      <p className="muted mt-4 text-sm leading-7">{item.body}</p>
                    </div>
                    <div className="order-2 relative w-full h-[320px] md:h-[360px] bg-[var(--ink)] border border-[var(--line-strong)]">
                      <Image
                        src={item.imagePath}
                        alt={item.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {/* Image Left, Text Right */}
                    <div className="order-1 relative w-full h-[320px] md:h-[360px] bg-[var(--ink)] border border-[var(--line-strong)] md:order-1">
                      <Image
                        src={item.imagePath}
                        alt={item.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="order-2 md:order-2 flex flex-col justify-center">
                      <p className="kicker">Module</p>
                      <h3 className="mt-3 text-2xl font-semibold">{item.title}</h3>
                      <p className="muted mt-4 text-sm leading-7">{item.body}</p>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="proof">
        <div className="page-shell px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <p className="kicker">Ecosystem Feedback</p>
          <h2 className="section-title">What You Can Expect After Offloading the Busywork</h2>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {quotes.map((quote) => (
              <blockquote className="quote-card" key={quote.author}>
                “{quote.body}”
                <footer className="mt-5 border-t border-[var(--line)] pt-4">
                  <p className="kicker">{quote.author}</p>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      <section id="faq">
        <div className="page-shell px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <p className="kicker">FAQ</p>
          <h2 className="section-title">Answers to Common Questions</h2>
          <p className="section-copy">
            Everything here is built around one goal: help you remove investigation busywork while keeping full control of decisions.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {faqs.map((item, index) => (
              <article
                key={item.question}
                className="border border-[var(--line-strong)] bg-[var(--panel)] p-6"
                style={{
                  borderTopWidth: '4px',
                  borderTopColor: index % 2 === 0 ? 'var(--accent-strong)' : 'var(--ink)',
                }}
              >
                <h3 className="text-lg font-semibold leading-snug">{item.question}</h3>
                <p className="muted mt-3 text-sm leading-7">{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="page-shell px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <p className="kicker">Why Choose Aubox</p>
          <h2 className="section-title">Why Choose Aubox</h2>
          <p className="section-copy">
            Built to help you move faster without sacrificing clarity, control, or evidentiary quality.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {operationalPillars.map((item) => (
              <article key={item.title} className="frame-card p-6">
                <h3 className="text-lg font-semibold leading-snug">{item.title}</h3>
                <p className="muted mt-3 text-sm leading-7">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="page-shell px-4 py-14 text-center sm:px-6 lg:px-8 lg:py-20">
          <p className="kicker">Get Started</p>
          <h2 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
            Ready to give investigators their time back?
          </h2>
          <p className="section-copy mx-auto">
            Deploy Aubox to offload repetitive investigation work while you lead the decisions that matter.
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

          <div className="grid border-t border-white/35 md:grid-cols-3">
            <div className="border-b border-white/30 px-5 py-7 md:border-b-0 md:border-r md:border-white/30">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--paper)]/75">Product</p>
              <div className="mt-5 flex flex-col gap-3 text-sm">
                <a href={DASHBOARD_URL} className="w-max border-b border-dashed border-white/50 pb-0.5 hover:text-white">Dashboard ↗</a>
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

            <div className="px-5 py-7">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--paper)]/75">Access</p>
              <div className="mt-5 flex flex-col gap-3 text-sm">
                <a href={`${DASHBOARD_URL}/request-access`} className="w-max border-b border-dashed border-white/50 pb-0.5 hover:text-white">Request Access ↗</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}




