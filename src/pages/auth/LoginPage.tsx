import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthLayout, { authInputBase, authLabel, authError } from '../../components/AuthLayout.tsx'
import PasswordField from '../../components/PasswordField.tsx'
import { ToastContainer, type ToastItem, type ToastType } from '../../components/Toast.tsx'
import { usePageMeta } from '../../hooks/usePageMeta.ts'
import { signIn } from '../../lib/authService.ts'

interface FormErrors {
  email?: string
  password?: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname || '/'

  usePageMeta({
    title: 'Login | Smart Business Profile',
    description: 'Log in to manage your Smart Business Profile account and business profiles.',
  })

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
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
    const { data, error } = await signIn(email, password)
    setIsSubmitting(false)

    if (error || !data?.session) {
      showToast(error || 'Unable to log in. Please try again.', 'error')
      return
    }

    navigate(from, { replace: true })
  }

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Log in to manage your business profile."
      footer={
        <p className="text-sm text-gray-500">
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="font-semibold text-blue-600 hover:text-blue-700 focus:outline-none focus:underline">
            Sign up
          </Link>
        </p>
      }
    >
      <ToastContainer toasts={toasts} />

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
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
            autoComplete="current-password"
            hasError={Boolean(errors.password)}
          />
          {authError(errors.password)}
        </div>

        <div className="flex items-center justify-between">
          <label htmlFor="rememberMe" className="inline-flex items-center gap-2 text-sm text-gray-600 select-none">
            <input
              type="checkbox"
              id="rememberMe"
              name="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
            />
            Remember me
          </label>
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none focus:underline"
          >
            Forgot password?
          </Link>
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
              Logging in…
            </>
          ) : (
            'Log In'
          )}
        </button>
      </form>
    </AuthLayout>
  )
}

export default LoginPage
