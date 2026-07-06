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

const ownerSteps = ['Sign up', 'Create profile', 'Share link or QR']
const visitorSteps = ['Browse directory', 'Open profile', 'Contact business']
const businessCategories = [
  'Doctors',
  'Clinics',
  'Dentists',
  'Salons',
  'Gyms',
  'Tutors',
  'Coaches',
  'Restaurants',
  'Freelancers',
  'Lawyers',
  'Photographers',
  'Consultants',
  'Real Estate Agents',
  'Electricians',
]

function LandingPage() {
  const navigate = useNavigate()

  usePageMeta({
    title: 'Smart Business Profile | Create and Discover Local Business Profiles',
    description:
      'Create a professional digital business profile or browse public businesses with contact buttons, QR codes, images, and business discovery.',
  })

  return (
    <div className="min-h-screen bg-white">
      <AppHeader />

      <main>
        <section
          aria-label="Hero"
          className="bg-gradient-to-b from-white to-slate-50 px-4 py-16 text-center sm:py-20 lg:py-24"
        >
          <div className="mx-auto max-w-3xl">
            <span className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-600 sm:mb-6 sm:text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden="true" />
              Built for business owners and visitors
            </span>

            <h1 className="mb-4 text-3xl font-bold leading-tight tracking-tight text-gray-900 sm:mb-5 sm:text-4xl md:text-5xl lg:text-6xl">
              Create your business profile. Get discovered faster.
            </h1>

            <p className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-gray-500 sm:mb-10 sm:text-lg lg:text-xl">
              Smart Business Profile helps owners publish professional digital profiles,
              while visitors can browse public businesses and contact them without signing up.
            </p>

            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-95 sm:w-auto sm:px-8 sm:py-3.5 sm:text-base"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Get Started
              </button>
              <button
                type="button"
                onClick={() => navigate('/directory')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-6 py-3 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 active:scale-95 sm:w-auto sm:px-8 sm:py-3.5 sm:text-base"
              >
                Browse Businesses
              </button>
            </div>
          </div>
        </section>

        <section className="px-4 py-16" aria-label="Audience paths">
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-600">Business Owners</p>
              <h2 className="mb-3 text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">Build a professional profile customers can trust</h2>
              <p className="mb-6 text-sm leading-relaxed text-gray-500 sm:text-base">
                Create a public business profile, manage it from your dashboard, and share it through a link or QR code.
              </p>
              <ul className="space-y-3">
                {ownerBenefits.map((benefit) => (
                  <li key={benefit} className="flex gap-3 text-sm text-gray-600">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-600">Visitors</p>
              <h2 className="mb-3 text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">Find and contact businesses quickly</h2>
              <p className="mb-6 text-sm leading-relaxed text-gray-500 sm:text-base">
                Browse public business profiles, search the directory, and contact businesses without creating an account.
              </p>
              <ul className="space-y-3">
                {visitorBenefits.map((benefit) => (
                  <li key={benefit} className="flex gap-3 text-sm text-gray-600">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
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

        <section className="bg-slate-50 px-4 py-16" aria-label="How it works">
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 text-center">
              <h2 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl md:text-3xl">How It Works</h2>
              <p className="mt-2 text-sm text-gray-500">Two simple paths, depending on what you need today.</p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h3 className="mb-5 text-base font-semibold text-gray-900">For business owners</h3>
                <div className="space-y-4">
                  {ownerSteps.map((step, index) => (
                    <div key={step} className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                        {index + 1}
                      </span>
                      <p className="text-sm font-medium text-gray-700">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h3 className="mb-5 text-base font-semibold text-gray-900">For visitors</h3>
                <div className="space-y-4">
                  {visitorSteps.map((step, index) => (
                    <div key={step} className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
                        {index + 1}
                      </span>
                      <p className="text-sm font-medium text-gray-700">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-16" aria-label="Who it is for">
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 text-center">
              <h2 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl md:text-3xl">
                Built for local businesses of every type
              </h2>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">
                From professionals to local service providers, Smart Business Profile gives businesses a simple public profile visitors can find and contact.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-2.5">
              {businessCategories.map((category) => (
                <span
                  key={category}
                  className="inline-flex rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm sm:px-4 sm:py-2 sm:text-sm"
                >
                  {category}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="px-4 py-16" aria-label="Features">
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 text-center">
              <h2 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl md:text-3xl">Everything needed for a clear business presence</h2>
              <p className="mt-2 text-sm text-gray-500">
                Built for owners who manage profiles and visitors who need quick business information.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-sm"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    {feature.icon}
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{feature.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-950 px-4 py-16 text-center" aria-label="Final call to action">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
              Ready to create your business profile?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Build a professional profile, share your link, and help customers contact you faster.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate('/create-profile')}
                className="inline-flex w-full items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition-all hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-950 active:scale-95 sm:w-auto sm:px-8 sm:py-3.5 sm:text-base"
              >
                Get Started
              </button>
              <button
                type="button"
                onClick={() => navigate('/directory')}
                className="inline-flex w-full items-center justify-center rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-white transition-all hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-950 active:scale-95 sm:w-auto sm:px-8 sm:py-3.5 sm:text-base"
              >
                Browse Businesses
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default LandingPage
