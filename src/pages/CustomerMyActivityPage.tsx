import { useLocation, useNavigate } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta.ts'

type ActivityTab = 'reviews' | 'reports' | 'corrections'

interface ReviewActivityItem {
  businessName: string
  rating: number
  reviewText: string
  reviewDate: string
}

interface ReportActivityItem {
  businessName: string
  reportReason: string
  reportDate: string
  reportStatus: 'In Review' | 'Received' | 'Closed'
}

interface CorrectionActivityItem {
  businessName: string
  correctionType: string
  submittedDate: string
  correctionStatus: 'Pending' | 'Under Review' | 'Accepted'
}

const sampleReviews: ReviewActivityItem[] = [
  {
    businessName: 'Esporton',
    rating: 4,
    reviewText: 'Helpful service and a smooth experience from start to finish.',
    reviewDate: 'July 10, 2026',
  },
  {
    businessName: 'BMB',
    rating: 5,
    reviewText: 'Quick response time and easy to contact through the public profile.',
    reviewDate: 'July 4, 2026',
  },
]

const sampleReports: ReportActivityItem[] = [
  {
    businessName: 'Esporton10000',
    reportReason: 'Outdated contact information',
    reportDate: 'July 8, 2026',
    reportStatus: 'In Review',
  },
  {
    businessName: 'BMB 2',
    reportReason: 'Business category appears incorrect',
    reportDate: 'June 29, 2026',
    reportStatus: 'Received',
  },
]

const sampleCorrections: CorrectionActivityItem[] = [
  {
    businessName: 'Esporton40000',
    correctionType: 'Business hours update',
    submittedDate: 'July 6, 2026',
    correctionStatus: 'Under Review',
  },
  {
    businessName: 'Esporton12',
    correctionType: 'Address correction',
    submittedDate: 'June 25, 2026',
    correctionStatus: 'Pending',
  },
]

function statusPillClass(status: string): string {
  switch (status) {
    case 'Closed':
    case 'Accepted':
      return 'bg-emerald-50 text-emerald-700'
    case 'In Review':
    case 'Under Review':
      return 'bg-blue-50 text-blue-700'
    default:
      return 'bg-amber-50 text-amber-700'
  }
}

function getActiveTab(hash: string): ActivityTab {
  if (hash === '#reports') return 'reports'
  if (hash === '#corrections') return 'corrections'
  return 'reviews'
}

