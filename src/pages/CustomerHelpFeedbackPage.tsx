import { useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.tsx'
import { usePageMeta } from '../hooks/usePageMeta.ts'
import { createCustomerHelpFeedbackRequest } from '../lib/customerHelpFeedbackService.ts'
import type {
  CustomerHelpFeedbackCategory,
  CustomerSatisfactionLevel,
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

interface FeedbackFormState {
  feedbackType: CustomerHelpFeedbackCategory
  satisfactionLevel: CustomerSatisfactionLevel
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

const feedbackTypes: CustomerHelpFeedbackCategory[] = [
  'General feedback',
  'Feature suggestion',
  'Design feedback',
  'Bug feedback',
  'Category suggestion',
  'Other',
]

const satisfactionLevels: CustomerSatisfactionLevel[] = [
  'Very satisfied',
  'Satisfied',
  'Neutral',
  'Unsatisfied',
  'Very unsatisfied',
]

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

const defaultFeedbackForm: FeedbackFormState = {
  feedbackType: feedbackTypes[0],
  satisfactionLevel: 'Satisfied',
  message: '',
}

function getActiveTab(hash: string): HelpFeedbackTab {
  if (hash === '#report') return 'report'
  if (hash === '#feedback') return 'feedback'
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
  const [feedbackForm, setFeedbackForm] = useState<FeedbackFormState>(defaultFeedbackForm)
  const [feedbackErrors, setFeedbackErrors] = useState<TextFormErrors>({})
  const [feedbackSubmitMessage, setFeedbackSubmitMessage] = useState<FeedbackMessage>(null)
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)

  usePageMeta({
    title: 'Help & Feedback | Smart Business Profile',
    description: 'Find answers, report a problem, or share your feedback.',
  })

  const sectionClassName =
    'rounded-3xl border border-[#c7d2df] bg-white p-6 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] sm:p-8'
  const fieldClassName =
    'mt-2 w-full rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-4 py-3 text-sm text-black placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500'
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
    { id: 'feedback', label: 'Share Feedback' },
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

    const message = normalizeText(feedbackForm.message)
    const errors: TextFormErrors = {
      message: validateTextField(message, 'feedback', 1000),
    }

    setFeedbackErrors(errors)
    setFeedbackSubmitMessage(null)

    if (errors.message) return

    if (!userId) {
      setFeedbackSubmitMessage({ kind: 'error', text: authSubmitError })
      return
    }

    setIsSubmittingFeedback(true)

    try {
      await createCustomerHelpFeedbackRequest({
        customerId: userId,
        requestType: 'Feedback',
        category: feedbackForm.feedbackType,
        title: feedbackForm.feedbackType,
        message,
        satisfactionLevel: feedbackForm.satisfactionLevel,
      })
      setFeedbackForm(defaultFeedbackForm)
      setFeedbackSubmitMessage({ kind: 'success', text: 'Feedback submitted.' })
    } catch (error) {
      console.error('Failed to submit customer feedback:', error)
      setFeedbackSubmitMessage({ kind: 'error', text: 'We could not submit your feedback. Please try again.' })
    } finally {
      setIsSubmittingFeedback(false)
    }
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

              <div className="mt-5 space-y-3">
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

              <form className="mt-7 rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-4 py-4" onSubmit={(event) => void submitContactSupport(event)}>
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

          {activeTab === 'feedback' && (
            <section id="feedback" className={sectionClassName}>
              <div className="flex flex-col gap-2">
                <h2 className="text-lg font-semibold tracking-tight text-black sm:text-xl">Share Feedback</h2>
                <p className="text-sm text-black">
                  Share what is working well or what should improve.
                </p>
              </div>

              {feedbackSubmitMessage && <div className={feedbackBoxClassName(feedbackSubmitMessage)}>{feedbackSubmitMessage.text}</div>}

              <form className="mt-5 grid grid-cols-1 gap-5" onSubmit={(event) => void submitFeedback(event)}>
                <label className="block">
                  <span className={labelClassName}>Feedback type</span>
                  <select
                    className={fieldClassName}
                    value={feedbackForm.feedbackType}
                    onChange={(event) =>
                      setFeedbackForm((currentForm) => ({
                        ...currentForm,
                        feedbackType: event.target.value as CustomerHelpFeedbackCategory,
                      }))
                    }
                  >
                    {feedbackTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>

                <div>
                  <p className={labelClassName}>Rating or satisfaction level</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {satisfactionLevels.map((level) => {
                      const isSelected = feedbackForm.satisfactionLevel === level

                      return (
                        <button
                          key={level}
                          type="button"
                          className={`inline-flex min-h-[38px] items-center justify-center rounded-full border px-4 py-2 text-sm font-medium ${
                            isSelected
                              ? 'border-blue-200 bg-blue-50 text-blue-700'
                              : 'border-[#c7d2df] bg-[#f8fafc] text-black'
                          }`}
                          onClick={() =>
                            setFeedbackForm((currentForm) => ({
                              ...currentForm,
                              satisfactionLevel: level,
                            }))
                          }
                        >
                          {level}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <label className="block">
                  <span className={labelClassName}>Feedback message</span>
                  <textarea
                    className={`${fieldClassName} min-h-[140px] resize-none`}
                    value={feedbackForm.message}
                    onChange={(event) => {
                      setFeedbackForm((currentForm) => ({ ...currentForm, message: event.target.value }))
                      setFeedbackErrors((currentErrors) => ({ ...currentErrors, message: undefined }))
                    }}
                    placeholder="Share what is working well or what should improve"
                    maxLength={1000}
                    aria-invalid={Boolean(feedbackErrors.message)}
                  />
                  <p className={helperClassName}>{normalizeText(feedbackForm.message).length}/1000 characters. Links are not allowed.</p>
                  {feedbackErrors.message && <p className={errorClassName}>{feedbackErrors.message}</p>}
                </label>

                <div className="pt-1">
                  <button type="submit" className={actionButtonClassName} disabled={isAuthLoading || isSubmittingFeedback}>
                    {isSubmittingFeedback ? 'Submitting...' : 'Submit Feedback'}
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
