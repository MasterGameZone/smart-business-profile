import { useEffect, useState } from 'react'
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
    const isActive = item.type !== 'scroll' && location.pathname === item.path
    const isCta = item.emphasis
    const baseClass =
      'group relative inline-flex min-w-[4.5rem] items-center justify-center overflow-hidden rounded-full border px-3 py-2 text-xs font-semibold tracking-[0.01em] transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-50 active:scale-[0.985] sm:min-w-[5rem] sm:px-4 sm:py-2.5 sm:text-sm'

    if (isCta) {
      return `${baseClass} border-slate-900/80 bg-[linear-gradient(135deg,#020617_0%,#0f172a_34%,#111827_62%,#020617_100%)] text-white shadow-[0_16px_34px_-20px_rgba(15,23,42,0.8)] hover:-translate-y-0.5 hover:border-slate-800 hover:shadow-[0_22px_38px_-18px_rgba(15,23,42,0.7)] focus:ring-slate-400 ${isActive ? 'ring-2 ring-slate-200/90 ring-offset-2 ring-offset-slate-50 shadow-[0_18px_36px_-18px_rgba(15,23,42,0.82)]' : ''}`
    }

    if (isActive) {
      return `${baseClass} border-slate-300/90 bg-[linear-gradient(180deg,rgba(241,245,249,1),rgba(226,232,240,0.96))] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.98),0_12px_24px_-22px_rgba(15,23,42,0.3)] ring-1 ring-slate-200/90 hover:border-slate-300 hover:bg-[linear-gradient(180deg,rgba(237,242,247,1),rgba(226,232,240,0.98))] hover:shadow-[inset_0_1px_0_rgba(255,255,255,1),0_14px_24px_-22px_rgba(15,23,42,0.3)]`
    }

    return `${baseClass} border-transparent bg-transparent text-slate-700 hover:border-slate-200 hover:bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(241,245,249,0.94))] hover:text-slate-950 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_10px_18px_-22px_rgba(15,23,42,0.2)]`
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
              className="group inline-flex shrink-0 items-center gap-2 text-xs font-semibold tracking-tight text-slate-900 transition-[transform,color] duration-300 ease-out hover:-translate-y-0.5 hover:text-slate-950 focus:outline-none sm:text-sm"
              aria-label="Go to Smart Business Profile home"
            >
              <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(145deg,#020617_0%,#0f172a_65%,#111827_100%)] text-[11px] font-bold text-white shadow-[0_14px_30px_-18px_rgba(15,23,42,0.72)] transition-[transform,box-shadow,filter] duration-300 ease-out group-hover:scale-[1.05] group-hover:shadow-[0_20px_40px_-16px_rgba(15,23,42,0.78)] group-hover:brightness-105 sm:h-11 sm:w-11 sm:text-xs">
                <span className="pointer-events-none absolute inset-x-2 top-1 h-3 rounded-full bg-white/20 blur-sm transition-opacity duration-300 group-hover:opacity-90" aria-hidden="true" />
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
                  (() => {
                    const isItemActive = item.type !== 'scroll' && location.pathname === item.path

                    return (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => handleNavItemClick(item)}
                        className={navButtonClass(item)}
                        aria-current={isItemActive ? 'page' : undefined}
                      >
                        {item.emphasis && !isItemActive && (
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-x-4 top-[1px] h-[42%] rounded-full bg-white/18 blur-md transition-opacity duration-300 ease-out group-hover:opacity-100"
                          />
                        )}
                        <span className="relative z-10">{item.label}</span>
                      </button>
                    )
                  })()
                ))}
                {user && (
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={isSigningOut}
                    className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] px-3 py-2 text-xs font-medium text-slate-700 shadow-[0_12px_26px_-22px_rgba(15,23,42,0.38)] transition-[transform,background-color,color,box-shadow] duration-300 ease-out hover:-translate-y-0.5 hover:bg-white hover:text-slate-950 hover:shadow-[0_18px_32px_-20px_rgba(15,23,42,0.34)] focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 focus:ring-offset-slate-50 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-70 sm:px-4 sm:py-2.5 sm:text-sm"
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
