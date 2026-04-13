import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';

const DASHBOARD_URL = 'https://dashboard.aubox.app';

export const metadata: Metadata = {
  title: 'Pricing | Aubox Investigation Operations Platform',
  description:
    'Explore Aubox pricing for investigation teams, including plan capacity for seats, active cases, storage, and monthly feature credits.',
};

type Plan = {
  name: string;
  price: string;
  cadence: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  highlighted?: boolean;
  limits: Array<string>;
  benefits: Array<string>;
};

const plans: Array<Plan> = [
  {
    name: 'Free',
    price: '$0',
    cadence: '/month',
    description: 'Very limited access for trying Aubox workflows before purchasing.',
    ctaLabel: 'Get Free Access',
    ctaHref: `${DASHBOARD_URL}/request-access`,
    limits: ['1 seat', '2 active cases', '250 MB unified storage', '200 credits/month'],
    benefits: ['Evaluate the product with real data', 'No payment setup required', 'Simple path to upgrade once active'],
  },
  {
    name: 'Starter',
    price: '$149',
    cadence: '/month',
    description: 'For solo investigators validating workflow ROI.',
    ctaLabel: 'Start with Starter',
    ctaHref: `${DASHBOARD_URL}/request-access`,
    limits: ['1 seat', '15 active cases', '5 GB unified storage', '1,500 credits/month'],
    benefits: ['Fast time-to-value for individuals', 'Predictable spend', 'Enough throughput for weekly investigations'],
  },
  {
    name: 'Team',
    price: '$499',
    cadence: '/month',
    description: 'For collaborative compliance and security teams.',
    ctaLabel: 'Choose Team',
    ctaHref: `${DASHBOARD_URL}/request-access`,
    highlighted: true,
    limits: ['5 seats', '75 active cases', '50 GB unified storage', '10,000 credits/month'],
    benefits: ['Built-in collaboration capacity', 'Lower per-investigator unit cost', 'Operationally ready for daily case volume'],
  },
  {
    name: 'Business',
    price: '$1,499',
    cadence: '/month',
    description: 'For high-throughput investigation operations.',
    ctaLabel: 'Choose Business',
    ctaHref: `${DASHBOARD_URL}/request-access`,
    limits: ['15 seats', '300 active cases', '250 GB unified storage', '40,000 credits/month'],
    benefits: ['Scales to heavy monthly workloads', 'Priority support', 'Improved economics at volume'],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    cadence: '',
    description: 'For regulated organizations with governance and SLA requirements.',
    ctaLabel: 'Talk to Sales',
    ctaHref: 'mailto:founders@aubox.app?subject=Aubox%20Enterprise%20Pricing',
    limits: ['Custom seats, cases, storage, and credits', 'SSO/SAML', 'Audit logs and advanced permissions', 'SLA + dedicated onboarding'],
    benefits: ['Compliance-ready controls', 'Custom terms and procurement support', 'Dedicated deployment and success support'],
  },
];

type ComparisonRow = {
  feature: string;
  free: string;
  starter: string;
  team: string;
  business: string;
  enterprise: string;
};

const comparisonRows: Array<ComparisonRow> = [
  {
    feature: 'Monthly price',
    free: '$0',
    starter: '$149',
    team: '$499',
    business: '$1,499',
    enterprise: 'Custom',
  },
  {
    feature: 'Seats included',
    free: '1',
    starter: '1',
    team: '5',
    business: '15',
    enterprise: 'Custom',
  },
  {
    feature: 'Active investigation cases',
    free: '2',
    starter: '15',
    team: '75',
    business: '300',
    enterprise: 'Custom',
  },
  {
    feature: 'Unified case storage',
    free: '250 MB',
    starter: '5 GB',
    team: '50 GB',
    business: '250 GB',
    enterprise: 'Custom',
  },
  {
    feature: 'Tool usage credits / month',
    free: '200',
    starter: '1,500',
    team: '10,000',
    business: '40,000',
    enterprise: 'Custom',
  },
  {
    feature: 'Case artifact exports',
    free: 'Up to 10/month',
    starter: 'Up to 100/month',
    team: 'Up to 1,000/month',
    business: 'Unlimited',
    enterprise: 'Unlimited',
  },
  {
    feature: 'Data retention',
    free: '30 days',
    starter: '90 days',
    team: '180 days',
    business: '365 days',
    enterprise: 'Custom retention policy',
  },
  {
    feature: 'Role-based access controls',
    free: 'Basic',
    starter: 'Basic',
    team: 'Standard',
    business: 'Advanced',
    enterprise: 'Advanced + custom roles',
  },
  {
    feature: 'Audit logging',
    free: 'No',
    starter: 'No',
    team: 'Basic',
    business: 'Full',
    enterprise: 'Full + export APIs',
  },
  {
    feature: 'Support SLA',
    free: 'Community',
    starter: 'Email (48h)',
    team: 'Priority email (24h)',
    business: 'Priority (8h)',
    enterprise: 'Contracted SLA',
  },
  {
    feature: 'SSO / SAML',
    free: 'No',
    starter: 'No',
    team: 'No',
    business: 'Optional add-on',
    enterprise: 'Included',
  },
];

