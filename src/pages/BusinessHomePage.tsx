import AppHeader from '../components/AppHeader.tsx'
import { usePageMeta } from '../hooks/usePageMeta.ts'

function BusinessHomePage() {
  usePageMeta({
    title: 'Business Home | Smart Business Profile',
    description: 'Manage your business profiles from here.',
  })

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#020617_0%,#030712_34%,#020617_100%)] text-slate-100">
      <AppHeader />

      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <section className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] backdrop-blur-md sm:p-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">Business Home</h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-300 sm:text-base">
            Manage your business profiles from here.
          </p>
        </section>
      </main>
    </div>
  )
}

export default BusinessHomePage
