import { useLocation, useNavigate } from 'react-router-dom'
import AppHeader from '../components/AppHeader.tsx'
import { usePageMeta } from '../hooks/usePageMeta.ts'

type CommunityTab = 'impact' | 'support' | 'shape'

function getActiveTab(hash: string): CommunityTab {
  if (hash === '#support') return 'support'
  if (hash === '#shape') return 'shape'
  return 'impact'
}

function CustomerCommunityPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const activeTab = getActiveTab(location.hash)

  usePageMeta({
    title: 'Your Local Community | Smart Business Profile',
    description: 'Support trusted businesses, track your contribution, and help shape the platform.',
  })

  const sectionClassName =
    'rounded-3xl border border-[#c7d2df] bg-white p-6 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] sm:p-8'
  const actionButtonClassName =
    'inline-flex min-h-[42px] items-center justify-center rounded-full border border-sky-200 bg-blue-50 px-5 py-2.5 text-sm font-semibold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70'
  const tabButtonClassName =
    'inline-flex min-h-[42px] items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'

  const tabs: Array<{ id: CommunityTab; label: string }> = [
    { id: 'impact', label: 'My Local Impact' },
    { id: 'support', label: 'Support a Business' },
    { id: 'shape', label: 'Shape the Platform' },
  ]

  return (
    <div className="min-h-screen bg-[#eef4fa] text-black">
      <AppHeader />

      <main className="mx-auto max-w-4xl px-4 py-10 sm:py-12">
        <section className="mb-8">
          <div className="inline-flex items-center rounded-full border border-[#c7d2df] bg-white px-3 py-1 text-xs font-semibold text-blue-700">
            Community Preview
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-black sm:text-3xl">Your Local Community</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black sm:text-base">
            Support trusted businesses, track your contribution, and help shape the platform.
          </p>
        </section>

        <div className="mb-6 flex flex-wrap gap-3">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                type="button"
                className={`${tabButtonClassName} ${
                  isActive
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-[#c7d2df] bg-white text-black'
                }`}
                onClick={() => navigate(`/customer/community#${tab.id}`)}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        <div>
          {activeTab === 'impact' && (
            <section id="impact" className={sectionClassName}>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-black sm:text-xl">My Local Impact</h2>
                <p className="mt-1 text-sm text-black">
                  A UI-only preview of how your community support can be recognized over time.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  Local Supporter
                </span>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  Level 1
                </span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Current supporter badge</p>
                <p className="mt-1 text-sm font-medium text-black">Local Supporter</p>
              </div>
              <div className="rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Current supporter level</p>
                <p className="mt-1 text-sm font-medium text-black">Level 1</p>
              </div>
              <div className="rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Businesses supported</p>
                <p className="mt-1 text-sm font-medium text-black">0</p>
              </div>
              <div className="rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Progress toward next level</p>
                <p className="mt-1 text-sm font-medium text-black">0%</p>
                <div className="mt-3 h-2 rounded-full bg-slate-200">
                  <div className="h-full w-0 rounded-full bg-blue-600" />
                </div>
              </div>
            </div>

            <div className="mt-5">
              <button type="button" className={actionButtonClassName} disabled>
                View Impact Details
              </button>
            </div>
            </section>
          )}

          {activeTab === 'support' && (
            <section id="support" className={sectionClassName}>
            <h2 className="text-lg font-semibold tracking-tight text-black sm:text-xl">Support a Business</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black sm:text-base">
              Know a trusted local business that is not listed yet? Help them build a professional digital presence.
            </p>

            <div className="mt-5 rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Community action</p>
              <p className="mt-1 text-sm text-black">Nominate a trusted local business</p>
            </div>

            <div className="mt-5">
              <button type="button" className={actionButtonClassName} disabled>
                Support a Business
              </button>
            </div>
            </section>
          )}

          {activeTab === 'shape' && (
            <section id="shape" className={sectionClassName}>
            <h2 className="text-lg font-semibold tracking-tight text-black sm:text-xl">Shape the Platform</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black sm:text-base">
              Help guide future improvements by previewing the kinds of community feedback the platform will support.
            </p>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-4 py-4">
                <p className="text-sm font-medium text-black">Vote on upcoming features</p>
              </div>
              <div className="rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-4 py-4">
                <p className="text-sm font-medium text-black">Submit feature suggestions</p>
              </div>
              <div className="rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-4 py-4">
                <p className="text-sm font-medium text-black">Suggest categories or improvements</p>
              </div>
            </div>

            <div className="mt-5">
              <button type="button" className={actionButtonClassName} disabled>
                Shape the Platform
              </button>
            </div>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}

export default CustomerCommunityPage
