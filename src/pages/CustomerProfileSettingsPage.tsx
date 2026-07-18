import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.tsx'
import { usePageMeta } from '../hooks/usePageMeta.ts'
import {
  changeAuthenticatedPassword,
  getCurrentUser,
  resendVerificationEmail,
  resetPassword,
} from '../lib/authService.ts'
import { getCustomerProfile, saveCustomerProfile } from '../lib/customerProfileService.ts'
import type { CustomerProfileFormValues } from '../types/customerProfile.ts'

const emptyProfileFormValues: CustomerProfileFormValues = {
  customerName: '',
  phoneNumber: '',
  preferredCity: '',
  preferredArea: '',
}

type SecurityActionState = 'idle' | 'loading' | 'success' | 'error'

interface CustomerChangePasswordErrors {
  currentPassword?: string
  newPassword?: string
  confirmPassword?: string
  submit?: string
}

function CustomerProfileSettingsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isBusinessOwnerEnabled, setPreferredAccountMode } = useAuth()
  const [profileValues, setProfileValues] = useState<CustomerProfileFormValues>(emptyProfileFormValues)
  const [isProfileLoading, setIsProfileLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isEmailVerified, setIsEmailVerified] = useState(Boolean(user?.email_confirmed_at))
  const [verificationEmailState, setVerificationEmailState] = useState<SecurityActionState>('idle')
  const [verificationEmailMessage, setVerificationEmailMessage] = useState('')
  const [passwordResetState, setPasswordResetState] = useState<SecurityActionState>('idle')
  const [passwordResetMessage, setPasswordResetMessage] = useState('')
  const [isCustomerChangePasswordModalOpen, setIsCustomerChangePasswordModalOpen] = useState(false)
  const [customerCurrentPasswordValue, setCustomerCurrentPasswordValue] = useState('')
  const [customerNewPasswordValue, setCustomerNewPasswordValue] = useState('')
  const [customerConfirmPasswordValue, setCustomerConfirmPasswordValue] = useState('')
  const [customerChangePasswordErrors, setCustomerChangePasswordErrors] = useState<CustomerChangePasswordErrors>({})
  const [customerChangePasswordSuccess, setCustomerChangePasswordSuccess] = useState(false)
  const [isCustomerChangePasswordSubmitting, setIsCustomerChangePasswordSubmitting] = useState(false)
  const [isCustomerPasswordResetEmailSubmitting, setIsCustomerPasswordResetEmailSubmitting] = useState(false)
  const [customerPasswordResetEmailSuccess, setCustomerPasswordResetEmailSuccess] = useState('')
  const [customerPasswordResetEmailError, setCustomerPasswordResetEmailError] = useState('')
  const [customerSecuritySuccessMessage, setCustomerSecuritySuccessMessage] = useState('')
  const customerChangePasswordButtonRef = useRef<HTMLButtonElement | null>(null)
  const customerCurrentPasswordInputRef = useRef<HTMLInputElement | null>(null)

  usePageMeta({
    title: 'Profile & Settings | Smart Business Profile',
    description: 'View your customer profile, preferences, and account settings.',
  })

  const emailAddress = user?.email ?? ''

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

  useEffect(() => {
    let isMounted = true

    const refreshEmailVerificationStatus = async () => {
      if (!user) {
        setIsEmailVerified(false)
        return
      }

      setIsEmailVerified(Boolean(user.email_confirmed_at))

      const currentUser = await getCurrentUser()
      if (!isMounted || currentUser?.id !== user.id) {
        return
      }

      setIsEmailVerified(Boolean(currentUser.email_confirmed_at))
    }

    void refreshEmailVerificationStatus()

    return () => {
      isMounted = false
    }
  }, [user])

  useEffect(() => {
    if (!isCustomerChangePasswordModalOpen) {
      return undefined
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.requestAnimationFrame(() => {
      customerCurrentPasswordInputRef.current?.focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !isCustomerChangePasswordSubmitting &&
        !isCustomerPasswordResetEmailSubmitting
      ) {
        resetCustomerChangePasswordModal()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    isCustomerChangePasswordModalOpen,
    isCustomerChangePasswordSubmitting,
    isCustomerPasswordResetEmailSubmitting,
  ])

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

  const handleResendVerificationEmail = async () => {
    if (verificationEmailState === 'loading') {
      return
    }

    if (!emailAddress) {
      setVerificationEmailState('error')
      setVerificationEmailMessage('No email address is available for this account.')
      return
    }

    if (isEmailVerified) {
      setVerificationEmailState('success')
      setVerificationEmailMessage('Your email address is already verified.')
      return
    }

    setVerificationEmailState('loading')
    setVerificationEmailMessage('')

    const { error } = await resendVerificationEmail(emailAddress)

    if (error) {
      setVerificationEmailState('error')
      setVerificationEmailMessage(error)
      return
    }

    setVerificationEmailState('success')
    setVerificationEmailMessage('Verification email sent. Please check your inbox.')
  }

  const handleSendPasswordResetEmail = async () => {
    if (passwordResetState === 'loading') {
      return
    }

    if (!emailAddress) {
      setPasswordResetState('error')
      setPasswordResetMessage('No email address is available for this account.')
      return
    }

    setPasswordResetState('loading')
    setPasswordResetMessage('')

    const { error } = await resetPassword(emailAddress)

    if (error) {
      setPasswordResetState('error')
      setPasswordResetMessage(error)
      return
    }

    setPasswordResetState('success')
    setPasswordResetMessage('Password reset email sent. Please check your inbox.')
  }

  const canSave = Boolean(user) && !isProfileLoading && !isSaving
  const isVerificationEmailLoading = verificationEmailState === 'loading'
  const isPasswordResetLoading = passwordResetState === 'loading'
  const canResendVerificationEmail = !isEmailVerified && !isVerificationEmailLoading
  const canSendPasswordResetEmail = !isPasswordResetLoading
  const readOnlyFieldClassName =
    'w-full rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-4 py-3 text-sm text-black placeholder:text-slate-400 focus:outline-none'
  const editableFieldClassName =
    'w-full rounded-2xl border border-[#c7d2df] bg-white px-4 py-3 text-sm text-black placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:text-slate-500'
  const secondaryActionClassName =
    'inline-flex min-h-[42px] min-w-[132px] items-center justify-center rounded-full border border-sky-200 bg-blue-50 px-5 py-2.5 text-sm font-semibold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-[#c7d2df] disabled:bg-[#f8fafc] disabled:text-slate-500 disabled:opacity-80'

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

  const resetCustomerChangePasswordModal = (): void => {
    setCustomerCurrentPasswordValue('')
    setCustomerNewPasswordValue('')
    setCustomerConfirmPasswordValue('')
    setCustomerChangePasswordErrors({})
    setCustomerChangePasswordSuccess(false)
    setIsCustomerChangePasswordSubmitting(false)
    setIsCustomerPasswordResetEmailSubmitting(false)
    setCustomerPasswordResetEmailSuccess('')
    setCustomerPasswordResetEmailError('')
    setIsCustomerChangePasswordModalOpen(false)
    window.requestAnimationFrame(() => {
      customerChangePasswordButtonRef.current?.focus()
    })
  }

  const handleCustomerChangePasswordSubmit = async (): Promise<void> => {
    if (isCustomerChangePasswordSubmitting) {
      return
    }

    const nextErrors: CustomerChangePasswordErrors = {}

    if (!customerCurrentPasswordValue) {
      nextErrors.currentPassword = 'Current Password is required.'
    }

    if (!customerNewPasswordValue) {
      nextErrors.newPassword = 'New Password is required.'
    } else if (customerNewPasswordValue.length < 8) {
      nextErrors.newPassword = 'New Password must contain at least 8 characters.'
    }

    if (!customerConfirmPasswordValue) {
      nextErrors.confirmPassword = 'Confirm New Password is required.'
    } else if (customerNewPasswordValue && customerConfirmPasswordValue !== customerNewPasswordValue) {
      nextErrors.confirmPassword = 'New Password and Confirm New Password must match.'
    }

    if (
      customerCurrentPasswordValue &&
      customerNewPasswordValue &&
      customerCurrentPasswordValue === customerNewPasswordValue
    ) {
      nextErrors.newPassword = 'New Password must be different from Current Password.'
    }

    setCustomerChangePasswordErrors(nextErrors)
    setCustomerChangePasswordSuccess(false)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setIsCustomerChangePasswordSubmitting(true)

    try {
      const { error } = await changeAuthenticatedPassword(customerCurrentPasswordValue, customerNewPasswordValue)

      if (error) {
        setCustomerChangePasswordErrors({ submit: error })
        return
      }

      setCustomerCurrentPasswordValue('')
      setCustomerNewPasswordValue('')
      setCustomerConfirmPasswordValue('')
      setCustomerChangePasswordErrors({})
      setCustomerChangePasswordSuccess(true)
    } catch {
      setCustomerChangePasswordErrors({
        submit: 'We could not change your password. Please try again.',
      })
    } finally {
      setIsCustomerChangePasswordSubmitting(false)
    }
  }

  const getCustomerPasswordResetEmailErrorMessage = (error: string): string => {
    const message = error.toLowerCase()

    if (message.includes('session') || message.includes('log in')) {
      return 'Your session has expired. Please log in again and retry.'
    }

    if (message.includes('too many') || message.includes('rate limit')) {
      return 'Too many reset requests were made. Please wait before trying again.'
    }

    if (message.includes('network') || message.includes('connection')) {
      return 'We could not send the reset link. Check your connection and try again.'
    }

    return 'We could not send the password reset link. Please try again.'
  }

  const handleCustomerForgotCurrentPassword = async (): Promise<void> => {
    if (isCustomerPasswordResetEmailSubmitting) {
      return
    }

    setCustomerPasswordResetEmailSuccess('')
    setCustomerPasswordResetEmailError('')
    setCustomerSecuritySuccessMessage('')

    if (!user) {
      setCustomerPasswordResetEmailError('Your session has expired. Please log in again and retry.')
      return
    }

    if (!emailAddress) {
      setCustomerPasswordResetEmailError('We could not find an email address for this account.')
      return
    }

    setIsCustomerPasswordResetEmailSubmitting(true)

    try {
      const { error } = await resetPassword(emailAddress)

      if (error) {
        setCustomerPasswordResetEmailError(getCustomerPasswordResetEmailErrorMessage(error))
        return
      }

      setCustomerSecuritySuccessMessage('We sent a password reset link to your registered email address.')
      resetCustomerChangePasswordModal()
    } catch {
      setCustomerPasswordResetEmailError('We could not send the password reset link. Please try again.')
    } finally {
      setIsCustomerPasswordResetEmailSubmitting(false)
    }
  }

  const handleSecurityBack = (): void => {
    window.sessionStorage.setItem('smart-business-profile:open-customer-settings', 'true')
    navigate('/')
  }

  if (location.hash === '#security') {
    return (
      <div className="min-h-screen bg-[#eef4fa] text-black">
        <main className="mx-auto max-w-4xl px-4 py-10 sm:py-12">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h1 className="text-sm font-semibold text-[#0f172a]">Security</h1>
            <button
              type="button"
              onClick={handleSecurityBack}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              <span>Back</span>
            </button>
          </div>

          <section className="space-y-3">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex w-full items-center justify-between border-b border-slate-100/90 px-3 py-3 text-left text-sm text-[#0f172a] opacity-80">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.32 1.77.59 2.61a2 2 0 0 1-.45 2.11L8 9.69a16 16 0 0 0 6.31 6.31l1.25-1.25a2 2 0 0 1 2.11-.45c.84.27 1.71.47 2.61.59A2 2 0 0 1 22 16.92Z" />
                    </svg>
                  </span>
                  <span className="font-medium">Change Phone Number</span>
                </span>
                <span className="ml-3 shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                  Coming Soon
                </span>
              </div>

              <div className="flex w-full items-center justify-between border-b border-slate-100/90 px-3 py-3 text-left text-sm text-[#0f172a] opacity-80">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16v12H4z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4 7 8 6 8-6" />
                    </svg>
                  </span>
                  <span className="font-medium">Change Email Address</span>
                </span>
                <span className="ml-3 shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                  Coming Soon
                </span>
              </div>

              <button
                ref={customerChangePasswordButtonRef}
                type="button"
                onClick={() => {
                  setCustomerChangePasswordErrors({})
                  setCustomerChangePasswordSuccess(false)
                  setCustomerSecuritySuccessMessage('')
                  setIsCustomerChangePasswordModalOpen(true)
                }}
                className="flex w-full items-center justify-between px-3 py-3 text-left text-sm text-[#0f172a] transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 10V8a5 5 0 0 1 10 0v2" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 10h12v10H6z" />
                    </svg>
                  </span>
                  <span className="font-medium">Change Password</span>
                </span>
                <span className="ml-3 shrink-0 text-slate-400" aria-hidden="true">&gt;</span>
              </button>
            </div>
            {customerSecuritySuccessMessage ? (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-3">
                <p className="text-sm font-semibold text-emerald-800" aria-live="polite">
                  {customerSecuritySuccessMessage}
                </p>
              </div>
            ) : null}
          </section>
          {isCustomerChangePasswordModalOpen ? (
            <div
              className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-slate-950/30 p-4 backdrop-blur-sm"
              onMouseDown={(event) => {
                if (
                  event.target === event.currentTarget &&
                  !isCustomerChangePasswordSubmitting &&
                  !isCustomerPasswordResetEmailSubmitting
                ) {
                  resetCustomerChangePasswordModal()
                }
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="customer-change-password-title"
                className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.5)] sm:p-5"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 id="customer-change-password-title" className="text-base font-semibold text-[#0f172a]">
                      Change Password
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      Enter your current password and choose a new password.
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close change password dialog"
                    onClick={resetCustomerChangePasswordModal}
                    disabled={isCustomerChangePasswordSubmitting || isCustomerPasswordResetEmailSubmitting}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18" />
                    </svg>
                  </button>
                </div>
                <form
                  className="mt-4"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void handleCustomerChangePasswordSubmit()
                  }}
                >
                  <label htmlFor="customer-current-password" className="block text-xs font-semibold text-slate-600">
                    Current Password
                  </label>
                  <input
                    ref={customerCurrentPasswordInputRef}
                    id="customer-current-password"
                    type="password"
                    autoComplete="current-password"
                    value={customerCurrentPasswordValue}
                    onChange={(event) => {
                      setCustomerCurrentPasswordValue(event.target.value)
                      setCustomerChangePasswordErrors((current) => ({
                        ...current,
                        currentPassword: undefined,
                        submit: undefined,
                      }))
                      setCustomerChangePasswordSuccess(false)
                    }}
                    disabled={isCustomerChangePasswordSubmitting}
                    aria-invalid={Boolean(customerChangePasswordErrors.currentPassword)}
                    aria-describedby={
                      customerChangePasswordErrors.currentPassword ? 'customer-current-password-error' : undefined
                    }
                    className={editableFieldClassName}
                  />
                  {customerChangePasswordErrors.currentPassword ? (
                    <p id="customer-current-password-error" className="mt-1.5 text-xs text-rose-700">
                      {customerChangePasswordErrors.currentPassword}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleCustomerForgotCurrentPassword()}
                    disabled={isCustomerPasswordResetEmailSubmitting || isCustomerChangePasswordSubmitting}
                    className="mt-2 inline-flex text-xs font-semibold text-sky-700 underline-offset-2 transition hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:text-slate-500 disabled:no-underline"
                  >
                    {isCustomerPasswordResetEmailSubmitting ? 'Sending reset link...' : 'Forgot current password?'}
                  </button>
                  {customerPasswordResetEmailSuccess ? (
                    <p className="mt-2 text-xs text-emerald-700" aria-live="polite">
                      {customerPasswordResetEmailSuccess}
                    </p>
                  ) : null}
                  {customerPasswordResetEmailError ? (
                    <p className="mt-2 text-xs text-rose-700" role="alert">
                      {customerPasswordResetEmailError}
                    </p>
                  ) : null}

                  <label htmlFor="customer-new-password" className="mt-4 block text-xs font-semibold text-slate-600">
                    New Password
                  </label>
                  <input
                    id="customer-new-password"
                    type="password"
                    autoComplete="new-password"
                    value={customerNewPasswordValue}
                    onChange={(event) => {
                      setCustomerNewPasswordValue(event.target.value)
                      setCustomerChangePasswordErrors((current) => ({
                        ...current,
                        newPassword: undefined,
                        submit: undefined,
                      }))
                      setCustomerChangePasswordSuccess(false)
                    }}
                    disabled={isCustomerChangePasswordSubmitting}
                    aria-invalid={Boolean(customerChangePasswordErrors.newPassword)}
                    aria-describedby={
                      customerChangePasswordErrors.newPassword ? 'customer-new-password-error' : undefined
                    }
                    className={editableFieldClassName}
                  />
                  {customerChangePasswordErrors.newPassword ? (
                    <p id="customer-new-password-error" className="mt-1.5 text-xs text-rose-700">
                      {customerChangePasswordErrors.newPassword}
                    </p>
                  ) : null}

                  <label htmlFor="customer-confirm-password" className="mt-4 block text-xs font-semibold text-slate-600">
                    Confirm New Password
                  </label>
                  <input
                    id="customer-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={customerConfirmPasswordValue}
                    onChange={(event) => {
                      setCustomerConfirmPasswordValue(event.target.value)
                      setCustomerChangePasswordErrors((current) => ({
                        ...current,
                        confirmPassword: undefined,
                        submit: undefined,
                      }))
                      setCustomerChangePasswordSuccess(false)
                    }}
                    disabled={isCustomerChangePasswordSubmitting}
                    aria-invalid={Boolean(customerChangePasswordErrors.confirmPassword)}
                    aria-describedby={
                      customerChangePasswordErrors.confirmPassword ? 'customer-confirm-password-error' : undefined
                    }
                    className={editableFieldClassName}
                  />
                  {customerChangePasswordErrors.confirmPassword ? (
                    <p id="customer-confirm-password-error" className="mt-1.5 text-xs text-rose-700">
                      {customerChangePasswordErrors.confirmPassword}
                    </p>
                  ) : null}

                  {customerChangePasswordErrors.submit ? (
                    <p className="mt-3 text-xs text-rose-700">{customerChangePasswordErrors.submit}</p>
                  ) : null}
                  {customerChangePasswordSuccess ? (
                    <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-3">
                      <p className="text-sm font-semibold text-emerald-800">Password changed successfully.</p>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={resetCustomerChangePasswordModal}
                      disabled={isCustomerChangePasswordSubmitting || isCustomerPasswordResetEmailSubmitting}
                      className="inline-flex justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isCustomerChangePasswordSubmitting}
                      className="inline-flex justify-center rounded-full border border-sky-200 bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isCustomerChangePasswordSubmitting ? 'Changing...' : 'Change Password'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </main>
      </div>
    )
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

          <section
            id="security"
            className="rounded-3xl border border-[#c7d2df] bg-white p-6 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] sm:p-8"
          >
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
                  {isEmailVerified ? 'Verified' : 'Not verified'}
                </span>
              </div>

              <div className="rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-black">Resend verification email</p>
                    <p className="mt-1 text-sm text-black">
                      {isEmailVerified
                        ? 'Your email is already verified.'
                        : 'Send a new verification email to your account email address.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={secondaryActionClassName}
                    disabled={!canResendVerificationEmail}
                    aria-busy={isVerificationEmailLoading}
                    onClick={() => void handleResendVerificationEmail()}
                  >
                    {isEmailVerified ? 'Already Verified' : isVerificationEmailLoading ? 'Sending...' : 'Resend Email'}
                  </button>
                </div>
                {verificationEmailMessage && (
                  <p
                    className={`mt-3 rounded-2xl px-4 py-3 text-sm font-medium ${
                      verificationEmailState === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {verificationEmailMessage}
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-black">Send password reset email</p>
                    <p className="mt-1 text-sm text-black">Send a reset link to your account email address.</p>
                  </div>
                  <button
                    type="button"
                    className={secondaryActionClassName}
                    disabled={!canSendPasswordResetEmail}
                    aria-busy={isPasswordResetLoading}
                    onClick={() => void handleSendPasswordResetEmail()}
                  >
                    {isPasswordResetLoading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </div>
                {passwordResetMessage && (
                  <p
                    className={`mt-3 rounded-2xl px-4 py-3 text-sm font-medium ${
                      passwordResetState === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {passwordResetMessage}
                  </p>
                )}
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