const pricingFaqs = [
  {
    question: 'How do I choose the right Aubox plan?',
    answer:
      'Choose based on active case volume, number of investigators, and expected monthly feature usage credits. Starter works for solo workflows, Team for daily collaboration, and Business for high-throughput operations.',
  },
  {
    question: 'What happens if we exceed our monthly credits?',
    answer:
      'You can purchase additional credits in blocks as overage, so investigations continue without interruption while keeping spend predictable.',
  },
  {
    question: 'Can we upgrade or downgrade plans later?',
    answer:
      'Yes. Teams can move between tiers as operational workload changes. Plan changes are applied to align seats, case limits, storage, and credits with your current needs.',
  },
  {
    question: 'Are annual contracts available?',
    answer:
      'Yes. Annual terms are available for Team, Business, and Enterprise customers. Contact sales to discuss billing preferences and contract options.',
  },
  {
    question: 'Is onboarding included in paid plans?',
    answer:
      'Paid plans include guided onboarding resources. Business and Enterprise tiers include deeper onboarding support for operational rollout and team adoption.',
  },
  {
    question: 'Do you offer custom pricing for regulated organizations?',
    answer:
      'Yes. Enterprise pricing supports custom capacity, governance controls, and contracted support requirements for regulated and high-compliance teams.',
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[var(--paper)]">
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
            <Link href="/#overview" className="nav-link">
              Overview
            </Link>
            <Link href="/#workflow" className="nav-link">
              Workflow
            </Link>
            <Link href="/#proof" className="nav-link">
              Proof
            </Link>
            <Link href="/#faq" className="nav-link">
              FAQ
            </Link>
          </nav>

          <a href={`${DASHBOARD_URL}/request-access`} className="button-secondary px-4 py-3">
            Request Access
          </a>
        </div>
      </header>

      <section>
        <div className="page-shell px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <p className="kicker">Pricing</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">Choose your Aubox plan</h1>
          <p className="section-copy max-w-3xl">
            Pricing is tied directly to investigation throughput: active cases, unified storage, and monthly credits for feature usage.
            Start with a very limited free tier, then upgrade as your team and workload grow.
          </p>
        </div>
      </section>

      <section>
        <div className="page-shell px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`border p-6 ${plan.highlighted ? 'border-[var(--accent-strong)] bg-[#eef4f1]' : 'border-[var(--line-strong)] bg-[var(--panel)]'}`}
              >
                <p className={`kicker ${plan.highlighted ? 'text-[var(--accent)]' : ''}`}>{plan.highlighted ? 'Most selected' : 'Plan'}</p>
                <h2 className="mt-3 text-2xl font-semibold">{plan.name}</h2>
                <p className="mt-3 flex items-end gap-1 text-[var(--ink)]">
                  <span className="text-4xl font-semibold leading-none">{plan.price}</span>
                  {plan.cadence ? <span className="pb-1 text-sm text-[var(--muted)]">{plan.cadence}</span> : null}
                </p>
                <p className="muted mt-4 min-h-[56px] text-sm leading-7">{plan.description}</p>

                <div className="mt-5 border-t border-[var(--line)] pt-4">
                  <p className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--accent-strong)]">Limits</p>
                  <ul className="mt-3 space-y-2 text-sm">
                    {plan.limits.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="pt-[2px] text-[var(--accent-strong)]">+</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-5 border-t border-[var(--line)] pt-4">
                  <p className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--accent-strong)]">Benefits</p>
                  <ul className="mt-3 space-y-2 text-sm">
                    {plan.benefits.map((benefit) => (
                      <li key={benefit} className="muted leading-6">
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>

                <a
                  href={plan.ctaHref}
                  className={`mt-6 inline-flex w-full items-center justify-between border px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] ${plan.highlighted ? 'border-[var(--accent-strong)] bg-[var(--accent)] text-[var(--paper)] hover:bg-[var(--accent-strong)]' : 'border-[var(--line-strong)] text-[var(--ink)] hover:bg-[#ebe7de]'}`}
                >
                  <span>{plan.ctaLabel}</span>
                  <span aria-hidden="true">↗</span>
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="page-shell px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <p className="kicker">Detailed comparison</p>
          <h2 className="section-title">Compare every plan in one view</h2>
          <p className="section-copy">Use this matrix to pick the right level of capacity, governance, and support for your organization.</p>

          <div className="mt-8 overflow-x-auto border border-[var(--line-strong)] bg-[var(--panel)]">
            <table className="min-w-[980px] w-full border-collapse text-left text-sm">
              <thead className="bg-[#ebe7de]">
                <tr>
                  <th className="border-b border-r border-[var(--line)] px-4 py-3 font-mono text-xs uppercase tracking-[0.12em] text-[var(--accent-strong)]">Feature</th>
                  <th className="border-b border-r border-[var(--line)] px-4 py-3">Free</th>
                  <th className="border-b border-r border-[var(--line)] px-4 py-3">Starter</th>
                  <th className="border-b border-r border-[var(--line)] px-4 py-3">Team</th>
                  <th className="border-b border-r border-[var(--line)] px-4 py-3">Business</th>
                  <th className="border-b border-[var(--line)] px-4 py-3">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, index) => (
                  <tr key={row.feature} className={index % 2 === 0 ? 'bg-[var(--panel)]' : 'bg-[#f3efe6]'}>
                    <td className="border-r border-t border-[var(--line)] px-4 py-3 font-medium text-[var(--ink)]">{row.feature}</td>
                    <td className="border-r border-t border-[var(--line)] px-4 py-3 text-[var(--muted)]">{row.free}</td>
                    <td className="border-r border-t border-[var(--line)] px-4 py-3 text-[var(--muted)]">{row.starter}</td>
                    <td className="border-r border-t border-[var(--line)] px-4 py-3 text-[var(--muted)]">{row.team}</td>
                    <td className="border-r border-t border-[var(--line)] px-4 py-3 text-[var(--muted)]">{row.business}</td>
                    <td className="border-t border-[var(--line)] px-4 py-3 text-[var(--muted)]">{row.enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="border border-[var(--line-strong)] bg-[var(--panel)] p-5 text-sm leading-7 text-[var(--muted)]">
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--accent-strong)]">Overage and add-ons</p>
              <p className="mt-3">Extra storage: $0.25 per GB/month.</p>
              <p>Extra credits: $25 per 1,000 credits.</p>
              <p>Additional seats: Team $79/seat/month, Business $69/seat/month.</p>
            </div>
            <div className="border border-[var(--line-strong)] bg-[var(--panel)] p-5 text-sm leading-7 text-[var(--muted)]">
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--accent-strong)]">Free tier policy</p>
              <p className="mt-3">The free tier is intentionally constrained for evaluation only.</p>
              <p>It is not designed for sustained production investigations or team operations.</p>
              <p>Upgrade to Starter or Team once your active case volume grows.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing-faq">
        <div className="page-shell px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <p className="kicker">Pricing FAQ</p>
          <h2 className="section-title">Common pricing and plan questions</h2>
          <p className="section-copy">
            Quick answers to help your team evaluate limits, upgrades, billing, and enterprise options.
          </p>

          <div className="mt-10 flex flex-col gap-3">
            {pricingFaqs.map((item, index) => (
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

      <footer className="border-y border-[var(--line-strong)] bg-[var(--accent)] text-[var(--paper)]">
        <div className="page-shell">
          <div className="h-10 border-b border-white/35 bg-[linear-gradient(90deg,transparent_0%,transparent_6%,#f5f2eb_6%,#f5f2eb_8%,transparent_8%,transparent_14%,#f5f2eb_14%,#f5f2eb_16%,transparent_16%,transparent_23%,#f5f2eb_23%,#f5f2eb_25%,transparent_25%,transparent_31%,#f5f2eb_31%,#f5f2eb_33%,transparent_33%,transparent_41%,#f5f2eb_41%,#f5f2eb_43%,transparent_43%,transparent_52%,#f5f2eb_52%,#f5f2eb_54%,transparent_54%,transparent_63%,#f5f2eb_63%,#f5f2eb_65%,transparent_65%,transparent_74%,#f5f2eb_74%,#f5f2eb_76%,transparent_76%,transparent_84%,#f5f2eb_84%,#f5f2eb_86%,transparent_86%,transparent_100%)]" />
          <div className="px-4 py-12 sm:px-6 lg:px-8 lg:py-14">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--paper)]/80">Aubox Pricing</p>
              <div className="flex flex-wrap gap-3 text-sm">
                <a href={`${DASHBOARD_URL}/request-access`} className="border-b border-dashed border-white/50 pb-0.5 hover:text-white">Request Access ↗</a>
                <Link href="/" className="border-b border-dashed border-white/50 pb-0.5 hover:text-white">Back to Home ↗</Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
