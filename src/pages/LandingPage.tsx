import { useNavigate } from 'react-router-dom'
import AppHeader from '../components/AppHeader.tsx'
import { usePageMeta } from '../hooks/usePageMeta.ts'

const features = [
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2" />
      </svg>
    ),
    title: 'Professional Profiles',
    description: 'Businesses can publish contact details, profile information, QR code, and public links in one place.',
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 3.5a.5.5 0 11-1 0 .5.5 0 011 0z" />
      </svg>
    ),
    title: 'QR and Public Link',
    description: 'Every saved profile can be shared through a public link and QR code.',
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
      </svg>
    ),
    title: 'Business Discovery',
    description: 'Visitors can browse public businesses and search by name, category, or location.',
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h2l2.5 5.5L6 13a11 11 0 005 5l2.5-1.5L19 19v2a2 2 0 01-2 2A16 16 0 011 7a2 2 0 012-2z" />
      </svg>
    ),
    title: 'Instant Contact',
    description: 'Public profiles help visitors call, WhatsApp, email, visit websites, or open maps where available.',
  },
]

const ownerBenefits = [
  'Create and manage professional business profiles',
  'Add contact buttons, services, working hours, images, and social links',
  'Share your public profile link or QR code with customers',
]

const visitorBenefits = [
  'Browse public businesses without signing up',
  'Search by business name, category, or location',
  'Open profiles and contact businesses quickly',
]

const darkCardClass =
  'rounded-3xl border border-white/10 bg-white/6 p-6 shadow-[0_28px_80px_-42px_rgba(2,12,27,0.95)] backdrop-blur-md sm:p-8'

const sectionHeadingClass = 'text-xl font-bold tracking-tight text-slate-50 sm:text-2xl md:text-3xl'

