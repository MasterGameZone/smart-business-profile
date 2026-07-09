import { useEffect, useState, type FormEvent } from 'react'
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
}

function isReportReason(value: string): value is BusinessProfileReportReason {
  return businessProfileReportReasons.includes(value as BusinessProfileReportReason)
}

function ReportProfileAction({ businessProfileId, userId, onLogin }: ReportProfileActionProps) {
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

  return (
    <section aria-label="Report profile" className="rounded-2xl border border-gray-100 bg-white px-6 py-5 shadow-sm sm:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Report Profile
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Report fake, misleading, spam, duplicate, or inappropriate business information.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpen}
          disabled={isCheckingReport}
          className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isCheckingReport ? 'Checking...' : 'Report Profile'}
        </button>
      </div>

      {message && (
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700" role="status">
          {message}
        </p>
      )}

      {isOpen && (
        <form onSubmit={handleSubmit} className="mt-5 rounded-2xl border border-gray-100 bg-slate-50 px-4 py-4">
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
              onClick={() => {
                setIsOpen(false)
                resetForm()
              }}
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

export default ReportProfileAction
