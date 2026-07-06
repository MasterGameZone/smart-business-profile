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
          ? 'overflow-x-clip bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_28%),linear-gradient(180deg,#020617_0%,#030712_34%,#020617_100%)] text-slate-100'
          : 'bg-gradient-to-b from-white to-slate-50'
      }`}
    >
      {darkBackground && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="landing-ambient-drift absolute inset-x-[-18%] top-[-12rem] h-[34rem] bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.18),transparent_55%)] blur-3xl" />
          <div
            className="landing-ambient-drift absolute right-[-20%] top-[18rem] h-[28rem] w-[48rem] bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.14),transparent_58%)] blur-3xl"
            style={{ animationDelay: '-7s' }}
          />
          <div className="landing-streak-float absolute left-[-12%] top-28 h-40 w-[124%] rotate-[-8deg] bg-[linear-gradient(90deg,transparent,rgba(125,211,252,0.08),rgba(59,130,246,0.14),transparent)] blur-3xl" />
          <div
            className="landing-streak-float absolute left-[-10%] top-[34rem] h-48 w-[120%] rotate-[6deg] bg-[linear-gradient(90deg,transparent,rgba(14,165,233,0.05),rgba(96,165,250,0.12),transparent)] blur-[90px]"
            style={{ animationDelay: '-11s' }}
          />
        </div>
      )}
      <AppHeader />

      <main className="relative flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div
            className={`rounded-2xl px-6 py-8 sm:px-10 sm:py-10 ${
              darkBackground
                ? 'border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.84))] shadow-[0_28px_70px_-38px_rgba(2,12,27,0.92)] backdrop-blur-md'
                : 'border border-gray-100 bg-white shadow-sm'
            }`}
          >
            <div className="text-center mb-8">
              <h1 className={`mb-2 tracking-tight ${darkBackground ? 'text-3xl font-bold text-slate-50' : 'text-2xl font-bold text-gray-900'}`}>{title}</h1>
              <p className={darkBackground ? 'text-base text-slate-300' : 'text-sm text-gray-500'}>{subtitle}</p>
            </div>

            {children}
          </div>

          {footer && <div className={`mt-6 text-center ${darkBackground ? 'text-slate-300' : ''}`}>{footer}</div>}
        </div>
      </main>
    </div>
  )
}

export default AuthLayout
