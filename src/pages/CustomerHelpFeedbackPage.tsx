import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.tsx'
import { usePageMeta } from '../hooks/usePageMeta.ts'
import { createCustomerHelpFeedbackRequest } from '../lib/customerHelpFeedbackService.ts'
import type {
  CustomerHelpFeedbackCategory,
  CustomerHelpFeedbackRequestType,
} from '../types/customerHelpFeedback.ts'

type HelpFeedbackTab = 'help' | 'report' | 'feedback'

interface HelpItem {
  title: string
  description: string
}

interface ContactSupportFormState {
  category: CustomerHelpFeedbackCategory
  subject: string
  message: string
}

interface ProblemReportFormState {
  category: CustomerHelpFeedbackCategory
  title: string
  message: string
}

type SupportFeedbackType =
  | 'suggestion'
  | 'help_request'
  | 'issue_problem'
  | 'customer_account_improvement_help'

interface SupportFeedbackFormState {
  type: SupportFeedbackType
  subject: string
  customSubject: string
  message: string
}

interface TextFormErrors {
  subject?: string
  title?: string
  message?: string
}

type FeedbackMessage = {
  kind: 'success' | 'error'
  text: string
} | null

const helpItems: HelpItem[] = [
  {
    title: 'Frequently Asked Questions',
    description: 'Quick answers about using Smart Business Profile as a customer.',
  },
  {
    title: 'Account Help',
    description: 'Help with login, profile settings, security, and switching modes.',
  },
  {
    title: 'Saved Businesses Help',
    description: 'Learn how saved businesses help you revisit trusted profiles quickly.',
  },
  {
    title: 'Reviews and Reports Help',
    description: 'Understand how reviews, reports, and activity history work.',
  },
  {
    title: 'Community Features Help',
    description: 'Learn how Support a Business, My Local Impact, and Shape the Platform work.',
  },
  {
    title: 'Contact Support',
    description: 'Use the form below to send a support request.',
  },
]

const supportCategories: CustomerHelpFeedbackCategory[] = [
  'Account issue',
  'Business profile issue',
  'Search or directory issue',
  'Saved businesses issue',
  'Reviews or reports issue',
  'Community feature issue',
  'Technical problem',
  'Other',
]

const problemCategories: CustomerHelpFeedbackCategory[] = supportCategories

const supportFeedbackTypeOptions: Array<{
  value: SupportFeedbackType
  label: string
}> = [
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'help_request', label: 'Help request' },
  { value: 'issue_problem', label: 'Issue / problem' },
  { value: 'customer_account_improvement_help', label: 'Customer account improvement help' },
]

const supportFeedbackSubjectOptionsByType: Record<SupportFeedbackType, string[]> = {
  suggestion: [
    'New feature suggestion',
    'Improve customer home page',
    'Improve business search / directory',
    'Improve saved businesses',
    'Improve ratings & reviews',
    'Improve customer notifications',
    'Improve Support a Business',
    'Improve My Local Impact',
    'Improve customer account menu',
    'Others',
  ],
  help_request: [
    'Help updating my customer profile',
    'Help verifying my email address',
    'Help resetting my password',
    'Help finding businesses',
    'Help with saved businesses',
    'Help with ratings & reviews',
    'Help with reported profiles',
    'Help with Support a Business',
    'Help switching account mode',
    'Others',
  ],
  issue_problem: [
    'Customer profile is not saving',
    'Email verification is not working',
    'Password reset is not working',
    'Search or directory is not working',
    'Saved businesses are not loading',
    'Ratings or reviews are not working',
    'Reported profiles are not loading',
    'Notifications are not loading correctly',
    'Support a Business is not working',
    'Customer account or menu issue',
    'Others',
  ],
  customer_account_improvement_help: [
    'Improve my customer profile',
    'Improve my account settings experience',
    'Improve business discovery',
    'Improve saved businesses experience',
    'Improve ratings and reviews experience',
    'Improve My Activity',
    'Improve customer notifications',
    'Improve community features',
    'Improve Support & Feedback',
    'Others',
  ],
}

