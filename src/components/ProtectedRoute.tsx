import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.tsx'

/**
 * Guards routes that require authentication. While the auth session is still
 * being resolved, a lightweight loading state is shown to avoid redirecting a
 * logged-in user before their session is known. Unauthenticated users are sent
 * to the login page, preserving the originally requested location so they can be
 * returned there after a successful login.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isLoggingOut } = useAuth()
  const location = useLocation()

  if (isLoading || isLoggingOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#eef4fa]" role="status" aria-live="polite">
        <svg className="w-6 h-6 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="sr-only">Loading…</span>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}

export default ProtectedRoute
