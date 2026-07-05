import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.tsx'
import { signOut } from '../lib/authService.ts'
import { usePageMeta } from '../hooks/usePageMeta.ts'
import { ToastContainer, type ToastItem, type ToastType } from '../components/Toast.tsx'

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
    description: 'Auto-generated QR code that opens your profile — ready to print or share.',
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
    description: 'Looks great on every device — optimized for the way customers browse.',
  },
]

function LandingPage() {
  const navigate = useNavigate()
  const { user, isLoading } = useAuth()

  usePageMeta({
    title: 'Smart Business Profile | Digital Business Cards for Local Businesses',
    description:
      'Create a professional digital business profile with contact buttons, public link, QR code, and business discovery.',
  })

  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [isSigningOut, setIsSigningOut] = useState(false)

  const showToast = (message: string, type: ToastType = 'success') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }

  const handleLogout = async () => {
    if (isSigningOut) return
    setIsSigningOut(true)
    const { error } = await signOut()
    setIsSigningOut(false)

    if (error) {
      showToast(error, 'error')
      return
    }

    showToast('You have been logged out.')
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-white">
      <ToastContainer toasts={toasts} />

      {/* ── Auth nav ── */}
      <div className="absolute top-0 right-0 px-4 py-4 z-10">
        {!isLoading && (
          user ? (
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
              <button
                type="button"
                onClick={() => navigate('/directory')}
                className="inline-flex items-center px-3 sm:px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none focus:underline transition-colors"
              >
                Directory
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center px-3 sm:px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none focus:underline transition-colors"
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center px-3 sm:px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none focus:underline transition-colors"
              >
                My Business
              </button>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isSigningOut}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white rounded-full hover:bg-gray-50 active:scale-95 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-all border border-gray-200 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSigningOut ? 'Logging out…' : 'Log Out'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
              <button
                type="button"
                onClick={() => navigate('/directory')}
                className="inline-flex items-center px-3 sm:px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none focus:underline transition-colors"
              >
                Directory
              </button>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none focus:underline transition-colors"
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => navigate('/signup')}
                className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-full hover:bg-blue-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all"
              >
                Sign Up
              </button>
            </div>
          )
        )}
      </div>

      {/* ── Hero ── */}
      <section
        aria-label="Hero"
        className="min-h-screen flex flex-col items-center justify-center px-4 py-24 text-center bg-gradient-to-b from-white to-slate-50"
      >
        <div className="max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" aria-hidden="true" />
            Free · No sign-up required
          </span>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight leading-tight mb-5">
            Your business,{' '}
            <span className="text-blue-600">professionally presented.</span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-500 leading-relaxed mb-10 max-w-xl mx-auto">
            Create a shareable digital business profile in minutes. Include your contact details,
            location, and a QR code — ready to share with anyone.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/create-profile')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 text-base font-semibold text-white bg-blue-600 rounded-full hover:bg-blue-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all shadow-lg shadow-blue-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Your Profile
            </button>
            <button
              type="button"
              onClick={() => navigate('/profile-preview')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 text-base font-medium text-gray-700 bg-white rounded-full hover:bg-gray-50 active:scale-95 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-all border border-gray-200"
            >
              View Demo
            </button>
          </div>
        </div>

        {/* ── Features ── */}
        <div className="w-full max-w-3xl mx-auto mt-20 grid grid-cols-1 sm:grid-cols-2 gap-4 px-0">
          {features.map((f) => (
            <div
              key={f.title}
              className="flex items-start gap-4 bg-white rounded-2xl px-5 py-4 border border-gray-100 shadow-sm text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                {f.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{f.title}</p>
                <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{f.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default LandingPage
