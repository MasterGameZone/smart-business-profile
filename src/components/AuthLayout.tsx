import type { ReactNode } from 'react'
import AppHeader from './AppHeader.tsx'

export const authInputBase =
  'w-full rounded-xl border border-white/10 bg-white/[0.08] px-4 py-2.5 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/70 focus:border-transparent'

export const authLabel = 'mb-1.5 block text-sm font-medium text-slate-200'

export const authError = (message?: string) =>
  message ? (
    <p role="alert" className="mt-1.5 flex items-center gap-1 text-xs text-red-300">
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
  darkBackground?: boolean
}

function AuthLayout({ title, subtitle, children, footer, darkBackground = false }: AuthLayoutProps) {
  return (
    <div
      className={`relative min-h-screen flex flex-col ${
        darkBackground
          ? 'bg-[#eef4fa] text-black'
          : 'bg-[#eef4fa]'
      }`}
    >
      <AppHeader />

      <main className="relative flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div
            className={`rounded-2xl px-6 py-8 sm:px-10 sm:py-10 ${
              darkBackground
                ? 'border border-[#c7d2df] bg-[#f8fafc] shadow-[0_28px_70px_-38px_rgba(2,12,27,0.92)] backdrop-blur-md'
                : 'border border-[#c7d2df] bg-white shadow-sm'
            }`}
          >
            <div className="text-center mb-8">
              <h1 className={`mb-2 tracking-tight ${darkBackground ? 'text-3xl font-bold text-black' : 'text-2xl font-bold text-black'}`}>{title}</h1>
              <p className={darkBackground ? 'text-base text-black' : 'text-sm text-black'}>{subtitle}</p>
            </div>

            {children}
          </div>

          {footer && <div className={`mt-6 text-center ${darkBackground ? 'text-black' : ''}`}>{footer}</div>}
        </div>
      </main>
    </div>
  )
}

export default AuthLayout
