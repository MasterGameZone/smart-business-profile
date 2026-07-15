import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.tsx'
import { usePageMeta } from '../hooks/usePageMeta.ts'
import { getCustomerProfile, saveCustomerProfile } from '../lib/customerProfileService.ts'
import type { CustomerProfileFormValues } from '../types/customerProfile.ts'

const emptyProfileFormValues: CustomerProfileFormValues = {
  customerName: '',
  phoneNumber: '',
  preferredCity: '',
  preferredArea: '',
}

function CustomerProfileSettingsPage() {
  const navigate = useNavigate()
  const { user, isBusinessOwnerEnabled, setPreferredAccountMode } = useAuth()
  const [profileValues, setProfileValues] = useState<CustomerProfileFormValues>(emptyProfileFormValues)
  const [isProfileLoading, setIsProfileLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  usePageMeta({
    title: 'Profile & Settings | Smart Business Profile',
    description: 'View your customer profile, preferences, and account settings.',
  })

  const emailAddress = user?.email ?? ''
  const isEmailVerified = Boolean(user?.email_confirmed_at)

  useEffect(() => {
    let isMounted = true

    const loadProfile = async () => {
      if (!user) {
        setProfileValues(emptyProfileFormValues)
        setIsProfileLoading(false)
        return
      }

      setIsProfileLoading(true)
      setErrorMessage('')
      setSuccessMessage('')

      try {
        const profile = await getCustomerProfile(user.id)
        if (!isMounted) return

        setProfileValues({
          customerName: profile?.customer_name ?? '',
          phoneNumber: profile?.phone_number ?? '',
          preferredCity: profile?.preferred_city ?? '',
          preferredArea: profile?.preferred_area ?? '',
        })
      } catch {
        if (!isMounted) return
        setProfileValues(emptyProfileFormValues)
        setErrorMessage('Unable to load your profile details right now. Please try again.')
      } finally {
        if (isMounted) {
          setIsProfileLoading(false)
        }
      }
    }

    void loadProfile()

    return () => {
      isMounted = false
    }
  }, [user])

  const updateProfileValue = (field: keyof CustomerProfileFormValues, value: string) => {
    setProfileValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }))
    setSuccessMessage('')
    setErrorMessage('')
  }

  const handleSaveChanges = async () => {
    if (!user || isSaving) {
      return
    }

    setIsSaving(true)
    setSuccessMessage('')
    setErrorMessage('')

    try {
      const savedProfile = await saveCustomerProfile(user.id, profileValues)
      setProfileValues({
        customerName: savedProfile.customer_name ?? '',
        phoneNumber: savedProfile.phone_number ?? '',
        preferredCity: savedProfile.preferred_city ?? '',
        preferredArea: savedProfile.preferred_area ?? '',
      })
      setSuccessMessage('Your profile settings have been saved.')
    } catch {
      setErrorMessage('Unable to save your profile settings right now. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const canSave = Boolean(user) && !isProfileLoading && !isSaving
  const readOnlyFieldClassName =
    'w-full rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-4 py-3 text-sm text-black placeholder:text-slate-400 focus:outline-none'
  const editableFieldClassName =
    'w-full rounded-2xl border border-[#c7d2df] bg-white px-4 py-3 text-sm text-black placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:text-slate-500'
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
                <label htmlFor="customerName" className="mb-2 block text-sm font-medium text-black">
                  Customer name
                </label>
                <input
                  id="customerName"
                  className={editableFieldClassName}
                  value={profileValues.customerName}
                  placeholder={isProfileLoading ? 'Loading...' : 'Enter your name'}
                  disabled={isProfileLoading || isSaving}
                  onChange={(event) => updateProfileValue('customerName', event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="phoneNumber" className="mb-2 block text-sm font-medium text-black">
                  Phone number
                </label>
                <input
                  id="phoneNumber"
                  className={editableFieldClassName}
                  value={profileValues.phoneNumber}
                  placeholder={isProfileLoading ? 'Loading...' : 'Enter your phone number'}
                  disabled={isProfileLoading || isSaving}
                  onChange={(event) => updateProfileValue('phoneNumber', event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="emailAddress" className="mb-2 block text-sm font-medium text-black">
                  Email address
                </label>
                <input
                  id="emailAddress"
                  className={readOnlyFieldClassName}
                  value={emailAddress}
                  placeholder="Not available yet"
                  readOnly
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-[#c7d2df] bg-white p-6 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] sm:p-8">
            <h2 className="text-lg font-semibold tracking-tight text-black sm:text-xl">Location Preferences</h2>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="preferredCity" className="mb-2 block text-sm font-medium text-black">
                  Preferred city
                </label>
                <input
                  id="preferredCity"
                  className={editableFieldClassName}
                  value={profileValues.preferredCity}
                  placeholder={isProfileLoading ? 'Loading...' : 'Enter preferred city'}
                  disabled={isProfileLoading || isSaving}
                  onChange={(event) => updateProfileValue('preferredCity', event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="preferredArea" className="mb-2 block text-sm font-medium text-black">
                  Preferred area/locality
                </label>
                <input
                  id="preferredArea"
                  className={editableFieldClassName}
                  value={profileValues.preferredArea}
                  placeholder={isProfileLoading ? 'Loading...' : 'Enter preferred area or locality'}
                  disabled={isProfileLoading || isSaving}
                  onChange={(event) => updateProfileValue('preferredArea', event.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-[#c7d2df] bg-white p-6 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-black sm:text-xl">Save Changes</h2>
                <p className="mt-1 text-sm text-black">
                  {isProfileLoading ? 'Loading your saved profile details.' : 'Save your customer profile and location preferences.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleSaveChanges()}
                disabled={!canSave}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-blue-600 bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-blue-300 disabled:bg-blue-300"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
            {(successMessage || errorMessage) && (
              <p
                className={`mt-4 rounded-2xl px-4 py-3 text-sm font-medium ${
                  successMessage ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}
              >
                {successMessage || errorMessage}
              </p>
            )}
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