const defaultContactSupportForm: ContactSupportFormState = {
  category: supportCategories[0],
  subject: '',
  message: '',
}

const defaultProblemReportForm: ProblemReportFormState = {
  category: problemCategories[0],
  title: '',
  message: '',
}

const defaultSupportFeedbackForm: SupportFeedbackFormState = {
  type: 'suggestion',
  subject: '',
  customSubject: '',
  message: '',
}

function getActiveTab(hash: string): HelpFeedbackTab {
  if (hash === '#report') return 'report'
  if (hash === '#feedback') return 'feedback'
  if (hash === '#faqs' || hash === '#contact') return 'help'
  return 'help'
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function containsLink(value: string): boolean {
  return /(https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,})/i.test(value)
}

function validateTextField(
  value: string,
  fieldLabel: string,
  maxLength: number
): string | undefined {
  if (!value) {
    return `Please enter ${fieldLabel}.`
  }

  if (value.length > maxLength) {
    return `${fieldLabel} must be ${maxLength} characters or fewer.`
  }

  if (containsLink(value)) {
    return 'Links are not allowed in this field for now.'
  }

  return undefined
}

function getSupportFeedbackRequestType(type: SupportFeedbackType): CustomerHelpFeedbackRequestType {
  switch (type) {
    case 'suggestion':
      return 'Feedback'
    case 'help_request':
      return 'Contact Support'
    case 'issue_problem':
      return 'Problem Report'
    case 'customer_account_improvement_help':
      return 'Contact Support'
    default:
      return 'Feedback'
  }
}

function getSupportFeedbackCategory(type: SupportFeedbackType): CustomerHelpFeedbackCategory {
  switch (type) {
    case 'suggestion':
      return 'Feature suggestion'
    case 'help_request':
      return 'Account issue'
    case 'issue_problem':
      return 'Technical problem'
    case 'customer_account_improvement_help':
      return 'Account issue'
    default:
      return 'Other'
  }
}

function CustomerHelpFeedbackPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isLoading: isAuthLoading } = useAuth()
  const userId = user?.id ?? null
  const activeTab = getActiveTab(location.hash)
  const [contactForm, setContactForm] = useState<ContactSupportFormState>(defaultContactSupportForm)
  const [contactErrors, setContactErrors] = useState<TextFormErrors>({})
  const [contactFeedback, setContactFeedback] = useState<FeedbackMessage>(null)
  const [isSubmittingContact, setIsSubmittingContact] = useState(false)
  const [problemForm, setProblemForm] = useState<ProblemReportFormState>(defaultProblemReportForm)
  const [problemErrors, setProblemErrors] = useState<TextFormErrors>({})
  const [problemFeedback, setProblemFeedback] = useState<FeedbackMessage>(null)
  const [isSubmittingProblem, setIsSubmittingProblem] = useState(false)
  const [supportFeedbackForm, setSupportFeedbackForm] = useState<SupportFeedbackFormState>(defaultSupportFeedbackForm)
  const [feedbackErrors, setFeedbackErrors] = useState<TextFormErrors>({})
  const [feedbackSubmitMessage, setFeedbackSubmitMessage] = useState<FeedbackMessage>(null)
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)

  useEffect(() => {
    if (location.hash !== '#faqs' && location.hash !== '#contact') return

    window.requestAnimationFrame(() => {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' })
    })
  }, [location.hash])

  usePageMeta({
    title: 'Help & Feedback | Smart Business Profile',
    description: 'Find answers, report a problem, or share your feedback.',
  })

  const sectionClassName =
    'rounded-3xl border border-[#c7d2df] bg-white p-6 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] sm:p-8'
  const fieldClassName =
    'mt-2 w-full rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-4 py-3 text-sm text-black placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500'
  const supportFeedbackPanelCardClass = 'rounded-2xl border border-slate-200 bg-slate-50/80 p-3'
  const supportFeedbackInputClass =
    'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-[#0f172a] outline-none focus:ring-2 focus:ring-slate-300'
  const labelClassName = 'text-sm font-semibold text-black'
  const helperClassName = 'mt-1 text-xs text-slate-500'
  const errorClassName = 'mt-1 text-xs font-medium text-red-700'
  const actionButtonClassName =
    'inline-flex min-h-[42px] items-center justify-center rounded-full border border-sky-200 bg-blue-50 px-5 py-2.5 text-sm font-semibold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70'
  const tabButtonClassName =
    'inline-flex min-h-[42px] items-center justify-center rounded-full border px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-300/80 focus:ring-offset-2 focus:ring-offset-slate-50'
  const feedbackBoxClassName = (message: NonNullable<FeedbackMessage>) =>
    `mt-5 rounded-2xl border px-4 py-3 text-sm ${
      message.kind === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : 'border-red-200 bg-red-50 text-red-700'
    }`

  const tabs: Array<{ id: HelpFeedbackTab; label: string }> = [
    { id: 'help', label: 'Help & Support' },
    { id: 'report', label: 'Report a Problem' },
    { id: 'feedback', label: 'Support & Feedback' },
  ]

  const authSubmitError = 'Please sign in to submit this request.'

  const submitContactSupport = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()

    if (isSubmittingContact) return

    const subject = normalizeText(contactForm.subject)
    const message = normalizeText(contactForm.message)
    const errors: TextFormErrors = {
      subject: validateTextField(subject, 'a subject', 100),
      message: validateTextField(message, 'a message', 1000),
    }

    setContactErrors(errors)
    setContactFeedback(null)

    if (errors.subject || errors.message) return

    if (!userId) {
      setContactFeedback({ kind: 'error', text: authSubmitError })
      return
    }

    setIsSubmittingContact(true)

    try {
      await createCustomerHelpFeedbackRequest({
        customerId: userId,
        requestType: 'Contact Support',
        category: contactForm.category,
        title: subject,
        message,
        satisfactionLevel: null,
      })
      setContactForm(defaultContactSupportForm)
      setContactFeedback({ kind: 'success', text: 'Support request submitted.' })
    } catch (error) {
      console.error('Failed to submit customer support request:', error)
      setContactFeedback({ kind: 'error', text: 'We could not submit your support request. Please try again.' })
    } finally {
      setIsSubmittingContact(false)
    }
  }

  const submitProblemReport = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()

    if (isSubmittingProblem) return

    const title = normalizeText(problemForm.title)
    const message = normalizeText(problemForm.message)
    const errors: TextFormErrors = {
      title: validateTextField(title, 'a short description', 120),
      message: validateTextField(message, 'a detailed message', 1200),
    }

    setProblemErrors(errors)
    setProblemFeedback(null)

    if (errors.title || errors.message) return

    if (!userId) {
      setProblemFeedback({ kind: 'error', text: authSubmitError })
      return
    }

    setIsSubmittingProblem(true)

    try {
      await createCustomerHelpFeedbackRequest({
        customerId: userId,
        requestType: 'Problem Report',
        category: problemForm.category,
        title,
        message,
        satisfactionLevel: null,
      })
      setProblemForm(defaultProblemReportForm)
      setProblemFeedback({ kind: 'success', text: 'Problem report submitted.' })
    } catch (error) {
      console.error('Failed to submit customer problem report:', error)
      setProblemFeedback({ kind: 'error', text: 'We could not submit your report. Please try again.' })
    } finally {
      setIsSubmittingProblem(false)
    }
  }

  const submitFeedback = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()

    if (isSubmittingFeedback) return

    const selectedSubject = supportFeedbackForm.subject
    const customSubject = normalizeText(supportFeedbackForm.customSubject)
    const title = selectedSubject === 'Others' ? customSubject : selectedSubject
    const message = normalizeText(supportFeedbackForm.message)
    const errors: TextFormErrors = {
      subject: selectedSubject
        ? selectedSubject === 'Others'
          ? validateTextField(customSubject, 'a subject', 80)
          : undefined
        : 'Please select a subject.',
      message: validateTextField(message, 'feedback', 1000),
    }

    setFeedbackErrors(errors)
    setFeedbackSubmitMessage(null)

    if (errors.subject || errors.message) return

    if (!userId) {
      setFeedbackSubmitMessage({ kind: 'error', text: authSubmitError })
      return
    }

    setIsSubmittingFeedback(true)

    try {
      await createCustomerHelpFeedbackRequest({
        customerId: userId,
        requestType: getSupportFeedbackRequestType(supportFeedbackForm.type),
        category: getSupportFeedbackCategory(supportFeedbackForm.type),
        title,
        message,
        satisfactionLevel: null,
      })
      setSupportFeedbackForm(defaultSupportFeedbackForm)
      setFeedbackSubmitMessage({ kind: 'success', text: 'Thanks, your message has been sent.' })
    } catch (error) {
      console.error('Failed to submit customer support and feedback request:', error)
      setFeedbackSubmitMessage({ kind: 'error', text: 'We could not send your message. Please try again.' })
    } finally {
      setIsSubmittingFeedback(false)
    }
  }

  const handleSupportFeedbackBack = (): void => {
    window.sessionStorage.setItem('smart-business-profile:open-customer-help-suggestions', 'true')
    navigate('/')
  }

  if (activeTab === 'feedback') {
    return (
      <div className="min-h-screen bg-[#eef4fa] text-black">
        <main className="mx-auto max-w-4xl px-4 py-10 sm:py-12">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h1 className="text-sm font-semibold text-[#0f172a]">Support & Feedback</h1>
            <button
              type="button"
              onClick={handleSupportFeedbackBack}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              <span>Back</span>
            </button>
          </div>

          <section id="feedback" className="space-y-3">
            <div className={supportFeedbackPanelCardClass}>
              <p className="text-sm leading-relaxed text-slate-600">
                Share feedback, report an issue, or ask for help improving your customer account.
              </p>
            </div>

            <form
              className={`${supportFeedbackPanelCardClass} space-y-3`}
              onSubmit={(event) => void submitFeedback(event)}
            >
              <label className="block text-xs font-semibold text-slate-600">
                Type
                <select
                  className={supportFeedbackInputClass}
                  value={supportFeedbackForm.type}
                  onChange={(event) => {
                    setSupportFeedbackForm((currentForm) => ({
                      ...currentForm,
                      type: event.target.value as SupportFeedbackType,
                      subject: '',
                      customSubject: '',
                    }))
                    setFeedbackErrors({})
                    setFeedbackSubmitMessage(null)
                  }}
                  disabled={isSubmittingFeedback}
                >
                  {supportFeedbackTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-semibold text-slate-600">
                Subject
                <select
                  className={supportFeedbackInputClass}
                  value={supportFeedbackForm.subject}
                  onChange={(event) => {
                    setSupportFeedbackForm((currentForm) => ({
                      ...currentForm,
                      subject: event.target.value,
                      customSubject: event.target.value === 'Others' ? currentForm.customSubject : '',
                    }))
                    setFeedbackErrors((currentErrors) => ({ ...currentErrors, subject: undefined }))
                    setFeedbackSubmitMessage(null)
                  }}
                  disabled={isSubmittingFeedback}
                >
                  <option value="">Select subject</option>
                  {supportFeedbackSubjectOptionsByType[supportFeedbackForm.type].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {feedbackErrors.subject ? (
                  <p className="mt-1.5 text-xs text-rose-700">{feedbackErrors.subject}</p>
                ) : null}
              </label>

              {supportFeedbackForm.subject === 'Others' ? (
                <label className="block text-xs font-semibold text-slate-600">
                  Please specify subject
                  <input
                    className={supportFeedbackInputClass}
                    value={supportFeedbackForm.customSubject}
                    onChange={(event) => {
                      setSupportFeedbackForm((currentForm) => ({
                        ...currentForm,
                        customSubject: event.target.value,
                      }))
                      setFeedbackErrors((currentErrors) => ({ ...currentErrors, subject: undefined }))
                      setFeedbackSubmitMessage(null)
                    }}
                    maxLength={80}
                    disabled={isSubmittingFeedback}
                  />
                </label>
              ) : null}

              <label className="block text-xs font-semibold text-slate-600">
                Message
                <textarea
                  className={`${supportFeedbackInputClass} min-h-28 resize-y`}
                  value={supportFeedbackForm.message}
                  onChange={(event) => {
                    setSupportFeedbackForm((currentForm) => ({ ...currentForm, message: event.target.value }))
                    setFeedbackErrors((currentErrors) => ({ ...currentErrors, message: undefined }))
                    setFeedbackSubmitMessage(null)
                  }}
                  maxLength={1000}
                  disabled={isSubmittingFeedback}
                  aria-invalid={Boolean(feedbackErrors.message)}
                />
                {feedbackErrors.message ? (
                  <p className="mt-1.5 text-xs text-rose-700">{feedbackErrors.message}</p>
                ) : null}
              </label>

              {feedbackSubmitMessage ? (
                <p
                  className={`text-xs ${
                    feedbackSubmitMessage.kind === 'success' ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {feedbackSubmitMessage.text}
                </p>
              ) : null}

              <button
                type="submit"
                className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isAuthLoading || isSubmittingFeedback}
              >
                {isSubmittingFeedback ? 'Sending...' : 'Send message'}
              </button>
            </form>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#eef4fa] text-black">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:py-12">
        <section className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-black sm:text-3xl">Help & Feedback</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black sm:text-base">
            Find answers, report a problem, or share your feedback.
          </p>
        </section>

        <div className="mb-6 flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                type="button"
                className={`${tabButtonClassName} ${
                  isActive
                    ? 'border-[#c7d2df] bg-[#f8fafc] text-black'
                    : 'border-transparent bg-transparent text-slate-500'
                }`}
                onClick={() => navigate(`/customer/help-feedback#${tab.id}`)}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        <div>
          {activeTab === 'help' && (
            <section id="help" className={sectionClassName}>
              <div className="flex flex-col gap-2">
                <h2 className="text-lg font-semibold tracking-tight text-black sm:text-xl">Help & Support</h2>
                <p className="text-sm text-black">
                  Browse quick customer help topics or send a support request.
                </p>
              </div>

              <div id="faqs" className="mt-5 space-y-3">
                {helpItems.map((item) => (
                  <div
                    key={item.title}
                    className="flex items-start gap-4 rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-4 py-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#c7d2df] bg-white text-slate-500">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                        <path d="M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
                        <path
                          d="M9.09 9a3 3 0 1 1 5.82 1c0 2-3 2-3 4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-black sm:text-base">{item.title}</h3>
                          <p className="mt-1 text-sm text-black">{item.description}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <form
                id="contact"
                className="mt-7 rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-4 py-4"
                onSubmit={(event) => void submitContactSupport(event)}
              >
                <div>
                  <h3 className="text-base font-semibold text-black">Contact Support</h3>
                  <p className="mt-1 text-sm text-black">Send a simple support request to the Smart Business Profile team.</p>
                </div>

                {contactFeedback && <div className={feedbackBoxClassName(contactFeedback)}>{contactFeedback.text}</div>}

                <div className="mt-5 grid grid-cols-1 gap-5">
                  <label className="block">
                    <span className={labelClassName}>Support category</span>
                    <select
                      className={fieldClassName}
                      value={contactForm.category}
                      onChange={(event) =>
                        setContactForm((currentForm) => ({
                          ...currentForm,
                          category: event.target.value as CustomerHelpFeedbackCategory,
                        }))
                      }
                    >
                      {supportCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className={labelClassName}>Subject</span>
                    <input
                      className={fieldClassName}
                      value={contactForm.subject}
                      onChange={(event) => {
                        setContactForm((currentForm) => ({ ...currentForm, subject: event.target.value }))
                        setContactErrors((currentErrors) => ({ ...currentErrors, subject: undefined }))
                      }}
                      placeholder="Briefly describe what you need help with"
                      maxLength={100}
                      aria-invalid={Boolean(contactErrors.subject)}
                    />
                    <p className={helperClassName}>{normalizeText(contactForm.subject).length}/100 characters. Links are not allowed.</p>
                    {contactErrors.subject && <p className={errorClassName}>{contactErrors.subject}</p>}
                  </label>

                  <label className="block">
                    <span className={labelClassName}>Message</span>
                    <textarea
                      className={`${fieldClassName} min-h-[140px] resize-none`}
                      value={contactForm.message}
                      onChange={(event) => {
                        setContactForm((currentForm) => ({ ...currentForm, message: event.target.value }))
                        setContactErrors((currentErrors) => ({ ...currentErrors, message: undefined }))
                      }}
                      placeholder="Add the details the support team should know"
                      maxLength={1000}
                      aria-invalid={Boolean(contactErrors.message)}
                    />
                    <p className={helperClassName}>{normalizeText(contactForm.message).length}/1000 characters. Links are not allowed.</p>
                    {contactErrors.message && <p className={errorClassName}>{contactErrors.message}</p>}
                  </label>
                </div>

                <div className="mt-5">
                  <button type="submit" className={actionButtonClassName} disabled={isAuthLoading || isSubmittingContact}>
                    {isSubmittingContact ? 'Submitting...' : 'Submit Support Request'}
                  </button>
                </div>
              </form>
            </section>
          )}

          {activeTab === 'report' && (
            <section id="report" className={sectionClassName}>
              <div className="flex flex-col gap-2">
                <h2 className="text-lg font-semibold tracking-tight text-black sm:text-xl">Report a Problem</h2>
                <p className="text-sm text-black">Tell us about a platform problem so it can be reviewed.</p>
              </div>

              {problemFeedback && <div className={feedbackBoxClassName(problemFeedback)}>{problemFeedback.text}</div>}

              <form className="mt-5 grid grid-cols-1 gap-5" onSubmit={(event) => void submitProblemReport(event)}>
                <label className="block">
                  <span className={labelClassName}>Problem category</span>
                  <select
                    className={fieldClassName}
                    value={problemForm.category}
                    onChange={(event) =>
                      setProblemForm((currentForm) => ({
                        ...currentForm,
                        category: event.target.value as CustomerHelpFeedbackCategory,
                      }))
                    }
                  >
                    {problemCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className={labelClassName}>Short description</span>
                  <input
                    className={fieldClassName}
                    value={problemForm.title}
                    onChange={(event) => {
                      setProblemForm((currentForm) => ({ ...currentForm, title: event.target.value }))
                      setProblemErrors((currentErrors) => ({ ...currentErrors, title: undefined }))
                    }}
                    placeholder="Briefly describe the issue"
                    maxLength={120}
                    aria-invalid={Boolean(problemErrors.title)}
                  />
                  <p className={helperClassName}>{normalizeText(problemForm.title).length}/120 characters. Links are not allowed.</p>
                  {problemErrors.title && <p className={errorClassName}>{problemErrors.title}</p>}
                </label>

                <label className="block">
                  <span className={labelClassName}>Detailed message</span>
                  <textarea
                    className={`${fieldClassName} min-h-[140px] resize-none`}
                    value={problemForm.message}
                    onChange={(event) => {
                      setProblemForm((currentForm) => ({ ...currentForm, message: event.target.value }))
                      setProblemErrors((currentErrors) => ({ ...currentErrors, message: undefined }))
                    }}
                    placeholder="Add more context about the issue"
                    maxLength={1200}
                    aria-invalid={Boolean(problemErrors.message)}
                  />
                  <p className={helperClassName}>{normalizeText(problemForm.message).length}/1200 characters. Links are not allowed.</p>
                  {problemErrors.message && <p className={errorClassName}>{problemErrors.message}</p>}
                </label>

                <div className="pt-1">
                  <button type="submit" className={actionButtonClassName} disabled={isAuthLoading || isSubmittingProblem}>
                    {isSubmittingProblem ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </form>
            </section>
          )}

        </div>
      </main>
    </div>
  )
}

export default CustomerHelpFeedbackPage
