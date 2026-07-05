import { useNavigate } from 'react-router-dom'
import AppHeader from '../components/AppHeader.tsx'
import { usePageMeta } from '../hooks/usePageMeta.ts'

const features = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2" />
      </svg>
    ),
    title: 'Digital Business Card',
    description: 'A professional profile page with your name, contact, and business details.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 3.5a.5.5 0 11-1 0 .5.5 0 011 0z" />
      </svg>
    ),
    title: 'Instant QR Code',
    description: 'Auto-generated QR code that opens your profile, ready to print or share.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
      </svg>
    ),
    title: 'Easy Sharing',
    description: 'Share your profile link instantly via WhatsApp, email, or any platform.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Mobile Friendly',
    description: 'Looks great on every device and is optimized for the way customers browse.',
  },
]

function LandingPage() {
  const navigate = useNavigate()

  usePageMeta({
    title: 'Smart Business Profile | Digital Business Cards for Local Businesses',
    description:
      'Create a professional digital business profile with contact buttons, public link, QR code, and business discovery.',
  })

  return (
    <div className="min-h-screen bg-white">
      <AppHeader />

      <section
        aria-label="Hero"
        className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-white to-slate-50 px-4 py-24 text-center"
      >
        <div className="mx-auto max-w-2xl">
          <span className="mb-6 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" aria-hidden="true" />
            Free - No sign-up required
          </span>

          <h1 className="mb-5 text-4xl font-bold leading-tight tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
            Your business, <span className="text-blue-600">professionally presented.</span>
          </h1>

          <p className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-gray-500 sm:text-xl">
            Create a shareable digital business profile in minutes. Include your contact details,
            location, and a QR code, ready to share with anyone.
          </p>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate('/create-profile')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-95 sm:w-auto"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Your Profile
            </button>
            <button
              type="button"
              onClick={() => navigate('/profile-preview')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-8 py-3.5 text-base font-medium text-gray-700 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 active:scale-95 sm:w-auto"
            >
              View Demo
            </button>
          </div>
        </div>

        <div className="mx-auto mt-20 grid w-full max-w-3xl grid-cols-1 gap-4 px-0 sm:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex items-start gap-4 rounded-2xl border border-gray-100 bg-white px-5 py-4 text-left shadow-sm"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                {feature.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{feature.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-gray-500">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default LandingPage
