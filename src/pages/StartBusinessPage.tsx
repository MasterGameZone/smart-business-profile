import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import AppHeader from '../components/AppHeader.tsx'
import { useAuth } from '../context/AuthContext.tsx'
import { usePageMeta } from '../hooks/usePageMeta.ts'

function StartBusinessPage() {
  const navigate = useNavigate()
  const { isLoading, isBusinessOwnerEnabled, enableBusinessOwner, setPreferredAccountMode } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  usePageMeta({
    title: 'Start Your Business Profile | Smart Business Profile',
    description:
      'Learn whether you should create a business profile and continue to the temporary business owner home.',
  })

  useEffect(() => {
    if (!isLoading && isBusinessOwnerEnabled) {
      navigate('/business-home', { replace: true })
    }
  }, [isBusinessOwnerEnabled, isLoading, navigate])

  const handleContinue = async () => {
    if (isSubmitting) return

    setIsSubmitting(true)
    setErrorMessage('')
    try {
      await enableBusinessOwner()
      navigate('/business-home')
    } catch (error) {
      console.error('Failed to enable Business Owner mode:', error)
      setErrorMessage('Unable to enable Business Owner mode. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoBack = async () => {
    try {
      await setPreferredAccountMode('customer')
      navigate('/')
    } catch (error) {
      console.error('Failed to switch to Customer mode:', error)
      setErrorMessage('Unable to switch to Customer mode. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#020617_0%,#030712_34%,#020617_100%)] text-slate-100">
      <AppHeader />

      <main className="mx-auto flex max-w-3xl flex-col items-center px-4 py-10 text-center sm:py-14">
        <section className="w-full">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
            Business Owner Setup
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
            Create a business profile for your business
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
            Create a profile if you offer any product, service, or professional work and want customers to find and
            contact you easily.
          </p>
        </section>

        <section className="mt-14 w-full max-w-md text-center sm:mt-16">
          <p className="text-base font-semibold tracking-tight text-slate-100">
            Ready to continue as a business owner?
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => void handleContinue()}
              disabled={isSubmitting || isLoading}
              className="inline-flex min-h-[42px] flex-1 items-center justify-center rounded-full border border-sky-400/30 bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_55%,#0f172a_100%)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_32px_-20px_rgba(56,189,248,0.42)] focus:outline-none focus:ring-2 focus:ring-sky-300/80 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              {isSubmitting ? 'Saving...' : 'Yes, Continue'}
            </button>
            <button
              type="button"
              onClick={() => void handleGoBack()}
              disabled={isSubmitting || isLoading}
              className="inline-flex min-h-[42px] flex-1 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              No, Go Back
            </button>
          </div>
          {errorMessage && (
            <p className="mt-4 text-sm text-rose-300" role="alert">
              {errorMessage}
            </p>
          )}
        </section>
      </main>
    </div>
  )
}

export default StartBusinessPage
