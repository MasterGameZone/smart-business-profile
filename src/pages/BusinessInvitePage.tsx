import { Link, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import AppHeader from '../components/AppHeader.tsx'
import { usePageMeta } from '../hooks/usePageMeta.ts'
import { getSupportInvitePreview } from '../lib/customerBusinessSupportService.ts'
import {
  isValidSupportInviteToken,
  trackSupportInviteOpen,
} from '../lib/supportInviteStorage.ts'

function BusinessInvitePage() {
  const { token: routeToken } = useParams<{ token: string }>()
  const token = routeToken ?? ''
  const isValidToken = isValidSupportInviteToken(token)
  const [preview, setPreview] = useState<{ token: string; customerName: string | null }>({
    token: '',
    customerName: null,
  })

  usePageMeta({
    title: 'Business Invite | Smart Business Profile',
    description: 'Create your free business profile from a customer invitation.',
  })

  useEffect(() => {
    if (!isValidToken) return

    let isCurrent = true
    trackSupportInviteOpen(token)

    getSupportInvitePreview(token).then((preview) => {
      if (!isCurrent) return
      setPreview({
        token,
        customerName: preview?.customerName ?? null,
      })
    })

    return () => {
      isCurrent = false
    }
  }, [isValidToken, token])

  const signupPath = isValidToken ? `/signup?supportInvite=${encodeURIComponent(token)}` : '/signup'
  const loginPath = isValidToken ? `/login?supportInvite=${encodeURIComponent(token)}` : '/login'
  const customerName = isValidToken && preview.token === token ? preview.customerName : null
  const inviterName = customerName ?? 'A customer'

  return (
    <div className="relative flex min-h-screen flex-col bg-[#eef4fa] text-black">
      <AppHeader />

      <main className="relative flex flex-1 items-center justify-center px-4 py-8">
        <section className="w-full max-w-md rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-6 py-8 text-center shadow-[0_28px_70px_-38px_rgba(2,12,27,0.92)] sm:px-10 sm:py-10">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 8.25h16.5m-13.5 0V6A2.25 2.25 0 0 1 9 3.75h6A2.25 2.25 0 0 1 17.25 6v2.25m-10.5 0h10.5m-12 0 1.1 10.45a2.25 2.25 0 0 0 2.24 2h6.82a2.25 2.25 0 0 0 2.24-2l1.1-10.45" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-black">
            You're invited to create your business profile
          </h1>

          <div className="mt-4 space-y-3 text-base leading-relaxed text-black">
            <p>{inviterName} has suggested your business on Smart Business Profile.</p>
            <p>Create your free business profile and make it easier for customers to find, trust, and contact you.</p>
          </div>

          <div className="mt-7">
            <Link
              to={signupPath}
              className="inline-flex w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_55%,#0f172a_100%)] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_32px_-20px_rgba(56,189,248,0.42)] focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 focus:ring-offset-[#f8fafc]"
            >
              Sign Up &amp; Create Profile
            </Link>
          </div>

          <p className="mt-5 text-sm text-black">
            Already have an account?{' '}
            <Link to={loginPath} className="font-semibold text-blue-600 focus:outline-none focus:underline">
              Log in
            </Link>
          </p>
        </section>
      </main>
    </div>
  )
}

export default BusinessInvitePage
