import { useState } from 'react'
import { authInputBase } from './AuthLayout.tsx'

interface PasswordFieldProps {
  id: string
  name: string
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  autoComplete?: string
  hasError?: boolean
  labelClassName?: string
  inputClassName?: string
}

function PasswordField({
  id,
  name,
  label,
  value,
  onChange,
  placeholder = '••••••••',
  autoComplete = 'current-password',
  hasError = false,
  labelClassName = 'mb-1.5 block text-sm font-medium text-slate-200',
  inputClassName = authInputBase,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div>
      <label htmlFor={id} className={labelClassName}>
        {label} <span className="text-red-500" aria-hidden="true">*</span>
      </label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-required="true"
          aria-invalid={hasError}
          className={`${inputClassName} pr-11 ${hasError ? 'border-red-400/70 bg-red-500/10 focus:ring-red-400' : ''}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 focus:outline-none focus:text-sky-300"
        >
          {visible ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

export default PasswordField
