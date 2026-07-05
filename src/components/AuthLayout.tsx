import type { ReactNode } from 'react'
import AppHeader from './AppHeader.tsx'

export const authInputBase =
  'w-full px-4 py-2.5 border rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-sm'

export const authLabel = 'block text-sm font-medium text-gray-700 mb-1.5'

export const authError = (message?: string) =>
  message ? (
    <p role="alert" className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
      <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
      {message}
    </p>
  ) : null

interface AuthLayoutProps {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}

function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 flex flex-col">
      <AppHeader />

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-8 sm:px-10 sm:py-10">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-1.5">{title}</h1>
              <p className="text-sm text-gray-500">{subtitle}</p>
            </div>

            {children}
          </div>

          {footer && <div className="mt-6 text-center">{footer}</div>}
        </div>
      </main>
    </div>
  )
}

export default AuthLayout
