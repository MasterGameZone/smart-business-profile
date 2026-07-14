import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
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

function getInitials(value: string): string {
  return value
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'SB'
}

function getMetadataString(metadata: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return null
}

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
  const customerMenuOverlayRef = useRef<HTMLDivElement | null>(null)
  const landingMobileMenuRef = useRef<HTMLDivElement | null>(null)
  const userMetadata = (user?.user_metadata ?? {}) as Record<string, unknown>
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
      const target = event.target as Node

      if (showLoggedInHomeIcons && customerMenuOverlayRef.current?.contains(target)) {
        return
      }

      if (!homeMenuRef.current?.contains(target)) {
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
  }, [hasTopBarMenu, isHomeMenuOpen, showLoggedInHomeIcons])

  useEffect(() => {
    if (!showLoggedInHomeIcons || !isHomeMenuOpen) {
      return undefined
    }

    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow

    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
    }
  }, [isHomeMenuOpen, showLoggedInHomeIcons])

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

  const customerDisplayName =
    getMetadataString(userMetadata, ['full_name', 'name', 'display_name']) ??
    (user?.email ? user.email.split('@')[0] : 'Customer')
  const customerEmail = user?.email ?? ''
  const customerLocation = getMetadataString(userMetadata, ['preferred_location', 'location', 'city'])
  const customerAvatarUrl = getMetadataString(userMetadata, ['avatar_url', 'picture'])

  const customerProfileSettingsItem: HomeMenuItem = {
    label: 'View Profile & Settings',
    onSelect: () => {
      const id = Date.now()
      setToasts((prev) => [...prev, { id, message: 'Profile & Settings is coming soon.', type: 'info' }])
      setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 4000)
    },
  }

  const customerPrimaryMenuItems: HomeMenuItem[] = [
    { label: 'Notifications', disabled: true },
    { label: 'Saved Businesses', path: '/favorites' },
  ]

  const customerActivityMenuItems: HomeMenuItem[] = [
    { label: 'Ratings & Reviews', disabled: true },
    { label: 'Reported Profiles', disabled: true },
    { label: 'Submitted Corrections', disabled: true },
  ]

  const customerCommunityMenuItems: HomeMenuItem[] = [
    { label: 'My Local Impact', disabled: true },
    { label: 'Support a Business', disabled: true },
    { label: 'Shape the Platform', disabled: true },
  ]

  const customerHelpMenuItems: HomeMenuItem[] = [
    { label: 'Help Articles', disabled: true },
    { label: 'Contact Support', disabled: true },
    { label: 'Report a Problem', disabled: true },
    { label: 'Submit Feedback', disabled: true },
  ]

  const switchToBusinessModeMenuItem: HomeMenuItem = isBusinessOwnerEnabled
    ? {
        label: 'Switch to Business Mode',
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
    : { label: 'Switch to Business Mode', path: '/start-business' }

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
          ? 'border-white/10 bg-white/10 text-[#0f172a]'
          : 'border-transparent bg-transparent text-[#0f172a]'
      }`
    }

    return `${baseClass} ${
      isActive
        ? 'border-slate-200 bg-slate-100 text-[#0f172a]'
        : 'border-transparent bg-transparent text-[#0f172a]'
    }`
  }

  const customerMenuItemClass = (item: HomeMenuItem) =>
    `flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm ${
      item.disabled
        ? 'cursor-not-allowed text-slate-500'
        : 'text-[#0f172a] transition hover:bg-slate-50 focus:bg-slate-50'
    } focus:outline-none`

  return (
    <header className="sticky top-0 z-30 w-full px-3 pt-0 pb-0.5 sm:px-4 sm:pb-1">
      <ToastContainer toasts={toasts} />
      <div className={`mx-auto w-full max-w-[1440px] ${shouldAnimateEntrance ? 'animate-[navFloatIn_620ms_cubic-bezier(0.22,1,0.36,1)]' : ''}`}>
        <div
          className={`rounded-[2rem] px-3 py-1.5 backdrop-blur-xl sm:px-4 sm:py-2 md:px-5 ${
            useDarkHeaderStyle
              ? 'border border-[rgba(199,210,223,0.10)] bg-[#f8fafc] shadow-[0_18px_36px_-28px_rgba(2,6,23,0.75)]'
              : 'border border-[rgba(199,210,223,0.80)] bg-[#f8fafc] shadow-[0_22px_48px_-30px_rgba(15,23,42,0.34),0_14px_24px_-24px_rgba(15,23,42,0.22)]'
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
                  ? 'text-[#0f172a] focus-visible:ring-offset-slate-950'
                  : 'text-[#0f172a] focus-visible:ring-offset-slate-50'
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
                  className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  style={navbarInteractionStyle}
                >
                  {previewConfig.backLabel}
                </button>
                <button
                  type="button"
                  aria-label="Help"
                  onClick={handleCreateProfileHelp}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/5 text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
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
                  className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  style={navbarInteractionStyle}
                >
                  {publicBusinessProfileBackLabel}
                </button>
                <button
                  type="button"
                  aria-label="Help"
                  onClick={handleCreateProfileHelp}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/5 text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
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
                  className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  style={navbarInteractionStyle}
                >
                  Home
                </button>
                <button
                  type="button"
                  aria-label="Help"
                  onClick={handleCreateProfileHelp}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/5 text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
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
                  className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
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
                  aria-label={isHomeMenuOpen ? 'Close account menu' : 'Open account menu'}
                  aria-expanded={isHomeMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => setIsHomeMenuOpen((open) => !open)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/5 text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
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
                      <p className="text-sm font-semibold text-[#0f172a]">Menu</p>
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
                              ? 'cursor-default text-[#0f172a]'
                              : 'text-[#0f172a] hover:bg-slate-50 focus:bg-slate-50'
                          } focus:outline-none`}
                        >
                          <span className="whitespace-nowrap">{item.label}</span>
                          {item.disabled && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-[#0f172a]">
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
                        ? 'border-white/12 bg-white/5 text-[#0f172a] focus-visible:ring-slate-300 focus-visible:ring-offset-slate-950'
                        : 'border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] text-[#0f172a] shadow-[0_12px_26px_-22px_rgba(15,23,42,0.38)] focus-visible:ring-slate-300 focus-visible:ring-offset-slate-50'
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
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/5 text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
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
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#0f172a] hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
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
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/5 text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
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
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/5 text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
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
                    {isHomeMenuOpen ? (
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

                {isHomeMenuOpen && createPortal(
                  <div
                    ref={customerMenuOverlayRef}
                    className="fixed inset-0 z-[100] overflow-hidden bg-slate-950/12 backdrop-blur-[2px]"
                    onMouseDown={(event) => {
                      if (event.target === event.currentTarget) {
                        setIsHomeMenuOpen(false)
                      }
                    }}
                  >
                    <div className="flex h-[100dvh] w-full justify-end">
                      <div className="flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-white shadow-[0_32px_80px_-36px_rgba(15,23,42,0.45)] sm:m-3 sm:h-[calc(100dvh-1.5rem)] sm:rounded-[1.75rem] sm:border sm:border-slate-200">
                        <div className="border-b border-slate-100 bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)] px-4 py-4">
                          <div className="mb-4 flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              {customerAvatarUrl ? (
                                <img
                                  src={customerAvatarUrl}
                                  alt={`${customerDisplayName} profile`}
                                  className="h-12 w-12 rounded-full border border-sky-100 object-cover"
                                />
                              ) : (
                                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-sky-100 bg-sky-50 text-sm font-semibold text-sky-700">
                                  {getInitials(customerDisplayName)}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-[#0f172a]">{customerDisplayName}</p>
                                <p className="truncate text-xs text-slate-500">{customerEmail}</p>
                                {customerLocation && (
                                  <div className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">
                                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={1.8}
                                        d="M12 21s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10z"
                                      />
                                      <circle cx="12" cy="11" r="2.5" strokeWidth={1.8} />
                                    </svg>
                                    <span className="truncate">{customerLocation}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              aria-label="Close customer menu"
                              onClick={() => setIsHomeMenuOpen(false)}
                              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-[0_10px_22px_-18px_rgba(15,23,42,0.32)] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2"
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
                                <path d="M6 6l12 12" />
                                <path d="M18 6L6 18" />
                              </svg>
                            </button>
                          </div>
                          <button
                            type="button"
                            role="menuitem"
                            disabled={customerProfileSettingsItem.disabled}
                            onClick={() => void handleHomeMenuItemClick(customerProfileSettingsItem)}
                            className={`flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-medium shadow-[0_10px_22px_-18px_rgba(15,23,42,0.32)] ${
                              customerProfileSettingsItem.disabled
                                ? 'cursor-not-allowed text-slate-500'
                                : 'text-[#0f172a] hover:bg-slate-50 focus:bg-slate-50'
                            } focus:outline-none`}
                          >
                            <span>{customerProfileSettingsItem.label}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                              Coming soon
                            </span>
                          </button>
                        </div>

                        <div role="menu" aria-label="Customer menu" className="flex-1 overflow-y-auto overscroll-contain px-0 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                          <div className="p-2">
                            {customerPrimaryMenuItems.map((item, index) => (
                              <button
                                key={item.label}
                                type="button"
                                role="menuitem"
                                disabled={item.disabled}
                                onClick={() => void handleHomeMenuItemClick(item)}
                                className={customerMenuItemClass(item)}
                              >
                                <span className="flex items-center gap-3">
                                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-600">
                                    {index === 0 ? (
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 20a2 2 0 0 0 4 0" />
                                      </svg>
                                    ) : (
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 16.5v-9z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m9 12 2 2 4-5" />
                                      </svg>
                                    )}
                                  </span>
                                  <span>{item.label}</span>
                                </span>
                                {item.disabled && (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                                    Soon
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                          <div className="px-4 pb-1 pt-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">My Activity</p>
                          </div>
                          <div className="p-2 pt-1">
                            {customerActivityMenuItems.map((item, index) => (
                              <button
                                key={item.label}
                                type="button"
                                role="menuitem"
                                disabled={item.disabled}
                                onClick={() => void handleHomeMenuItemClick(item)}
                                className={customerMenuItemClass(item)}
                              >
                                <span className="flex items-center gap-3">
                                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-600">
                                    {index === 0 ? (
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h10M7 12h6m-6 5h10M5 4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-15z" />
                                      </svg>
                                    ) : index === 1 ? (
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v4m0 4h.01M10.3 3.9l-8 13.8A1 1 0 0 0 3.2 19h17.6a1 1 0 0 0 .9-1.3l-8-13.8a1 1 0 0 0-1.8 0z" />
                                      </svg>
                                    ) : (
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h4M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                                      </svg>
                                    )}
                                  </span>
                                  <span>{item.label}</span>
                                </span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                                  Soon
                                </span>
                              </button>
                            ))}
                          </div>
                          <div className="px-4 pb-1 pt-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Community</p>
                          </div>
                          <div className="p-2 pt-1">
                            {customerCommunityMenuItems.map((item, index) => (
                              <button
                                key={item.label}
                                type="button"
                                role="menuitem"
                                disabled={item.disabled}
                                onClick={() => void handleHomeMenuItemClick(item)}
                                className={customerMenuItemClass(item)}
                              >
                                <span className="flex items-center gap-3">
                                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-600">
                                    {index === 0 ? (
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9h.01M11 12h1v4h1" />
                                      </svg>
                                    ) : index === 1 ? (
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4" />
                                      </svg>
                                    ) : (
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h8M8 14h5M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                                      </svg>
                                    )}
                                  </span>
                                  <span>{item.label}</span>
                                </span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                                  Soon
                                </span>
                              </button>
                            ))}
                          </div>
                          <div className="mx-4 my-2 h-px bg-slate-100" />
                          <div className="p-2 pt-0">
                            <button
                              type="button"
                              role="menuitem"
                              disabled={switchToBusinessModeMenuItem.disabled}
                              onClick={() => void handleHomeMenuItemClick(switchToBusinessModeMenuItem)}
                              className={customerMenuItemClass(switchToBusinessModeMenuItem)}
                            >
                              <span className="flex items-center gap-3">
                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7h16M4 12h10M4 17h16" />
                                  </svg>
                                </span>
                                <span>{switchToBusinessModeMenuItem.label}</span>
                              </span>
                            </button>
                          </div>
                          <div className="mx-4 my-2 h-px bg-slate-100" />
                          <div className="px-4 pb-1 pt-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Help &amp; Feedback</p>
                          </div>
                          <div className="p-2 pt-1">
                            {customerHelpMenuItems.map((item, index) => (
                              <button
                                key={item.label}
                                type="button"
                                role="menuitem"
                                disabled={item.disabled}
                                onClick={() => void handleHomeMenuItemClick(item)}
                                className={customerMenuItemClass(item)}
                              >
                                <span className="flex items-center gap-3">
                                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-600">
                                    {index === 0 ? (
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.5 5 8v8l7 3.5 7-3.5V8l-7-3.5zM12 12l7-4M12 12 5 8m7 0v7.5" />
                                      </svg>
                                    ) : index === 1 ? (
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 8h10M7 12h10m-10 4h6M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                                      </svg>
                                    ) : index === 2 ? (
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v4m0 4h.01M10.3 3.9l-8 13.8A1 1 0 0 0 3.2 19h17.6a1 1 0 0 0 .9-1.3l-8-13.8a1 1 0 0 0-1.8 0z" />
                                      </svg>
                                    ) : (
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h8M8 14h4M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                                      </svg>
                                    )}
                                  </span>
                                  <span>{item.label}</span>
                                </span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                                  Soon
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="border-t border-slate-100 bg-white px-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2">
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
                    </div>
                  </div>,
                  document.body
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
