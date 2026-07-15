import { useNavigate } from 'react-router-dom'
import AppHeader from '../components/AppHeader.tsx'
import { useAuth } from '../context/AuthContext.tsx'
import { usePageMeta } from '../hooks/usePageMeta.ts'

function getMetadataString(metadata: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

function CustomerProfileSettingsPage() {
  const navigate = useNavigate()
  const { user, isBusinessOwnerEnabled, setPreferredAccountMode } = useAuth()
  const userMetadata = (user?.user_metadata ?? {}) as Record<string, unknown>

  usePageMeta({
    title: 'Profile & Settings | Smart Business Profile',
    description: 'View your customer profile, preferences, and account settings.',
  })

  const customerName =
    getMetadataString(userMetadata, ['full_name', 'name', 'display_name']) ||
    (user?.email ? user.email.split('@')[0] : '')
  const phoneNumber = getMetadataString(userMetadata, ['phone', 'phone_number'])
  const emailAddress = user?.email ?? ''
  const preferredCity = getMetadataString(userMetadata, ['preferred_city', 'city', 'location'])
  const preferredArea = getMetadataString(userMetadata, ['preferred_area', 'area', 'locality', 'preferred_locality'])
  const isEmailVerified = Boolean(user?.email_confirmed_at)

  const readOnlyFieldClassName =
    'w-full rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-4 py-3 text-sm text-black placeholder:text-slate-400 focus:outline-none'
  const secondaryActionClassName =
    'inline-flex min-h-[42px] items-center justify-center rounded-full border border-[#c7d2df] bg-[#f8fafc] px-5 py-2.5 text-sm font-medium text-black focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-50 disabled:cursor-not-allowed disabled:opacity-70'

  const handleSwitchToBusinessMode = async () => {
    if (isBusinessOwnerEnabled) {
      try {
        await setPreferredAccountMode('business_owner')
        navigate('/business-home')
      } catch (error) {
        console.error('Failed to switch to Business Owner mode:', error)
      }
      return
    }

    navigate('/start-business')
  }

  return (
    <div className="min-h-screen bg-[#eef4fa] text-black">
      <AppHeader />

      <main className="mx-auto max-w-4xl px-4 py-10 sm:py-12">
        <section className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-black sm:text-3xl">Profile & Settings</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black sm:text-base">
            Review your customer details, location preferences, and account settings.
          </p>
        </section>

        <div className="space-y-6">
          <section className="rounded-3xl border border-[#c7d2df] bg-white p-6 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] sm:p-8">
            <h2 className="text-lg font-semibold tracking-tight text-black sm:text-xl">Profile Information</h2>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-black">Customer name</label>
                <input className={readOnlyFieldClassName} value={customerName} placeholder="Not available yet" readOnly />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-black">Phone number</label>
                <input className={readOnlyFieldClassName} value={phoneNumber} placeholder="Not available yet" readOnly />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-black">Email address</label>
                <input className={readOnlyFieldClassName} value={emailAddress} placeholder="Not available yet" readOnly />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-[#c7d2df] bg-white p-6 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] sm:p-8">
            <h2 className="text-lg font-semibold tracking-tight text-black sm:text-xl">Location Preferences</h2>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-black">Preferred city</label>
                <input className={readOnlyFieldClassName} value={preferredCity} placeholder="Not set yet" readOnly />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-black">Preferred area/locality</label>
                <input className={readOnlyFieldClassName} value={preferredArea} placeholder="Not set yet" readOnly />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-[#c7d2df] bg-white p-6 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] sm:p-8">
            <h2 className="text-lg font-semibold tracking-tight text-black sm:text-xl">Login & Security</h2>
            <div className="mt-5 space-y-4">
              <div className="flex flex-col gap-3 rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-black">Email verification status</p>
                  <p className="mt-1 text-sm text-black">
                    {isEmailVerified ? 'Your email is verified.' : 'Your email is not verified yet.'}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center self-start rounded-full px-3 py-1 text-xs font-semibold ${
                    isEmailVerified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {isEmailVerified ? 'Verified' : 'Pending'}
                </span>
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-black">Resend verification email</p>
                  <p className="mt-1 text-sm text-black">Available in a future update.</p>
                </div>
                <button type="button" className={secondaryActionClassName} disabled>
                  Coming Soon
                </button>
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-black">Send password reset email</p>
                  <p className="mt-1 text-sm text-black">Available in a future update.</p>
                </div>
                <button type="button" className={secondaryActionClassName} disabled>
                  Coming Soon
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-[#c7d2df] bg-white p-6 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] sm:p-8">
            <h2 className="text-lg font-semibold tracking-tight text-black sm:text-xl">Account Actions</h2>
            <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-black">Switch to Business Mode</p>
                <p className="mt-1 text-sm text-black">
                  {isBusinessOwnerEnabled
                    ? 'Open your existing business-owner workspace.'
                    : 'Continue to the business-owner setup flow.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleSwitchToBusinessMode()}
                className="inline-flex min-h-[42px] items-center justify-center rounded-full border border-sky-200 bg-blue-50 px-5 py-2.5 text-sm font-semibold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Switch to Business Mode
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

export default CustomerProfileSettingsPage
