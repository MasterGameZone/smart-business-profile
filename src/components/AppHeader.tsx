import { useEffect, useRef, useState, type CSSProperties } from 'react'
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

interface HomeMenuItem {
  label: string
  path?: string
  disabled?: boolean
}

let hasPlayedNavbarEntrance = false

function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isLoading } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isHomeMenuOpen, setIsHomeMenuOpen] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [shouldAnimateEntrance] = useState(() => !hasPlayedNavbarEntrance)
  const homeMenuRef = useRef<HTMLDivElement | null>(null)
  const isLandingPage = location.pathname === '/'
  const isDirectoryPage = location.pathname === '/directory'
  const isAuthEntryPage = location.pathname === '/login' || location.pathname === '/signup'
  const isSimpleDarkNavbarPage = isAuthEntryPage || isDirectoryPage
  const isDarkLandingNavbar = isLandingPage || isSimpleDarkNavbarPage
  const hideAuthenticatedNavButtons = Boolean(user) && isLandingPage
  const showLoggedInHomeIcons = Boolean(user) && isLandingPage
  const navbarInteractionStyle: CSSProperties = {
    WebkitTapHighlightColor: 'transparent',
  }

  useEffect(() => {
    if (shouldAnimateEntrance) {
      hasPlayedNavbarEntrance = true
    }
  }, [shouldAnimateEntrance])

  useEffect(() => {
    if (!showLoggedInHomeIcons || !isHomeMenuOpen) {
      return undefined
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!homeMenuRef.current?.contains(event.target as Node)) {
        setIsHomeMenuOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsHomeMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isHomeMenuOpen, showLoggedInHomeIcons])

  useEffect(() => {
    setIsHomeMenuOpen(false)
  }, [location.pathname, location.hash])

  const showError = (message: string) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type: 'error' }])
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 4000)
  }

  const navItems: NavItem[] = isSimpleDarkNavbarPage
    ? [{ label: 'Home', path: '/' }]
    : user
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
      const sectionId = item.path.replace('#', '')
      navigate({ pathname: '/', hash: item.path })
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    navigate(item.path)
  }

  const homeMenuItems: HomeMenuItem[] = [
    { label: 'Account Settings', disabled: true },
    { label: 'Favorites / Saved Businesses', disabled: true },
    { label: 'My Reviews', disabled: true },
    { label: 'Notifications', disabled: true },
    { label: 'Switch to Business Owner', path: '/dashboard' },
    { label: 'Help & Support', disabled: true },
  ]

  const handleHomeMenuItemClick = (item: HomeMenuItem) => {
    if (item.disabled || !item.path) {
      setIsHomeMenuOpen(false)
      return
    }

    setIsHomeMenuOpen(false)
    navigate(item.path)
  }

  const navButtonClass = (item: NavItem) => {
    const isActive =
      item.type === 'scroll'
        ? location.pathname === '/' && location.hash === item.path
        : location.pathname === item.path
    const baseClass =
      `relative inline-flex min-w-[4rem] items-center justify-center overflow-hidden rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.01em] focus:outline-none focus-visible:ring-2 sm:min-w-[4.5rem] sm:px-3.5 sm:py-1.5 sm:text-sm ${
        isDarkLandingNavbar
          ? 'focus-visible:ring-slate-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950'
          : 'focus-visible:ring-slate-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50'
      }`

    if (isDarkLandingNavbar) {
      return `${baseClass} ${
        isActive
          ? 'border-white/10 bg-white/10 text-white'
          : 'border-transparent bg-transparent text-slate-200'
      }`
    }

    return `${baseClass} ${
      isActive
        ? 'border-slate-200 bg-slate-100 text-slate-950'
        : 'border-transparent bg-transparent text-slate-700'
    }`
  }

  return (
    <header className="sticky top-0 z-30 w-full px-3 pt-0 pb-0.5 sm:px-4 sm:pb-1">
      <ToastContainer toasts={toasts} />
      <div className={`mx-auto w-full max-w-[1440px] ${shouldAnimateEntrance ? 'animate-[navFloatIn_620ms_cubic-bezier(0.22,1,0.36,1)]' : ''}`}>
        <div
          className={`rounded-[2rem] px-3 py-1.5 backdrop-blur-xl sm:px-4 sm:py-2 md:px-5 ${
            isDarkLandingNavbar
              ? 'border border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0.76),rgba(15,23,42,0.58))] shadow-[0_18px_36px_-28px_rgba(2,6,23,0.75)]'
              : 'border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] shadow-[0_22px_48px_-30px_rgba(15,23,42,0.34),0_14px_24px_-24px_rgba(15,23,42,0.22)]'
          }`}
        >
          <div
            className={`flex items-center justify-between gap-2 sm:gap-3 ${
              (isLandingPage || isSimpleDarkNavbarPage) && !user ? 'flex-nowrap' : 'flex-wrap'
            }`}
          >
            <button
              type="button"
              onClick={handleBrandClick}
              className={`inline-flex shrink-0 items-center gap-2 text-xs font-semibold tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2 sm:text-sm ${
                isDarkLandingNavbar
                  ? 'text-slate-100 focus-visible:ring-offset-slate-950'
                  : 'text-slate-900 focus-visible:ring-offset-slate-50'
              }`}
              aria-label="Go to Smart Business Profile home"
              style={navbarInteractionStyle}
            >
              <span
                className={`relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border text-[10px] font-bold text-white sm:h-9 sm:w-9 sm:text-[11px] ${
                  isDarkLandingNavbar
                    ? 'border-sky-400/20 bg-[linear-gradient(145deg,#020617_0%,#0f172a_58%,#0b1120_100%)] shadow-[0_14px_30px_-20px_rgba(14,165,233,0.4)]'
                    : 'border-transparent bg-[linear-gradient(145deg,#020617_0%,#0f172a_65%,#111827_100%)] shadow-[0_14px_30px_-18px_rgba(15,23,42,0.72)]'
                }`}
              >
                <span
                  className={`pointer-events-none absolute inset-x-2 top-1 h-3 rounded-full blur-sm ${
                    isDarkLandingNavbar ? 'bg-sky-300/20' : 'bg-white/20'
                  }`}
                  aria-hidden="true"
                />
                <span className="relative z-10">SB</span>
              </span>
              {!isLandingPage && !isSimpleDarkNavbarPage && 'Smart Business Profile'}
            </button>

            {!isLoading && !hideAuthenticatedNavButtons && (
              <nav
                className={`flex items-center ${
                  (isLandingPage || isSimpleDarkNavbarPage) && !user
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
                    className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 sm:px-3.5 sm:py-1.5 sm:text-sm ${
                      isDarkLandingNavbar
                        ? 'border-white/12 bg-white/5 text-slate-200 focus-visible:ring-slate-300 focus-visible:ring-offset-slate-950'
                        : 'border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] text-slate-700 shadow-[0_12px_26px_-22px_rgba(15,23,42,0.38)] focus-visible:ring-slate-300 focus-visible:ring-offset-slate-50'
                    }`}
                    style={navbarInteractionStyle}
                  >
                    {isSigningOut ? 'Logging out...' : 'Log Out'}
                  </button>
                )}
              </nav>
            )}

            {!isLoading && showLoggedInHomeIcons && (
              <div ref={homeMenuRef} className="relative ml-auto flex items-center gap-2" aria-label="Home quick actions">
                <button
                  type="button"
                  aria-label="Notifications"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/5 text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  style={navbarInteractionStyle}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4.5 w-4.5"
                  >
                    <path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
                    <path d="M10 20a2 2 0 0 0 4 0" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="Open account menu"
                  aria-expanded={isHomeMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => setIsHomeMenuOpen((open) => !open)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/5 text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  style={navbarInteractionStyle}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4.5 w-4.5"
                  >
                    <path d="M4 7h16" />
                    <path d="M4 12h16" />
                    <path d="M4 17h16" />
                  </svg>
                </button>

                {isHomeMenuOpen && (
                  <div
                    role="menu"
                    aria-label="Account menu"
                    className="absolute right-0 top-full z-40 mt-2 w-[18.5rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_48px_-28px_rgba(15,23,42,0.45)]"
                  >
                    <div className="border-b border-slate-100 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">Menu</p>
                    </div>
                    <div className="py-2">
                      {homeMenuItems.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          role="menuitem"
                          disabled={item.disabled}
                          onClick={() => handleHomeMenuItemClick(item)}
                          className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm ${
                            item.disabled
                              ? 'cursor-default text-slate-400'
                              : 'text-slate-700 hover:bg-slate-50 focus:bg-slate-50'
                          } focus:outline-none`}
                        >
                          <span className="whitespace-nowrap">{item.label}</span>
                          {item.disabled && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                              Coming soon
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-slate-100 p-2">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={async () => {
                          setIsHomeMenuOpen(false)
                          await handleLogout()
                        }}
                        disabled={isSigningOut}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 focus:bg-rose-50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <span>{isSigningOut ? 'Logging out...' : 'Log Out'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default AppHeader
