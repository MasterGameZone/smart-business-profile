import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout, { authError } from '../../components/AuthLayout.tsx'
import PasswordField from '../../components/PasswordField.tsx'
import { ToastContainer, type ToastItem, type ToastType } from '../../components/Toast.tsx'
import { usePageMeta } from '../../hooks/usePageMeta.ts'
import { updatePassword } from '../../lib/authService.ts'

interface FormErrors {
  password?: string
  confirmPassword?: string
}

function ResetPasswordPage() {
  const navigate = useNavigate()

  usePageMeta({
    title: 'Reset Password | Smart Business Profile',
    description: 'Choose a new password for your Smart Business Profile account.',
  })

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = (message: string, type: ToastType = 'success') => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }

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
    const { error } = await updatePassword(password)
    setIsSubmitting(false)

    if (error) {
      showToast(error, 'error')
      return
    }

    showToast('Password updated successfully.')
    setTimeout(() => navigate('/login'), 1200)
  }

  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Choose a new password for your account."
      footer={
        <p className="text-sm text-black">
          Remembered it after all?{' '}
          <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700 focus:outline-none focus:underline">
            Back to login
          </Link>
        </p>
      }
    >
      <ToastContainer toasts={toasts} />

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="[&_button]:text-black [&_input]:text-black [&_input]:placeholder:text-slate-400 [&_label]:text-black">
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

        <div className="[&_button]:text-black [&_input]:text-black [&_input]:placeholder:text-slate-400 [&_label]:text-black">
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
              Updating…
            </>
          ) : (
            'Reset Password'
          )}
        </button>
      </form>
    </AuthLayout>
  )
}

export default ResetPasswordPage
