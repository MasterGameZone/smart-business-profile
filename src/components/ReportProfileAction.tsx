import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  getOwnReportForBusiness,
  submitBusinessProfileReport,
} from '../lib/businessProfileReportService.ts'
import {
  businessProfileReportReasons,
  type BusinessProfileReportReason,
} from '../types/businessProfileReport.ts'

interface ReportProfileActionProps {
  businessProfileId: string
  userId: string | null
  onLogin: () => void
  triggerClassName?: string
}

function isReportReason(value: string): value is BusinessProfileReportReason {
  return businessProfileReportReasons.includes(value as BusinessProfileReportReason)
}

function ReportProfileAction({ businessProfileId, userId, onLogin, triggerClassName }: ReportProfileActionProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [hasReported, setHasReported] = useState(false)
  const [isCheckingReport, setIsCheckingReport] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadReportStatus() {
      if (!userId) {
        setHasReported(false)
        return
      }

      setIsCheckingReport(true)

      try {
        const report = await getOwnReportForBusiness(userId, businessProfileId)
        if (cancelled) return

        setHasReported(Boolean(report))
      } catch (loadError) {
        if (cancelled) return
        console.error('Failed to load profile report status:', loadError)
      } finally {
        if (!cancelled) {
          setIsCheckingReport(false)
        }
      }
    }

    loadReportStatus()

    return () => {
      cancelled = true
    }
  }, [businessProfileId, userId])

  useEffect(() => {
    if (!isOpen) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen])

  const handleOpen = () => {
    setError(null)

    if (!userId) {
      setMessage('Please log in to report this profile.')
      onLogin()
      return
    }

    if (hasReported) {
      setMessage('You have already reported this profile.')
      setIsOpen(false)
      return
    }

    setMessage(null)
    setIsOpen(true)
  }

  const resetForm = () => {
    setReason('')
    setDetails('')
    setError(null)
  }

  const handleClose = () => {
    setIsOpen(false)
    resetForm()
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!userId) return

    if (!isReportReason(reason)) {
      setError('Please select a reason.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await submitBusinessProfileReport({
        reporterUserId: userId,
        businessProfileId,
        reason,
        details,
      })
      setHasReported(true)
      setIsOpen(false)
      resetForm()
      setMessage("Thanks for reporting. We'll review this profile.")
    } catch (submitError) {
      console.error('Failed to submit business profile report:', submitError)
      const existingReport = await getOwnReportForBusiness(userId, businessProfileId)
      if (existingReport) {
        setHasReported(true)
        setIsOpen(false)
        resetForm()
        setMessage('You have already reported this profile.')
        return
      }

      setError('Unable to submit report right now.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const reportInterface = (
    <div className="relative rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-xl sm:px-5">
      <button
        type="button"
        onClick={handleClose}
        aria-label="Close report profile"
        className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-100 bg-slate-50 px-4 py-4">
        <label htmlFor="profileReportReason" className="block text-sm font-semibold text-gray-900">
          Reason
        </label>
        <select
          id="profileReportReason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        >
          <option value="">Select a reason</option>
          {businessProfileReportReasons.map((reportReason) => (
            <option key={reportReason} value={reportReason}>
              {reportReason}
            </option>
          ))}
        </select>

        <label htmlFor="profileReportDetails" className="mt-4 block text-sm font-semibold text-gray-900">
          Details <span className="font-normal text-gray-400">Optional</span>
        </label>
        <textarea
          id="profileReportDetails"
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          rows={3}
          placeholder="Add any extra details optional"
          className="mt-2 w-full resize-y rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Report'}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )

  const defaultTriggerClassName =
    'inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70'

  return (
    <div aria-label="Report profile" className="space-y-3">
      <button
        type="button"
        onClick={handleOpen}
        disabled={isCheckingReport}
        className={triggerClassName ?? defaultTriggerClassName}
      >
        <span className="inline-flex items-center gap-1.5">
          <svg
            className="h-4 w-4 shrink-0 text-orange-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 5v15m0-15h10l-1.5 3L15 11H5"
            />
          </svg>
          <span>{isCheckingReport ? 'Checking...' : 'Report'}</span>
        </span>
      </button>

      {message && (
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700" role="status">
          {message}
        </p>
      )}

      {isOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                handleClose()
              }
            }}
          >
            <div className="w-full max-w-lg overflow-hidden rounded-t-[1.5rem] sm:rounded-[1.5rem]">
              {reportInterface}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

export default ReportProfileAction
