import { useState } from 'react'
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

function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isLoading } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const isLandingPage = location.pathname === '/'

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
          { label: 'Login', path: '/login' },
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
    const baseClass =
      'inline-flex min-w-[4.75rem] items-center justify-center rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-95 sm:min-w-[5.5rem] sm:px-3 sm:py-2 sm:text-sm'

    if (isActive) {
      return `${baseClass} bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500`
    }

    if (item.emphasis) {
      return `${baseClass} border border-blue-100 bg-blue-50 text-blue-700 hover:border-blue-200 hover:bg-blue-100 focus:ring-blue-300`
    }

    return `${baseClass} text-gray-600 hover:bg-gray-50 hover:text-gray-900 focus:ring-gray-300`
  }

  return (
    <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 px-3 py-3 backdrop-blur sm:px-4 sm:py-4">
      <ToastContainer toasts={toasts} />
      <div
        className={`mx-auto flex max-w-5xl items-center justify-between gap-2 sm:gap-3 ${
          isLandingPage && !user ? 'flex-nowrap' : 'flex-wrap'
        }`}
      >
        <button
          type="button"
          onClick={handleBrandClick}
          className="inline-flex shrink-0 items-center gap-2 text-xs font-bold tracking-tight text-gray-900 transition-colors hover:text-blue-700 focus:outline-none focus:underline sm:text-sm"
          aria-label="Go to Smart Business Profile home"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-[11px] font-bold text-white sm:h-8 sm:w-8 sm:text-xs">
            SB
          </span>
          {!(isLandingPage && !user) && 'Smart Business Profile'}
        </button>

        {!isLoading && (
          <nav
            className={`flex items-center justify-end ${
              isLandingPage && !user
                ? 'w-auto shrink min-w-0 flex-nowrap gap-1 sm:gap-1.5'
                : 'w-full flex-wrap gap-2 sm:w-auto'
            }`}
            aria-label="Primary navigation"
          >
            {navItems.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => handleNavItemClick(item)}
                className={navButtonClass(item)}
                aria-current={item.type !== 'scroll' && location.pathname === item.path ? 'page' : undefined}
              >
                {item.label}
              </button>
            ))}
            {user && (
              <button
                type="button"
                onClick={handleLogout}
                disabled={isSigningOut}
                className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 sm:px-4 sm:py-2 sm:text-sm"
              >
                {isSigningOut ? 'Logging out...' : 'Log Out'}
              </button>
            )}
          </nav>
        )}
      </div>
    </header>
  )
}

export default AppHeader
