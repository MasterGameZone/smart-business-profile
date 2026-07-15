import { useLocation, useNavigate } from 'react-router-dom'
import { usePageMeta } from '../hooks/usePageMeta.ts'

type HelpFeedbackTab = 'help' | 'report' | 'feedback'

interface HelpItem {
  title: string
  description: string
}

const helpItems: HelpItem[] = [
  { title: 'Frequently Asked Questions', description: 'Quick answers to common customer questions.' },
  { title: 'Account Help', description: 'Guidance for account access, profile details, and settings.' },
  { title: 'Saved Businesses Help', description: 'Learn how saved businesses and favorites work.' },
  { title: 'Reviews and Reports Help', description: 'Understand ratings, profile reports, and submitted corrections.' },
  { title: 'Community Features Help', description: 'Preview how community contributions and support features will work.' },
  { title: 'Contact Support', description: 'Reach the support team in a future update.' },
]

const problemCategories = [
  'Account issue',
  'Business profile issue',
  'Search or directory issue',
  'Saved businesses issue',
  'Reviews or reports issue',
  'Community feature issue',
  'Other',
]

const feedbackTypes = [
  'General feedback',
  'Feature suggestion',
  'Design feedback',
  'Bug feedback',
  'Category suggestion',
  'Other',
]

const satisfactionLevels = ['Very satisfied', 'Satisfied', 'Neutral', 'Unsatisfied', 'Very unsatisfied']

function getActiveTab(hash: string): HelpFeedbackTab {
  if (hash === '#report') return 'report'
  if (hash === '#feedback') return 'feedback'
  return 'help'
}

function CustomerHelpFeedbackPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const activeTab = getActiveTab(location.hash)

  usePageMeta({
    title: 'Help & Feedback | Smart Business Profile',
    description: 'Find answers, report a problem, or share your feedback.',
  })

  const sectionClassName =
    'rounded-3xl border border-[#c7d2df] bg-white p-6 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] sm:p-8'
  const fieldClassName =
    'w-full rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-4 py-3 text-sm text-black placeholder:text-slate-400 focus:outline-none'
  const labelClassName = 'mb-2 block text-sm font-medium text-black'
  const disabledButtonClassName =
    'inline-flex min-h-[42px] items-center justify-center rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70'
  const tabButtonClassName =
    'inline-flex min-h-[42px] items-center justify-center rounded-full border px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-50'

  const tabs: Array<{ id: HelpFeedbackTab; label: string }> = [
    { id: 'help', label: 'Help & Support' },
    { id: 'report', label: 'Report a Problem' },
    { id: 'feedback', label: 'Share Feedback' },
  ]

  return (
    <div className="min-h-screen bg-[#eef4fa] text-black">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:py-12">
        <section className="mb-8">
          <div className="inline-flex items-center rounded-full border border-[#c7d2df] bg-white px-3 py-1 text-xs font-semibold text-blue-700">
            UI Preview
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-black sm:text-3xl">Help & Feedback</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black sm:text-base">
            Find answers, report a problem, or share your feedback.
          </p>
        </section>

        <div className="mb-6 flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                type="button"
                className={`${tabButtonClassName} ${
                  isActive
                    ? 'border-[#c7d2df] bg-[#f8fafc] text-black'
                    : 'border-transparent bg-transparent text-slate-500'
                }`}
                onClick={() => navigate(`/customer/help-feedback#${tab.id}`)}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        <div>
          {activeTab === 'help' && (
            <section id="help" className={sectionClassName}>
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-black sm:text-xl">Help & Support</h2>
              <p className="text-sm text-black">
                Browse common support topics and preview how customer help resources will be organized.
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {helpItems.map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-4 rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-4 py-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#c7d2df] bg-white text-slate-500">
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path d="M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
                      <path
                        d="M9.09 9a3 3 0 1 1 5.82 1c0 2-3 2-3 4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-black sm:text-base">{item.title}</h3>
                        <p className="mt-1 text-sm text-black">{item.description}</p>
                      </div>
                      <span className="pt-0.5 text-slate-400" aria-hidden="true">
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M7.22 4.22a.75.75 0 0 1 1.06 0l5.25 5.25a.75.75 0 0 1 0 1.06l-5.25 5.25a.75.75 0 1 1-1.06-1.06L11.94 10 7.22 5.28a.75.75 0 0 1 0-1.06Z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            </section>
          )}

          {activeTab === 'report' && (
            <section id="report" className={sectionClassName}>
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-black sm:text-xl">Report a Problem</h2>
              <p className="text-sm text-black">Share a problem in a UI-only preview of the future support workflow.</p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4">
              <div>
                <label className={labelClassName}>Problem category</label>
                <select className={fieldClassName} defaultValue={problemCategories[0]}>
                  {problemCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClassName}>Short description</label>
                <input className={fieldClassName} defaultValue="" placeholder="Briefly describe the issue" />
              </div>
              <div>
                <label className={labelClassName}>Detailed message</label>
                <textarea
                  className={`${fieldClassName} min-h-[140px] resize-none`}
                  defaultValue=""
                  placeholder="Add more context about the issue"
                />
              </div>
              <div className="pt-1">
                <button type="button" className={disabledButtonClassName} disabled>
                  Submit Report
                </button>
              </div>
            </div>
            </section>
          )}

          {activeTab === 'feedback' && (
            <section id="feedback" className={sectionClassName}>
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-black sm:text-xl">Share Feedback</h2>
              <p className="text-sm text-black">
                Preview the customer feedback experience for product ideas, suggestions, and design feedback.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4">
              <div>
                <label className={labelClassName}>Feedback type</label>
                <select className={fieldClassName} defaultValue={feedbackTypes[0]}>
                  {feedbackTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClassName}>Rating or satisfaction level</label>
                <div className="flex flex-wrap gap-2">
                  {satisfactionLevels.map((level, index) => (
                    <button
                      key={level}
                      type="button"
                      className={`inline-flex min-h-[38px] items-center justify-center rounded-full border px-4 py-2 text-sm font-medium ${
                        index === 1
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-[#c7d2df] bg-[#f8fafc] text-black'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClassName}>Feedback message</label>
                <textarea
                  className={`${fieldClassName} min-h-[140px] resize-none`}
                  defaultValue=""
                  placeholder="Share what is working well or what should improve"
                />
              </div>
              <div className="pt-1">
                <button type="button" className={disabledButtonClassName} disabled>
                  Submit Feedback
                </button>
              </div>
            </div>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}

export default CustomerHelpFeedbackPage
