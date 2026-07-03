import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfile } from '../context/ProfileContext.tsx'
import { updateBusinessProfile } from '../lib/businessProfileService.ts'
import { ToastContainer, type ToastItem, type ToastType } from '../components/Toast.tsx'

interface FormErrors {
  businessName?: string
  ownerName?: string
  businessCategory?: string
  phoneNumber?: string
}

const categories = [
  'Retail',
  'Food & Beverage',
  'Technology',
  'Health & Wellness',
  'Education',
  'Professional Services',
  'Other',
]

function CreateProfilePage() {
  const navigate = useNavigate()
  const { profileData, setProfileData, clearProfile } = useProfile()
  const isEditMode = Boolean(profileData.id)

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [logoFileName, setLogoFileName] = useState<string>(
    profileData.logo ? profileData.logo.name : ''
  )
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const logoInputRef = useRef<HTMLInputElement>(null)

  const showToast = (message: string, type: ToastType = 'success') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target
    setProfileData({ ...profileData, [name]: value })
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setProfileData({ ...profileData, logo: file })
    setLogoFileName(file ? file.name : '')
  }

  const validate = (): boolean => {
    const newErrors: FormErrors = {}
    if (!profileData.businessName.trim()) {
      newErrors.businessName = 'Business name is required.'
    }
    if (!profileData.ownerName.trim()) {
      newErrors.ownerName = 'Owner name is required.'
    }
    if (!profileData.businessCategory) {
      newErrors.businessCategory = 'Please select a category.'
    }
    if (!profileData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required.'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    const isValid = validate()
    if (!isValid) {
      setIsSubmitting(false)
      const firstErrorField = document.querySelector('[aria-invalid="true"]') as HTMLElement | null
      firstErrorField?.focus()
      return
    }

    if (!isEditMode) {
      navigate('/profile-preview')
      return
    }

    try {
      const updated = await updateBusinessProfile(profileData.id as string, profileData)
      setProfileData({
        ...profileData,
        businessName: updated.business_name,
        ownerName: updated.owner_name,
        businessCategory: updated.business_category,
        phoneNumber: updated.phone_number,
        whatsappNumber: updated.whatsapp_number || '',
        email: updated.email || '',
        website: updated.website || '',
        address: updated.address || '',
        aboutBusiness: updated.about_business || '',
        id: updated.id,
        slug: updated.slug,
        existingLogoUrl: updated.logo_url,
      })
      navigate('/profile-preview', { state: { updateSuccess: true } })
    } catch (error) {
      console.error('Failed to update business profile:', error)
      showToast('Something went wrong while updating. Please try again.', 'error')
      setIsSubmitting(false)
    }
  }

  const handleClearForm = () => {
    const confirmed = window.confirm(
      'Are you sure you want to clear all form data? This cannot be undone.'
    )
    if (!confirmed) return
    clearProfile()
    setErrors({})
    setLogoFileName('')
    if (logoInputRef.current) {
      logoInputRef.current.value = ''
    }
  }

  const inputBase =
    'w-full px-4 py-2.5 border rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-sm'

  const fieldError = (key: keyof FormErrors) =>
    errors[key] ? (
      <p
        id={`${key}-error`}
        role="alert"
        className="mt-1.5 text-xs text-red-600 flex items-center gap-1"
      >
        <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        {errors[key]}
      </p>
    ) : null

  const sectionHeading = 'text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4 pb-2 border-b border-gray-100'

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      {/* ── Page header ── */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 focus:outline-none focus:underline transition-colors"
            aria-label="Back to home"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Home
          </button>
          <span className="text-sm font-semibold text-gray-900">Smart Business Profile</span>
          <div className="w-16" aria-hidden="true" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        <ToastContainer toasts={toasts} />
        <div className="mb-8">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold mb-2 ${
              isEditMode ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
            }`}
          >
            {isEditMode ? 'Edit Mode' : 'Create Mode'}
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight mb-1.5">
            {isEditMode ? 'Edit Your Profile' : 'Create Your Profile'}
          </h1>
          <p className="text-sm text-gray-500">
            Fields marked with <span className="text-red-500 font-medium">*</span> are required.
          </p>
        </div>

        <form onSubmit={handleContinue} noValidate className="space-y-10">

          {/* ── Basic Information ── */}
          <section aria-labelledby="section-basic">
            <h2 id="section-basic" className={sectionHeading}>
              Basic Information
            </h2>
            <div className="space-y-5">

              <div>
                <label htmlFor="businessName" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Business Name <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  type="text"
                  id="businessName"
                  name="businessName"
                  value={profileData.businessName}
                  onChange={handleChange}
                  placeholder="e.g. Sunrise Bakery"
                  autoComplete="organization"
                  aria-required="true"
                  aria-invalid={!!errors.businessName}
                  aria-describedby={errors.businessName ? 'businessName-error' : undefined}
                  className={`${inputBase} ${errors.businessName ? 'border-red-400 bg-red-50/30 focus:ring-red-400' : 'border-gray-300'}`}
                />
                {fieldError('businessName')}
              </div>

              <div>
                <label htmlFor="ownerName" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Owner Name <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  type="text"
                  id="ownerName"
                  name="ownerName"
                  value={profileData.ownerName}
                  onChange={handleChange}
                  placeholder="e.g. Sarah Johnson"
                  autoComplete="name"
                  aria-required="true"
                  aria-invalid={!!errors.ownerName}
                  aria-describedby={errors.ownerName ? 'ownerName-error' : undefined}
                  className={`${inputBase} ${errors.ownerName ? 'border-red-400 bg-red-50/30 focus:ring-red-400' : 'border-gray-300'}`}
                />
                {fieldError('ownerName')}
              </div>

              <div>
                <label htmlFor="businessCategory" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Business Category <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <select
                  id="businessCategory"
                  name="businessCategory"
                  value={profileData.businessCategory}
                  onChange={handleChange}
                  aria-required="true"
                  aria-invalid={!!errors.businessCategory}
                  aria-describedby={errors.businessCategory ? 'businessCategory-error' : undefined}
                  className={`${inputBase} bg-white ${errors.businessCategory ? 'border-red-400 bg-red-50/30 focus:ring-red-400' : 'border-gray-300'}`}
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                {fieldError('businessCategory')}
              </div>

            </div>
          </section>

          {/* ── Contact Information ── */}
          <section aria-labelledby="section-contact">
            <h2 id="section-contact" className={sectionHeading}>
              Contact Information
            </h2>
            <div className="space-y-5">

              <div>
                <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Phone Number <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  type="tel"
                  id="phoneNumber"
                  name="phoneNumber"
                  value={profileData.phoneNumber}
                  onChange={handleChange}
                  placeholder="e.g. +1 555 000 1234"
                  autoComplete="tel"
                  aria-required="true"
                  aria-invalid={!!errors.phoneNumber}
                  aria-describedby={errors.phoneNumber ? 'phoneNumber-error' : undefined}
                  className={`${inputBase} ${errors.phoneNumber ? 'border-red-400 bg-red-50/30 focus:ring-red-400' : 'border-gray-300'}`}
                />
                {fieldError('phoneNumber')}
              </div>

              <div>
                <label htmlFor="whatsappNumber" className="block text-sm font-medium text-gray-700 mb-1.5">
                  WhatsApp Number
                  <span className="ml-2 text-xs text-gray-400 font-normal">Optional</span>
                </label>
                <input
                  type="tel"
                  id="whatsappNumber"
                  name="whatsappNumber"
                  value={profileData.whatsappNumber}
                  onChange={handleChange}
                  placeholder="e.g. +1 555 000 5678"
                  autoComplete="tel"
                  className={`${inputBase} border-gray-300`}
                />
                <p className="mt-1.5 text-xs text-gray-400">Leave blank to use your phone number for WhatsApp.</p>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email Address
                  <span className="ml-2 text-xs text-gray-400 font-normal">Optional</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={profileData.email}
                  onChange={handleChange}
                  placeholder="e.g. hello@yourbusiness.com"
                  autoComplete="email"
                  className={`${inputBase} border-gray-300`}
                />
              </div>

              <div>
                <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Website
                  <span className="ml-2 text-xs text-gray-400 font-normal">Optional</span>
                </label>
                <input
                  type="url"
                  id="website"
                  name="website"
                  value={profileData.website}
                  onChange={handleChange}
                  placeholder="e.g. https://yourbusiness.com"
                  autoComplete="url"
                  className={`${inputBase} border-gray-300`}
                />
              </div>

            </div>
          </section>

          {/* ── Business Information ── */}
          <section aria-labelledby="section-business">
            <h2 id="section-business" className={sectionHeading}>
              Business Information
            </h2>
            <div className="space-y-5">

              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Address
                  <span className="ml-2 text-xs text-gray-400 font-normal">Optional</span>
                </label>
                <textarea
                  id="address"
                  name="address"
                  rows={3}
                  value={profileData.address}
                  onChange={handleChange}
                  placeholder="e.g. 123 Main Street, Suite 4&#10;New York, NY 10001"
                  className={`${inputBase} border-gray-300 resize-none`}
                />
              </div>

              <div>
                <label htmlFor="aboutBusiness" className="block text-sm font-medium text-gray-700 mb-1.5">
                  About Business
                  <span className="ml-2 text-xs text-gray-400 font-normal">Optional</span>
                </label>
                <textarea
                  id="aboutBusiness"
                  name="aboutBusiness"
                  rows={4}
                  value={profileData.aboutBusiness}
                  onChange={handleChange}
                  placeholder="A short description of your business, what you offer, and what makes you unique..."
                  className={`${inputBase} border-gray-300 resize-none`}
                />
              </div>

            </div>
          </section>

          {/* ── Branding ── */}
          <section aria-labelledby="section-branding">
            <h2 id="section-branding" className={sectionHeading}>
              Branding
            </h2>
            <div>
              <label htmlFor="logo" className="block text-sm font-medium text-gray-700 mb-1.5">
                Business Logo
                <span className="ml-2 text-xs text-gray-400 font-normal">Optional</span>
              </label>
              <input
                ref={logoInputRef}
                type="file"
                id="logo"
                name="logo"
                accept="image/*"
                onChange={handleLogoChange}
                className={`${inputBase} border-gray-300 file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:transition-colors`}
              />
              {logoFileName ? (
                <p className="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {logoFileName}
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-gray-400">PNG, JPG or GIF recommended. Not stored between sessions.</p>
              )}
            </div>
          </section>

          {/* ── Buttons ── */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-100">
            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="inline-flex items-center justify-center gap-2 px-8 py-3 text-sm font-semibold text-white bg-blue-600 rounded-full hover:bg-blue-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {isSubmitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading…
                </>
              ) : (
                <>
                  {isEditMode ? 'Update Profile' : 'Preview Profile'}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleClearForm}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-red-600 bg-red-50 rounded-full hover:bg-red-100 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear Form
            </button>
          </div>

        </form>
      </main>
    </div>
  )
}

export default CreateProfilePage