function LandingPage() {
  const navigate = useNavigate()
  const handleSectionScroll = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const footerLinks = [
    { label: 'Businesses', type: 'route' as const, value: '/directory' },
    { label: 'Features', type: 'scroll' as const, value: 'features' },
    { label: 'Pricing', type: 'hash' as const, value: '#pricing' },
    { label: 'FAQ', type: 'hash' as const, value: '#faq' },
    { label: 'Login', type: 'route' as const, value: '/login' },
    { label: 'Create Profile', type: 'route' as const, value: '/create-profile' },
    { label: 'Privacy', type: 'hash' as const, value: '#privacy' },
    { label: 'Terms', type: 'hash' as const, value: '#terms' },
  ]

  usePageMeta({
    title: 'Smart Business Profile | Create and Discover Local Business Profiles',
    description:
      'Create a professional digital business profile or browse public businesses with contact buttons, QR codes, images, and business discovery.',
  })

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_28%),linear-gradient(180deg,#020617_0%,#030712_34%,#020617_100%)] text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="landing-ambient-drift absolute inset-x-[-18%] top-[-12rem] h-[34rem] bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.18),transparent_55%)] blur-3xl" />
        <div
          className="landing-ambient-drift absolute right-[-20%] top-[18rem] h-[28rem] w-[48rem] bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.14),transparent_58%)] blur-3xl"
          style={{ animationDelay: '-7s' }}
        />
        <div className="landing-streak-float absolute left-[-12%] top-28 h-40 w-[124%] rotate-[-8deg] bg-[linear-gradient(90deg,transparent,rgba(125,211,252,0.08),rgba(59,130,246,0.14),transparent)] blur-3xl" />
        <div
          className="landing-streak-float absolute left-[-10%] top-[34rem] h-48 w-[120%] rotate-[6deg] bg-[linear-gradient(90deg,transparent,rgba(14,165,233,0.05),rgba(96,165,250,0.12),transparent)] blur-[90px]"
          style={{ animationDelay: '-11s' }}
        />
      </div>
      <AppHeader />

      <main className="relative">
        <section
          aria-label="Hero"
          className="relative px-4 py-16 text-center sm:py-20 lg:py-24"
        >
          <div className="mx-auto max-w-4xl">
            <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-sky-400/20 bg-white/8 px-3 py-1 text-[11px] font-semibold text-sky-200 backdrop-blur sm:mb-6 sm:text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-300" aria-hidden="true" />
              Built for business owners and visitors
            </span>

            <h1 className="mb-4 text-3xl font-bold leading-tight tracking-tight text-slate-50 sm:mb-5 sm:text-4xl md:text-5xl lg:text-6xl">
              Create your business profile.{' '}
              <span className="bg-[linear-gradient(90deg,#e2f3ff_0%,#7dd3fc_35%,#60a5fa_70%,#c4b5fd_100%)] bg-clip-text text-transparent">
                Get discovered faster.
              </span>
            </h1>

            <p className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-slate-300 sm:mb-10 sm:text-lg lg:text-xl">
              Smart Business Profile helps owners publish professional digital profiles,
              while visitors can browse public businesses and contact them without signing up.
            </p>

            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-sky-400/30 bg-[linear-gradient(135deg,#2563eb_0%,#0284c7_55%,#0f172a_100%)] px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_-18px_rgba(37,99,235,0.55)] focus:outline-none focus:ring-2 focus:ring-sky-300/80 focus:ring-offset-2 focus:ring-offset-slate-950 sm:w-auto sm:px-8 sm:py-3.5 sm:text-base"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Get Started
              </button>
              <button
                type="button"
                onClick={() => navigate('/directory')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/14 bg-white/6 px-6 py-3 text-sm font-medium text-slate-100 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-950 sm:w-auto sm:px-8 sm:py-3.5 sm:text-base"
              >
                Browse Businesses
              </button>
            </div>
          </div>
        </section>

        <section className="relative px-4 py-16" aria-label="Audience paths">
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 md:grid-cols-2">
            <div className={darkCardClass}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-sky-300">Business Owners</p>
              <h2 className="mb-3 text-xl font-bold tracking-tight text-slate-50 sm:text-2xl">Build a professional profile customers can trust</h2>
              <p className="mb-6 text-sm leading-relaxed text-slate-300 sm:text-base">
                Create a public business profile, manage it from your dashboard, and share it through a link or QR code.
              </p>
              <ul className="space-y-3">
                {ownerBenefits.map((benefit) => (
                  <li key={benefit} className="flex gap-3 text-sm text-slate-300">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-400/12 text-sky-300">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>

            <div className={darkCardClass}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-cyan-300">Visitors</p>
              <h2 className="mb-3 text-xl font-bold tracking-tight text-slate-50 sm:text-2xl">Find and contact businesses quickly</h2>
              <p className="mb-6 text-sm leading-relaxed text-slate-300 sm:text-base">
                Browse public business profiles, search the directory, and contact businesses without creating an account.
              </p>
              <ul className="space-y-3">
                {visitorBenefits.map((benefit) => (
                  <li key={benefit} className="flex gap-3 text-sm text-slate-300">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-400/12 text-cyan-300">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="relative px-4 py-16" aria-label="Who it is for">
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 text-center">
              <h2 className={sectionHeadingClass}>
                Built for local businesses of every type
              </h2>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                From professionals to local service providers, Smart Business Profile gives businesses a simple public profile visitors can find and contact.
              </p>
            </div>

            <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-[320px_minmax(0,1fr)] md:items-stretch md:gap-5">
              <div className="mx-auto flex aspect-square w-full max-w-[19rem] items-center justify-center rounded-3xl border border-white/10 bg-white/5 px-6 py-6 text-center shadow-[0_14px_30px_-24px_rgba(2,12,27,0.95)] backdrop-blur-sm sm:max-w-[20rem] sm:px-8 md:mx-0 md:h-full md:max-w-none md:aspect-auto">
                <div className="space-y-1 text-sm font-medium leading-relaxed text-slate-400 sm:text-base">
                  <p>Business type preview</p>
                  <p>Animation coming soon</p>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-6 shadow-[0_14px_30px_-24px_rgba(2,12,27,0.95)] backdrop-blur-sm sm:px-8">
                <div className="space-y-4 text-sm leading-relaxed text-slate-300 sm:text-base md:text-left">
                  <p>
                    No matter what kind of local business you run, Smart Business Profile gives you{' '}
                    <span className="font-medium text-slate-100">one clean public page</span> to
                    present the <span className="font-medium text-slate-100">details customers look for first</span> -
                    your contact options, services, location, working hours, business story,
                    gallery, and social links.
                  </p>
                  <p>
                    It helps visitors understand what you offer, trust your presence, and{' '}
                    <span className="font-medium text-slate-100">contact you instantly</span>{' '}
                    through call, WhatsApp, email, website, or maps without needing to install any
                    app.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="relative px-4 py-16" aria-label="Features">
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 text-center">
              <h2 className={sectionHeadingClass}>Everything needed for a clear business presence</h2>
              <p className="mt-2 text-sm text-slate-400">
                Built for owners who manage profiles and visitors who need quick business information.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-3xl border border-white/10 bg-white/6 p-5 text-left shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] backdrop-blur-md"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-400/12 text-sky-300 ring-1 ring-sky-300/15">
                    {feature.icon}
                  </div>
                  <p className="text-sm font-semibold text-slate-50">{feature.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative px-4 py-12 text-center sm:py-14" aria-label="Final call to action">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
              Ready to create your business profile?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Create a professional public profile, share it with a link or QR code, and help visitors contact you faster.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate('/create-profile')}
                className="inline-flex w-full items-center justify-center rounded-full border border-sky-400/30 bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_55%,#0f172a_100%)] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_32px_-20px_rgba(56,189,248,0.42)] focus:outline-none focus:ring-2 focus:ring-sky-300/80 focus:ring-offset-2 focus:ring-offset-slate-950 sm:w-auto sm:min-w-[11rem] sm:px-7 sm:text-base"
              >
                Get Started
              </button>
              <button
                type="button"
                onClick={() => navigate('/directory')}
                className="inline-flex w-full items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-6 py-3 text-sm font-medium text-slate-100 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-950 sm:w-auto sm:min-w-[11rem] sm:px-7 sm:text-base"
              >
                Browse Businesses
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-white/8 px-4 py-8 sm:py-10" aria-label="Footer">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-6 text-center md:flex-row md:items-start md:justify-between md:gap-10 md:text-left">
            <div className="max-w-md">
              <p className="text-sm font-semibold text-slate-100">Smart Business Profile</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                Create a modern public business profile with a shareable link, QR code, and instant contact options.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-slate-400 sm:gap-x-5 md:max-w-xl md:justify-end">
            {footerLinks.map((link) =>
              link.type === 'route' ? (
                <button
                  key={link.label}
                  type="button"
                  onClick={() => navigate(link.value)}
                  className="focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  {link.label}
                </button>
              ) : link.type === 'scroll' ? (
                <button
                  key={link.label}
                  type="button"
                  onClick={() => handleSectionScroll(link.value)}
                  className="focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  {link.label}
                </button>
              ) : (
                <a
                  key={link.label}
                  href={link.value}
                  className="focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  {link.label}
                </a>
              )
            )}
          </div>

          </div>

          <p className="mt-6 text-center text-xs text-slate-500 md:mt-7 md:text-left">
            © 2026 Smart Business Profile. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
