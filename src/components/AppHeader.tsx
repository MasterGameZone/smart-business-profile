import { useEffect, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.tsx'
import { signOut } from '../lib/authService.ts'
import { ToastContainer, type ToastItem } from './Toast.tsx'

interface NavItem {
  label: string
  path: string
  emphasis?: boolean
  type?: 'route' | 'scroll'
}

let hasPlayedNavbarEntrance = false

function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isLoading } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [shouldAnimateEntrance] = useState(() => !hasPlayedNavbarEntrance)
  const isLandingPage = location.pathname === '/'
  const navbarInteractionStyle: CSSProperties = {
    WebkitTapHighlightColor: 'transparent',
  }

  useEffect(() => {
    if (shouldAnimateEntrance) {
      hasPlayedNavbarEntrance = true
    }
  }, [shouldAnimateEntrance])

  const showError = (message: string) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type: 'error' }])
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 4000)
  }

  const navItems: NavItem[] = user
    ? [
        { label: 'Home', path: '/' },
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Directory', path: '/directory' },
        { label: 'Create Business', path: '/create-profile', emphasis: true },
      ]
    : isLandingPage
      ? [
          { label: 'Businesses', path: '/directory' },
          { label: 'Features', path: '#features', type: 'scroll' },
          { label: 'Login', path: '/login', emphasis: true },
        ]
      : [
          { label: 'Home', path: '/' },
          { label: 'Directory', path: '/directory' },
          { label: 'Login', path: '/login' },
          { label: 'Get Started', path: '/signup', emphasis: true },
        ]

  const handleLogout = async () => {
    if (isSigningOut) return

    setIsSigningOut(true)
    const { error } = await signOut()
    setIsSigningOut(false)

    if (error) {
      showError(error)
      return
    }

    navigate('/')
  }

  const handleBrandClick = () => {
    navigate(user ? '/dashboard' : '/')
  }

  const handleNavItemClick = (item: NavItem) => {
    if (item.type === 'scroll') {
      document.getElementById('features')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    navigate(item.path)
  }

  const navButtonClass = (item: NavItem) => {
    const isCta = item.emphasis
    const baseClass =
      'relative inline-flex min-w-[4.5rem] items-center justify-center overflow-hidden rounded-full border px-3 py-2 text-xs font-semibold tracking-[0.01em] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 sm:min-w-[5rem] sm:px-4 sm:py-2.5 sm:text-sm'

    if (isCta) {
      return `${baseClass} border-slate-900/80 bg-[linear-gradient(135deg,#020617_0%,#0f172a_34%,#111827_62%,#020617_100%)] text-white shadow-[0_16px_34px_-20px_rgba(15,23,42,0.8)] focus-visible:ring-slate-400`
    }

    return `${baseClass} border-transparent bg-transparent text-slate-700`
  }

  return (
    <header className="sticky top-0 z-30 w-full px-3 pt-0 pb-2 sm:px-4 sm:pb-3">
      <ToastContainer toasts={toasts} />
      <div className={`mx-auto w-full max-w-[1440px] ${shouldAnimateEntrance ? 'animate-[navFloatIn_620ms_cubic-bezier(0.22,1,0.36,1)]' : ''}`}>
        <div className="rounded-b-[2rem] rounded-t-none border border-slate-200/80 border-t-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] px-3 py-3 shadow-[0_22px_48px_-30px_rgba(15,23,42,0.34),0_14px_24px_-24px_rgba(15,23,42,0.22)] backdrop-blur-xl sm:rounded-[2rem] sm:border-t sm:px-4 sm:py-3.5 md:px-5">
          <div
            className={`flex items-center justify-between gap-2 sm:gap-3 ${
              isLandingPage && !user ? 'flex-nowrap' : 'flex-wrap'
            }`}
          >
            <button
              type="button"
              onClick={handleBrandClick}
              className="inline-flex shrink-0 items-center gap-2 text-xs font-semibold tracking-tight text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 sm:text-sm"
              aria-label="Go to Smart Business Profile home"
              style={navbarInteractionStyle}
            >
              <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(145deg,#020617_0%,#0f172a_65%,#111827_100%)] text-[11px] font-bold text-white shadow-[0_14px_30px_-18px_rgba(15,23,42,0.72)] sm:h-11 sm:w-11 sm:text-xs">
                <span className="pointer-events-none absolute inset-x-2 top-1 h-3 rounded-full bg-white/20 blur-sm" aria-hidden="true" />
                <span className="relative z-10">SB</span>
              </span>
              {!(isLandingPage && !user) && 'Smart Business Profile'}
            </button>

            {!isLoading && (
              <nav
                className={`flex items-center ${
                  isLandingPage && !user
                    ? 'ml-auto shrink-0 flex-nowrap gap-1 sm:gap-2'
                    : 'w-full flex-wrap justify-end gap-2 pt-2 sm:w-auto sm:pt-0'
                }`}
                aria-label="Primary navigation"
              >
                {navItems.map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => handleNavItemClick(item)}
                    className={navButtonClass(item)}
                    style={navbarInteractionStyle}
                  >
                    <span className="relative z-10">{item.label}</span>
                  </button>
                ))}
                {user && (
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={isSigningOut}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] px-3 py-2 text-xs font-medium text-slate-700 shadow-[0_12px_26px_-22px_rgba(15,23,42,0.38)] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 disabled:cursor-not-allowed disabled:opacity-70 sm:px-4 sm:py-2.5 sm:text-sm"
                    style={navbarInteractionStyle}
                  >
                    {isSigningOut ? 'Logging out...' : 'Log Out'}
                  </button>
                )}
              </nav>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default AppHeader
