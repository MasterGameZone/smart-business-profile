import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout, { authError } from '../../components/AuthLayout.tsx'
import PasswordField from '../../components/PasswordField.tsx'

interface FormErrors {
  password?: string
  confirmPassword?: string
}

function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const validate = (): boolean => {
    const newErrors: FormErrors = {}
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
      title="Reset Password"
      subtitle="Choose a new password for your account."
      footer={
        <p className="text-sm text-gray-500">
          Remembered it after all?{' '}
          <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700 focus:outline-none focus:underline">
            Back to login
          </Link>
        </p>
      }
    >
      {submitted && (
        <div role="status" className="mb-6 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700">
          Form validated successfully. (Password reset is not yet connected.)
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div>
          <PasswordField
            id="password"
            name="password"
            label="New Password"
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
          Reset Password
        </button>
      </form>
    </AuthLayout>
  )
}

export default ResetPasswordPage
