import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout, { authInputBase, authLabel, authError } from '../../components/AuthLayout.tsx'
import PasswordField from '../../components/PasswordField.tsx'

interface FormErrors {
  fullName?: string
  email?: string
  password?: string
  confirmPassword?: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function SignUpPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    const isValid = validate()
    if (isValid) {
      setSubmitted(true)
    } else {
      const firstErrorField = document.querySelector('[aria-invalid="true"]') as HTMLElement | null
      firstErrorField?.focus()
    }
    setIsSubmitting(false)
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
      {submitted && (
        <div role="status" className="mb-6 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700">
          Form validated successfully. (Account creation is not yet connected.)
        </div>
      )}

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
          Create Account
        </button>
      </form>
    </AuthLayout>
  )
}

export default SignUpPage