function CustomerMyActivityPage() {
  const location = useLocation()
  const navigate = useNavigate()

  usePageMeta({
    title: 'My Activity | Smart Business Profile',
    description: 'View your customer reviews, reported profiles, and submitted corrections.',
  })

  const activeTab = getActiveTab(location.hash)

  const sectionClassName =
    'rounded-3xl border border-[#c7d2df] bg-white p-6 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] sm:p-8'
  const itemClassName = 'rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-4 py-4'
  const mutedLabelClassName = 'text-xs font-semibold uppercase tracking-[0.12em] text-slate-500'
  const valueClassName = 'mt-1 text-sm text-black'
  const disabledActionClassName =
    'inline-flex min-h-[38px] items-center justify-center rounded-full border border-[#c7d2df] bg-[#f8fafc] px-4 py-2 text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-50 disabled:cursor-not-allowed disabled:opacity-70'
  const tabClassName = (tab: ActivityTab) =>
    `inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-50 ${
      activeTab === tab
        ? 'border-[#c7d2df] bg-[#f8fafc] text-black'
        : 'border-transparent bg-transparent text-slate-500'
    }`

  return (
    <div className="min-h-screen bg-[#eef4fa] text-black">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:py-12">
        <section className="mb-8">
          <div className="inline-flex items-center rounded-full border border-[#c7d2df] bg-white px-3 py-1 text-xs font-semibold text-blue-700">
            UI Preview
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-black sm:text-3xl">My Activity</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black sm:text-base">
            Review your customer-side activity history across ratings, reports, and submitted corrections.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate('/customer/my-activity#reviews')}
              className={tabClassName('reviews')}
            >
              Ratings & Reviews
            </button>
            <button
              type="button"
              onClick={() => navigate('/customer/my-activity#reports')}
              className={tabClassName('reports')}
            >
              Reported Profiles
            </button>
            <button
              type="button"
              onClick={() => navigate('/customer/my-activity#corrections')}
              className={tabClassName('corrections')}
            >
              Submitted Corrections
            </button>
          </div>
        </section>

        <div className="space-y-6">
          {activeTab === 'reviews' && (
            <section className={sectionClassName}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-black sm:text-xl">Ratings & Reviews</h2>
                <p className="mt-1 text-sm text-black">Frontend-only sample layout for your review history.</p>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              {sampleReviews.length > 0 ? (
                sampleReviews.map((review) => (
                  <article key={`${review.businessName}-${review.reviewDate}`} className={itemClassName}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-black">{review.businessName}</p>
                        <div className="mt-2 flex items-center gap-1.5" aria-label={`${review.rating} out of 5 stars`}>
                          {Array.from({ length: 5 }, (_, index) => (
                            <svg
                              key={`${review.businessName}-star-${index}`}
                              className={`h-4 w-4 ${index < review.rating ? 'text-amber-500' : 'text-slate-300'}`}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                              aria-hidden="true"
                            >
                              <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.1 3.38a1 1 0 0 0 .95.69h3.55c.97 0 1.37 1.24.59 1.81l-2.88 2.1a1 1 0 0 0-.36 1.12l1.1 3.39c.3.92-.76 1.68-1.54 1.12l-2.88-2.1a1 1 0 0 0-1.18 0l-2.88 2.1c-.78.56-1.84-.2-1.54-1.12l1.1-3.39a1 1 0 0 0-.36-1.12l-2.88-2.1C2.08 8.24 2.48 7 3.45 7H7a1 1 0 0 0 .95-.69z" />
                            </svg>
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-slate-500">{review.reviewDate}</p>
                    </div>

                    <div className="mt-4">
                      <p className={mutedLabelClassName}>Review text</p>
                      <p className={valueClassName}>{review.reviewText}</p>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <button type="button" className={disabledActionClassName} disabled>
                        Edit Review
                      </button>
                      <button type="button" className={disabledActionClassName} disabled>
                        Delete Review
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className={itemClassName}>
                  <p className="text-sm text-black">No ratings or reviews yet.</p>
                </div>
              )}
            </div>
            </section>
          )}

          {activeTab === 'reports' && (
            <section className={sectionClassName}>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-black sm:text-xl">Reported Profiles</h2>
              <p className="mt-1 text-sm text-black">Frontend-only sample layout for profile reports you have submitted.</p>
            </div>
            <div className="mt-5 space-y-4">
              {sampleReports.length > 0 ? (
                sampleReports.map((report) => (
                  <article key={`${report.businessName}-${report.reportDate}`} className={itemClassName}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-base font-semibold text-black">{report.businessName}</p>
                        <p className="mt-1 text-sm text-black">{report.reportReason}</p>
                      </div>
                      <span className={`inline-flex self-start rounded-full px-3 py-1 text-xs font-semibold ${statusPillClass(report.reportStatus)}`}>
                        {report.reportStatus}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <p className={mutedLabelClassName}>Report reason</p>
                        <p className={valueClassName}>{report.reportReason}</p>
                      </div>
                      <div>
                        <p className={mutedLabelClassName}>Report date</p>
                        <p className={valueClassName}>{report.reportDate}</p>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className={itemClassName}>
                  <p className="text-sm text-black">No reported profiles yet.</p>
                </div>
              )}
            </div>
            </section>
          )}

          {activeTab === 'corrections' && (
            <section className={sectionClassName}>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-black sm:text-xl">Submitted Corrections</h2>
              <p className="mt-1 text-sm text-black">Frontend-only sample layout for business corrections you have submitted.</p>
            </div>
            <div className="mt-5 space-y-4">
              {sampleCorrections.length > 0 ? (
                sampleCorrections.map((correction) => (
                  <article key={`${correction.businessName}-${correction.submittedDate}`} className={itemClassName}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-base font-semibold text-black">{correction.businessName}</p>
                        <p className="mt-1 text-sm text-black">{correction.correctionType}</p>
                      </div>
                      <span className={`inline-flex self-start rounded-full px-3 py-1 text-xs font-semibold ${statusPillClass(correction.correctionStatus)}`}>
                        {correction.correctionStatus}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <p className={mutedLabelClassName}>Correction type</p>
                        <p className={valueClassName}>{correction.correctionType}</p>
                      </div>
                      <div>
                        <p className={mutedLabelClassName}>Submitted date</p>
                        <p className={valueClassName}>{correction.submittedDate}</p>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className={itemClassName}>
                  <p className="text-sm text-black">No submitted corrections yet.</p>
                </div>
              )}
            </div>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}

export default CustomerMyActivityPage
