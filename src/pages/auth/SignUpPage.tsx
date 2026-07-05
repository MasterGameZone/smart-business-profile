import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout, { authInputBase, authLabel, authError } from '../../components/AuthLayout.tsx'
import PasswordField from '../../components/PasswordField.tsx'
import { ToastContainer, type ToastItem, type ToastType } from '../../components/Toast.tsx'
import { usePageMeta } from '../../hooks/usePageMeta.ts'
import { signUp } from '../../lib/authService.ts'

interface FormErrors {
  fullName?: string
  email?: string
  password?: string
  confirmPassword?: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function SignUpPage() {
  usePageMeta({
    title: 'Sign Up | Smart Business Profile',
    description: 'Create your Smart Business Profile account and start building a public business profile.',
  })

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = (message: string, type: ToastType = 'success') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }

  const validate = (): boolean => {
    const newErrors: FormErrors = {}
    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required.'
    }
    if (!email.trim()) {
      newErrors.email = 'Email is required.'
    } else if (!EMAIL_REGEX.test(email.trim())) {
      newErrors.email = 'Enter a valid email address.'
    }
    if (!password) {
      newErrors.password = 'Password is required.'
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters.'
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password.'
    } else if (password && confirmPassword !== password) {
      newErrors.confirmPassword = 'Passwords must match.'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    const isValid = validate()
    if (!isValid) {
      const firstErrorField = document.querySelector('[aria-invalid="true"]') as HTMLElement | null
      firstErrorField?.focus()
      return
    }

    setIsSubmitting(true)
    const { data, error } = await signUp(fullName, email, password)
    setIsSubmitting(false)

    if (error || !data?.user) {
      showToast(error || 'Unable to create account. Please try again.', 'error')
      return
    }

    setSubmitted(true)
  }

  return (
    <AuthLayout
      title="Create Your Account"
      subtitle="Sign up to start building your business profile."
      footer={
        <p className="text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700 focus:outline-none focus:underline">
            Log in
          </Link>
        </p>
      }
    >
      <ToastContainer toasts={toasts} />

      {submitted ? (
        <div role="status" className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700">
          Account created successfully. Please verify your email before logging in.
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div>
            <label htmlFor="fullName" className={authLabel}>
              Full Name <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Sarah Johnson"
              autoComplete="name"
              aria-required="true"
              aria-invalid={Boolean(errors.fullName)}
              className={`${authInputBase} ${errors.fullName ? 'border-red-400 bg-red-50/30 focus:ring-red-400' : 'border-gray-300'}`}
            />
            {authError(errors.fullName)}
          </div>

          <div>
            <label htmlFor="email" className={authLabel}>
              Email <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              aria-required="true"
              aria-invalid={Boolean(errors.email)}
              className={`${authInputBase} ${errors.email ? 'border-red-400 bg-red-50/30 focus:ring-red-400' : 'border-gray-300'}`}
            />
            {authError(errors.email)}
          </div>

          <div>
            <PasswordField
              id="password"
              name="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              hasError={Boolean(errors.password)}
            />
            {authError(errors.password)}
          </div>

          <div>
            <PasswordField
              id="confirmPassword"
              name="confirmPassword"
              label="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              hasError={Boolean(errors.confirmPassword)}
            />
            {authError(errors.confirmPassword)}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-blue-600 rounded-full hover:bg-blue-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {isSubmitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creating account…
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}

export default SignUpPage
