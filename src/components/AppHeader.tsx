import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useProfile } from '../context/ProfileContext.tsx'
import { useAuth } from '../context/AuthContext.tsx'
import { signOut } from '../lib/authService.ts'
import { ToastContainer, type ToastItem } from './Toast.tsx'

interface AppHeaderPreviewConfig {
  backPath: string
  backLabel: string
}

interface AppHeaderProps {
  previewConfig?: AppHeaderPreviewConfig | null
  variant?: 'default' | 'publicBusinessProfile'
}

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
  onSelect?: () => void | Promise<void>
}

let hasPlayedNavbarEntrance = false

function AppHeader({ previewConfig = null, variant = 'default' }: AppHeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isLoading, accountMode, isBusinessOwnerEnabled, setPreferredAccountMode } = useAuth()
  const { clearProfile } = useProfile()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isHomeMenuOpen, setIsHomeMenuOpen] = useState(false)
  const [isLandingMobileMenuOpen, setIsLandingMobileMenuOpen] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [shouldAnimateEntrance] = useState(() => !hasPlayedNavbarEntrance)
  const homeMenuRef = useRef<HTMLDivElement | null>(null)
  const landingMobileMenuRef = useRef<HTMLDivElement | null>(null)
  const isLandingPage = location.pathname === '/'
  const isStartBusinessPage = location.pathname === '/start-business'
  const isBusinessHomePage = location.pathname === '/business-home'
  const isCreateProfilePage = location.pathname === '/create-profile'
  const isProfilePreviewPage = location.pathname === '/profile-preview'
  const isDirectoryPage = location.pathname === '/directory'
  const isAuthEntryPage = location.pathname === '/login' || location.pathname === '/signup'
  const isPublicBusinessProfileVariant = variant === 'publicBusinessProfile'
  const isSimpleDarkNavbarPage = isAuthEntryPage || isDirectoryPage || isPublicBusinessProfileVariant
  const showCreateProfileTopBar = Boolean(user) && isCreateProfilePage
  const showProfilePreviewTopBar = isProfilePreviewPage
  const showMinimalCustomerTopBar = Boolean(user) && (isLandingPage || isStartBusinessPage)
  const showStartBusinessLogoOnly = Boolean(user) && isStartBusinessPage
  const showBusinessHomeTopBar = Boolean(user) && isBusinessHomePage
  const isDarkLandingNavbar =
    isLandingPage ||
    isStartBusinessPage ||
    isBusinessHomePage ||
    isCreateProfilePage ||
    isProfilePreviewPage ||
    isSimpleDarkNavbarPage
  const showPreviewHeader = Boolean(previewConfig) && !isPublicBusinessProfileVariant
  const useDarkHeaderStyle = isDarkLandingNavbar || showPreviewHeader
  const hideAuthenticatedNavButtons =
    showMinimalCustomerTopBar ||
    showBusinessHomeTopBar ||
    showCreateProfileTopBar ||
    showProfilePreviewTopBar ||
    isPublicBusinessProfileVariant
  const showLoggedInHomeIcons = showMinimalCustomerTopBar && !showStartBusinessLogoOnly
  const hasTopBarMenu = showLoggedInHomeIcons || showBusinessHomeTopBar
  const authenticatedHomePath = isCreateProfilePage && accountMode === 'business_owner' ? '/business-home' : '/'
  const useInlineDarkNavbarLayout =
    isProfilePreviewPage || isPublicBusinessProfileVariant || ((isLandingPage || isSimpleDarkNavbarPage) && !user)
  const showLandingMobileHamburger = !user && isLandingPage
  const publicBusinessProfileBackPath = previewConfig?.backPath ?? '/'
  const publicBusinessProfileBackLabel = previewConfig?.backLabel ?? 'Home'
  const navbarInteractionStyle: CSSProperties = {
    WebkitTapHighlightColor: 'transparent',
  }

  useEffect(() => {
    if (shouldAnimateEntrance) {
      hasPlayedNavbarEntrance = true
    }
  }, [shouldAnimateEntrance])

  useEffect(() => {
    if (!hasTopBarMenu || !isHomeMenuOpen) {
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
  }, [hasTopBarMenu, isHomeMenuOpen])

  useEffect(() => {
    if (!showLandingMobileHamburger || !isLandingMobileMenuOpen) {
      return undefined
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!landingMobileMenuRef.current?.contains(event.target as Node)) {
        setIsLandingMobileMenuOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsLandingMobileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isLandingMobileMenuOpen, showLandingMobileHamburger])

  useEffect(() => {
    setIsHomeMenuOpen(false)
    setIsLandingMobileMenuOpen(false)
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
        { label: 'Home', path: authenticatedHomePath },
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
    if (user && showCreateProfileTopBar) {
      navigate(authenticatedHomePath)
      return
    }

    navigate(user ? '/dashboard' : '/')
  }

  const handleCreateProfileHelp = () => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message: 'Help is coming soon.', type: 'info' }])
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 4000)
  }

  const handleNavItemClick = (item: NavItem) => {
    setIsLandingMobileMenuOpen(false)

    if (item.type === 'scroll') {
      const sectionId = item.path.replace('#', '')
      navigate({ pathname: '/', hash: item.path })
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    navigate(item.path)
  }

  const handleCreateBusinessProfile = () => {
    clearProfile()
    navigate('/create-profile')
  }

  const homeMenuItems: HomeMenuItem[] = [
    { label: 'Account Settings', disabled: true },
    { label: 'Favorites / Saved Businesses', path: '/favorites' },
    { label: 'My Reviews', disabled: true },
    { label: 'Notifications', disabled: true },
    isBusinessOwnerEnabled
      ? {
          label: 'Switch to Business Owner',
          onSelect: async () => {
            try {
              await setPreferredAccountMode('business_owner')
              navigate('/business-home')
            } catch (error) {
              console.error('Failed to switch to Business Owner mode:', error)
              showError('Unable to switch to Business Owner mode. Please try again.')
            }
          },
        }
      : { label: 'Switch to Business Owner', path: '/start-business' },
    { label: 'Help & Support', disabled: true },
  ]

  const businessMenuItems: HomeMenuItem[] = [
    { label: 'Dashboard', disabled: true },
    { label: 'My Business Profiles', disabled: true },
    { label: 'Create Business Profile', onSelect: handleCreateBusinessProfile },
    {
      label: 'Switch to Customer',
      onSelect: async () => {
        try {
          await setPreferredAccountMode('customer')
          navigate('/')
        } catch (error) {
          console.error('Failed to switch to Customer mode:', error)
          showError('Unable to switch to Customer mode. Please try again.')
        }
      },
    },
    { label: 'Help & Support', disabled: true },
  ]

  const handleHomeMenuItemClick = async (item: HomeMenuItem) => {
    if (item.disabled) {
      setIsHomeMenuOpen(false)
      return
    }

    setIsHomeMenuOpen(false)
    if (item.onSelect) {
      await item.onSelect()
      return
    }

    if (item.path) {
      navigate(item.path)
    }
  }

  const navButtonClass = (item: NavItem) => {
    const isActive =
      item.type === 'scroll'
        ? location.pathname === '/' && location.hash === item.path
        : location.pathname === item.path
    const baseClass =
      `relative inline-flex min-w-[4rem] items-center justify-center overflow-hidden rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.01em] focus:outline-none focus-visible:ring-2 sm:min-w-[4.5rem] sm:px-3.5 sm:py-1.5 sm:text-sm ${
        useDarkHeaderStyle
          ? 'focus-visible:ring-slate-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950'
          : 'focus-visible:ring-slate-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50'
      }`

    if (useDarkHeaderStyle) {
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
            useDarkHeaderStyle
              ? 'border border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0.76),rgba(15,23,42,0.58))] shadow-[0_18px_36px_-28px_rgba(2,6,23,0.75)]'
              : 'border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] shadow-[0_22px_48px_-30px_rgba(15,23,42,0.34),0_14px_24px_-24px_rgba(15,23,42,0.22)]'
          }`}
        >
          <div
            className={`flex items-center justify-between gap-2 sm:gap-3 ${
              useInlineDarkNavbarLayout ? 'flex-nowrap' : 'flex-wrap'
            }`}
          >
            <button
              type="button"
              onClick={handleBrandClick}
              className={`inline-flex shrink-0 items-center gap-2 text-xs font-semibold tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2 sm:text-sm ${
                useDarkHeaderStyle
                  ? 'text-slate-100 focus-visible:ring-offset-slate-950'
                  : 'text-slate-900 focus-visible:ring-offset-slate-50'
              }`}
              aria-label="Go to Smart Business Profile home"
              style={navbarInteractionStyle}
            >
              <span
                className={`relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border text-[10px] font-bold text-white sm:h-9 sm:w-9 sm:text-[11px] ${
                  useDarkHeaderStyle
                    ? 'border-sky-400/20 bg-[linear-gradient(145deg,#020617_0%,#0f172a_58%,#0b1120_100%)] shadow-[0_14px_30px_-20px_rgba(14,165,233,0.4)]'
                    : 'border-transparent bg-[linear-gradient(145deg,#020617_0%,#0f172a_65%,#111827_100%)] shadow-[0_14px_30px_-18px_rgba(15,23,42,0.72)]'
                }`}
              >
                <span
                  className={`pointer-events-none absolute inset-x-2 top-1 h-3 rounded-full blur-sm ${
                    useDarkHeaderStyle ? 'bg-sky-300/20' : 'bg-white/20'
                  }`}
                  aria-hidden="true"
                />
                <span className="relative z-10">SB</span>
              </span>
              {!showPreviewHeader &&
                !isLandingPage &&
                !isStartBusinessPage &&
                !isBusinessHomePage &&
                !isCreateProfilePage &&
                !isProfilePreviewPage &&
                !isSimpleDarkNavbarPage &&
                'Smart Business Profile'}
            </button>

            {!isLoading && showPreviewHeader && previewConfig && (
              <div className="ml-auto flex items-center gap-2" aria-label="Preview quick actions">
                <button
                  type="button"
                  onClick={() => navigate(previewConfig.backPath)}
                  className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  style={navbarInteractionStyle}
                >
                  {previewConfig.backLabel}
                </button>
                <button
                  type="button"
                  aria-label="Help"
                  onClick={handleCreateProfileHelp}
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
                    <path d="M9.09 9a3 3 0 1 1 5.82 1c0 2-3 3-3 3" />
                    <path d="M12 17h.01" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                </button>
              </div>
            )}

            {!isLoading && isPublicBusinessProfileVariant && (
              <div className="ml-auto flex shrink-0 items-center gap-2" aria-label="Public business profile quick actions">
                <button
                  type="button"
                  onClick={() => navigate(publicBusinessProfileBackPath)}
                  className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  style={navbarInteractionStyle}
                >
                  {publicBusinessProfileBackLabel}
                </button>
                <button
                  type="button"
                  aria-label="Help"
                  onClick={handleCreateProfileHelp}
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
                    <path d="M9.09 9a3 3 0 1 1 5.82 1c0 2-3 3-3 3" />
                    <path d="M12 17h.01" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                </button>
              </div>
            )}

            {!isLoading && !showPreviewHeader && showCreateProfileTopBar && (
              <div className="ml-auto flex items-center gap-2" aria-label="Create profile quick actions">
                <button
                  type="button"
                  onClick={() => navigate(authenticatedHomePath)}
                  className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  style={navbarInteractionStyle}
                >
                  Home
                </button>
                <button
                  type="button"
                  aria-label="Help"
                  onClick={handleCreateProfileHelp}
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
                    <path d="M9.09 9a3 3 0 1 1 5.82 1c0 2-3 3-3 3" />
                    <path d="M12 17h.01" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                </button>
              </div>
            )}

            {!isLoading && !showPreviewHeader && showProfilePreviewTopBar && (
              <div className="ml-auto flex shrink-0 items-center gap-2" aria-label="Profile preview quick actions">
                <button
                  type="button"
                  onClick={() => navigate('/business-home')}
                  className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  style={navbarInteractionStyle}
                >
                  Home
                </button>
              </div>
            )}

            {!isLoading && !showPreviewHeader && showBusinessHomeTopBar && (
              <div
                ref={homeMenuRef}
                className="ml-auto flex items-center gap-2"
                aria-label="Business home quick actions"
              >
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
                      {businessMenuItems.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          role="menuitem"
                          disabled={item.disabled}
                          onClick={() => void handleHomeMenuItemClick(item)}
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

            {!isLoading && !showPreviewHeader && !hideAuthenticatedNavButtons && (
              <nav
                className={`items-center ${
                  useInlineDarkNavbarLayout
                    ? 'ml-auto shrink-0 flex-nowrap gap-1 sm:gap-2'
                    : 'w-full flex-wrap justify-end gap-2 pt-2 sm:w-auto sm:pt-0'
                } ${showLandingMobileHamburger ? 'hidden sm:flex' : 'flex'}`}
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
                {user && !isPublicBusinessProfileVariant && (
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

            {!isLoading && showLandingMobileHamburger && (
              <div ref={landingMobileMenuRef} className="relative ml-auto flex shrink-0 items-center sm:hidden" aria-label="Landing page mobile navigation">
                <button
                  type="button"
                  aria-label={isLandingMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                  aria-expanded={isLandingMobileMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => setIsLandingMobileMenuOpen((open) => !open)}
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
                    {isLandingMobileMenuOpen ? (
                      <>
                        <path d="M6 6l12 12" />
                        <path d="M18 6L6 18" />
                      </>
                    ) : (
                      <>
                        <path d="M4 7h16" />
                        <path d="M4 12h16" />
                        <path d="M4 17h16" />
                      </>
                    )}
                  </svg>
                </button>

                {isLandingMobileMenuOpen && (
                  <div
                    role="menu"
                    aria-label="Landing page navigation menu"
                    className="absolute right-0 top-full z-40 mt-2 w-[min(9rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_48px_-28px_rgba(15,23,42,0.45)]"
                  >
                    <div className="p-2">
                      {navItems.map((item) => (
                        <button
                          key={item.path}
                          type="button"
                          role="menuitem"
                          onClick={() => handleNavItemClick(item)}
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                        >
                          <span className="truncate">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isLoading && !showPreviewHeader && showLoggedInHomeIcons && (
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
                          onClick={() => void handleHomeMenuItemClick(item)}
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
