import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BUSINESS_CATEGORY_OPTIONS } from '../constants/businessCategories.ts'
import { useAuth } from '../context/AuthContext.tsx'
import { usePageMeta } from '../hooks/usePageMeta.ts'
import {
  buildInvitationLink,
  buildInvitationMessage,
  calculateCustomerImpactSummary,
  createCustomerBusinessSupport,
  listCustomerBusinessSupports,
  markBusinessSupportShared,
} from '../lib/customerBusinessSupportService.ts'
import {
  CUSTOMER_FEATURE_OPTIONS,
  createCustomerPlatformSuggestion,
  listCustomerFeatureVotes,
  listCustomerPlatformSuggestions,
  removeFeatureVote,
  voteForFeature,
} from '../lib/customerPlatformSuggestionService.ts'
import type {
  CustomerBusinessSupportRow,
  CustomerBusinessSupportStatus,
} from '../types/customerBusinessSupport.ts'
import type {
  CustomerFeatureKey,
  CustomerFeatureVoteRow,
  CustomerPlatformSuggestionRow,
  CustomerPlatformSuggestionStatus,
  CustomerPlatformSuggestionType,
} from '../types/customerPlatformSuggestion.ts'

type CommunityTab = 'impact' | 'support' | 'shape'

interface CustomerCommunityPageProps {
  activeView?: CommunityTab
  mode?: 'page' | 'menu'
}

interface SupportFormState {
  businessName: string
  businessCategory: string
  businessLocation: string
  customMessage: string
}

interface SupportFormErrors {
  businessName?: string
  businessLocation?: string
  customMessage?: string
}

interface PlatformSuggestionFormState {
  suggestionType: CustomerPlatformSuggestionType
  title: string
  message: string
}

interface PlatformSuggestionFormErrors {
  title?: string
  message?: string
}

type FeedbackMessage = {
  kind: 'success' | 'error'
  text: string
} | null

const defaultSupportFormState: SupportFormState = {
  businessName: '',
  businessCategory: '',
  businessLocation: '',
  customMessage: '',
}

const defaultFeatureSuggestionForm: PlatformSuggestionFormState = {
  suggestionType: 'Feature Suggestion',
  title: '',
  message: '',
}

const defaultImprovementSuggestionForm: PlatformSuggestionFormState = {
  suggestionType: 'Category Suggestion',
  title: '',
  message: '',
}

const improvementSuggestionTypes: CustomerPlatformSuggestionType[] = [
  'Category Suggestion',
  'Platform Improvement',
]

function getActiveTab(hash: string): CommunityTab {
  if (hash === '#support') return 'support'
  if (hash === '#shape') return 'shape'
  return 'impact'
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function containsLink(value: string): boolean {
  return /(https?:\/\/|www\.|[a-z0-9-]+\.[a-z]{2,})/i.test(value)
}

function formatDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable'
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function statusPillClass(status: CustomerBusinessSupportStatus): string {
  switch (status) {
    case 'Profile Published':
      return 'bg-emerald-50 text-emerald-700'
    case 'Invitation Shared':
      return 'bg-blue-50 text-blue-700'
    case 'Nominated':
      return 'bg-amber-50 text-amber-700'
  }
}

function suggestionStatusPillClass(status: CustomerPlatformSuggestionStatus): string {
  switch (status) {
    case 'Added':
      return 'bg-emerald-50 text-emerald-700'
    case 'Planned':
      return 'bg-blue-50 text-blue-700'
    case 'Under Review':
      return 'bg-amber-50 text-amber-700'
    case 'Declined':
      return 'bg-rose-50 text-rose-700'
    case 'Submitted':
      return 'bg-slate-100 text-slate-700'
  }
}

function getMessagePreview(message: string): string {
  return message.length > 140 ? `${message.slice(0, 137)}...` : message
}

function validateSupportForm(formState: SupportFormState): {
  errors: SupportFormErrors
  values: {
    businessName: string
    businessCategory: string
    businessLocation: string
    customMessage: string | null
  }
} {
  const businessName = normalizeText(formState.businessName)
  const businessCategory = normalizeText(formState.businessCategory) || 'Not specified'
  const businessLocation = normalizeText(formState.businessLocation)
  const customMessage = normalizeText(formState.customMessage)
  const errors: SupportFormErrors = {}

  if (!businessName) {
    errors.businessName = 'Please enter the business name.'
  } else if (businessName.length > 80) {
    errors.businessName = 'Business name must be 80 characters or fewer.'
  }

  if (!businessLocation) {
    errors.businessLocation = 'Please enter the business location.'
  } else if (businessLocation.length > 120) {
    errors.businessLocation = 'Business location must be 120 characters or fewer.'
  }

  if (customMessage.length > 300) {
    errors.customMessage = 'Your message must be 300 characters or fewer.'
  } else if (customMessage && containsLink(customMessage)) {
    errors.customMessage = 'Please remove links from your message before sharing.'
  }

  return {
    errors,
    values: {
      businessName,
      businessCategory,
      businessLocation,
      customMessage: customMessage || null,
    },
  }
}

function validatePlatformSuggestionForm(formState: PlatformSuggestionFormState): {
  errors: PlatformSuggestionFormErrors
  values: PlatformSuggestionFormState
} {
  const title = normalizeText(formState.title)
  const message = normalizeText(formState.message)
  const errors: PlatformSuggestionFormErrors = {}

  if (!title) {
    errors.title = 'Please enter a suggestion title.'
  } else if (title.length > 80) {
    errors.title = 'Suggestion title must be 80 characters or fewer.'
  } else if (containsLink(title)) {
    errors.title = 'Please remove links from the suggestion title.'
  }

  if (!message) {
    errors.message = 'Please enter a suggestion message.'
  } else if (message.length > 500) {
    errors.message = 'Suggestion message must be 500 characters or fewer.'
  } else if (containsLink(message)) {
    errors.message = 'Please remove links from the suggestion message.'
  }

  return {
    errors,
    values: {
      suggestionType: formState.suggestionType,
      title,
      message,
    },
  }
}

function invitationLinkForSupport(support: CustomerBusinessSupportRow): string {
  return buildInvitationLink(support, window.location.origin)
}

function CustomerCommunityPage({ activeView, mode = 'page' }: CustomerCommunityPageProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isLoading: isAuthLoading } = useAuth()
  const userId = user?.id ?? null
  const isMenuMode = mode === 'menu'
  const activeTab = activeView ?? getActiveTab(location.hash)

  const [supportForm, setSupportForm] = useState<SupportFormState>(defaultSupportFormState)
  const [formErrors, setFormErrors] = useState<SupportFormErrors>({})
  const [supportedBusinesses, setSupportedBusinesses] = useState<CustomerBusinessSupportRow[]>([])
  const [activeSupport, setActiveSupport] = useState<CustomerBusinessSupportRow | null>(null)
  const [isSupportsLoading, setIsSupportsLoading] = useState(true)
  const [isSavingSupport, setIsSavingSupport] = useState(false)
  const [supportLoadError, setSupportLoadError] = useState<string | null>(null)
  const [supportFeedback, setSupportFeedback] = useState<FeedbackMessage>(null)
  const [previewFeedback, setPreviewFeedback] = useState<FeedbackMessage>(null)
  const [sharingSupportId, setSharingSupportId] = useState<string | null>(null)
  const [featureVotes, setFeatureVotes] = useState<CustomerFeatureVoteRow[]>([])
  const [platformSuggestions, setPlatformSuggestions] = useState<CustomerPlatformSuggestionRow[]>([])
  const [loadedShapeCustomerId, setLoadedShapeCustomerId] = useState<string | null>(null)
  const [isShapeLoading, setIsShapeLoading] = useState(true)
  const [shapeLoadError, setShapeLoadError] = useState<string | null>(null)
  const [shapeFeedback, setShapeFeedback] = useState<FeedbackMessage>(null)
  const [featureSuggestionForm, setFeatureSuggestionForm] = useState<PlatformSuggestionFormState>(
    defaultFeatureSuggestionForm
  )
  const [featureSuggestionErrors, setFeatureSuggestionErrors] = useState<PlatformSuggestionFormErrors>({})
  const [improvementSuggestionForm, setImprovementSuggestionForm] = useState<PlatformSuggestionFormState>(
    defaultImprovementSuggestionForm
  )
  const [improvementSuggestionErrors, setImprovementSuggestionErrors] = useState<PlatformSuggestionFormErrors>({})
  const [votingFeatureKey, setVotingFeatureKey] = useState<CustomerFeatureKey | null>(null)
  const [isSubmittingFeatureSuggestion, setIsSubmittingFeatureSuggestion] = useState(false)
  const [isSubmittingImprovementSuggestion, setIsSubmittingImprovementSuggestion] = useState(false)

  usePageMeta({
    title: 'Your Local Community | Smart Business Profile',
    description: 'Support trusted businesses, track your contribution, and help shape the platform.',
  })

  const sectionClassName =
    'rounded-3xl border border-[#c7d2df] bg-white p-6 shadow-[0_24px_70px_-38px_rgba(2,12,27,0.98)] sm:p-8'
  const actionButtonClassName =
    'inline-flex min-h-[42px] items-center justify-center rounded-full border border-sky-200 bg-blue-50 px-5 py-2.5 text-sm font-semibold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70'
  const secondaryButtonClassName =
    'inline-flex min-h-[42px] items-center justify-center rounded-full border border-[#c7d2df] bg-white px-5 py-2.5 text-sm font-semibold text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70'
  const tabButtonClassName =
    'inline-flex min-h-[42px] items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
  const fieldClassName =
    'mt-2 w-full rounded-2xl border border-[#c7d2df] bg-white px-4 py-3 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500'
  const labelClassName = 'text-sm font-semibold text-black'
  const helperClassName = 'mt-1 text-xs text-slate-500'
  const errorClassName = 'mt-1 text-xs font-medium text-red-700'
  const cardClassName = 'rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-4 py-4'

  const tabs: Array<{ id: CommunityTab; label: string }> = [
    { id: 'impact', label: 'My Local Impact' },
    { id: 'support', label: 'Support a Business' },
    { id: 'shape', label: 'Shape the Platform' },
  ]

  useEffect(() => {
    if ((activeTab !== 'support' && activeTab !== 'impact') || isAuthLoading || !userId) return

    let isCurrent = true

    void listCustomerBusinessSupports(userId)
      .then((supports) => {
        if (!isCurrent) return
        setSupportedBusinesses(supports)
        setSupportLoadError(null)
      })
      .catch((error) => {
        if (!isCurrent) return
        console.error('Failed to load supported businesses:', error)
        setSupportLoadError('We could not load your supported businesses right now. Please try again.')
      })
      .finally(() => {
        if (!isCurrent) return
        setIsSupportsLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [activeTab, isAuthLoading, userId])

  useEffect(() => {
    if (activeTab !== 'shape' || isAuthLoading || !userId) return

    let isCurrent = true

    void Promise.all([
      listCustomerFeatureVotes(userId),
      listCustomerPlatformSuggestions(userId),
    ])
      .then(([votes, suggestions]) => {
        if (!isCurrent) return
        setFeatureVotes(votes)
        setPlatformSuggestions(suggestions)
        setLoadedShapeCustomerId(userId)
        setShapeLoadError(null)
      })
      .catch((error) => {
        if (!isCurrent) return
        console.error('Failed to load customer platform participation:', error)
        setLoadedShapeCustomerId(userId)
        setShapeLoadError('We could not load your platform participation right now. Please try again.')
      })
      .finally(() => {
        if (!isCurrent) return
        setIsShapeLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [activeTab, isAuthLoading, userId])

  const impactSummary = calculateCustomerImpactSummary(supportedBusinesses)
  const impactDisplayError =
    !isAuthLoading && !userId ? 'Please sign in to view your local impact.' : supportLoadError
  const supportDisplayError =
    !isAuthLoading && !userId ? 'Please sign in to support a business.' : supportLoadError
  const shapeDisplayError =
    !isAuthLoading && !userId ? 'Please sign in to shape the platform.' : shapeLoadError
  const showShapeLoading =
    isAuthLoading || Boolean(userId && (isShapeLoading || loadedShapeCustomerId !== userId))
  const votedFeatureKeys = new Set(featureVotes.map((vote) => vote.feature_key))

  const updateSupportInList = (nextSupport: CustomerBusinessSupportRow) => {
    setSupportedBusinesses((currentSupports) =>
      currentSupports.map((support) => (support.id === nextSupport.id ? nextSupport : support))
    )
    setActiveSupport((currentSupport) =>
      currentSupport?.id === nextSupport.id ? nextSupport : currentSupport
    )
  }

  const handleSupportFormChange = (field: keyof SupportFormState, value: string) => {
    setSupportForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))

    if (formErrors[field as keyof SupportFormErrors]) {
      setFormErrors((currentErrors) => ({
        ...currentErrors,
        [field]: undefined,
      }))
    }
  }

  const handlePlatformSuggestionFormChange = (
    formKind: 'feature' | 'improvement',
    field: keyof PlatformSuggestionFormState,
    value: string
  ) => {
    if (formKind === 'feature') {
      setFeatureSuggestionForm((currentForm) => ({
        ...currentForm,
        [field]: value,
      }))

      if (featureSuggestionErrors[field as keyof PlatformSuggestionFormErrors]) {
        setFeatureSuggestionErrors((currentErrors) => ({
          ...currentErrors,
          [field]: undefined,
        }))
      }

      return
    }

    setImprovementSuggestionForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))

    if (improvementSuggestionErrors[field as keyof PlatformSuggestionFormErrors]) {
      setImprovementSuggestionErrors((currentErrors) => ({
        ...currentErrors,
        [field]: undefined,
      }))
    }
  }

  const handleCreateSupport = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()

    if (!userId || isSavingSupport) return

    const validation = validateSupportForm(supportForm)
    setFormErrors(validation.errors)
    setSupportFeedback(null)
    setPreviewFeedback(null)

    if (Object.keys(validation.errors).length > 0) {
      return
    }

    setIsSavingSupport(true)

    try {
      const createdSupport = await createCustomerBusinessSupport({
        customerId: userId,
        ...validation.values,
      })
      setSupportedBusinesses((currentSupports) => [createdSupport, ...currentSupports])
      setActiveSupport(createdSupport)
      setSupportForm(defaultSupportFormState)
      setSupportFeedback({ kind: 'success', text: 'Invitation generated. You can copy or share it now.' })
    } catch (error) {
      console.error('Failed to create supported business:', error)
      setSupportFeedback({ kind: 'error', text: 'We could not save this supported business. Please try again.' })
    } finally {
      setIsSavingSupport(false)
    }
  }

  const handleToggleFeatureVote = async (feature: (typeof CUSTOMER_FEATURE_OPTIONS)[number]): Promise<void> => {
    if (!userId || votingFeatureKey) return

    const hasVoted = votedFeatureKeys.has(feature.key)
    setVotingFeatureKey(feature.key)
    setShapeFeedback(null)

    try {
      if (hasVoted) {
        await removeFeatureVote(userId, feature.key)
        setFeatureVotes((currentVotes) =>
          currentVotes.filter((vote) => vote.feature_key !== feature.key)
        )
        return
      }

      const createdVote = await voteForFeature(userId, feature)
      setFeatureVotes((currentVotes) => [createdVote, ...currentVotes])
    } catch (error) {
      console.error('Failed to update customer feature vote:', error)
      setShapeFeedback({ kind: 'error', text: 'We could not update your vote right now. Please try again.' })
    } finally {
      setVotingFeatureKey(null)
    }
  }

  const refreshPlatformSuggestions = async (): Promise<void> => {
    if (!userId) return

    const suggestions = await listCustomerPlatformSuggestions(userId)
    setPlatformSuggestions(suggestions)
  }

  const handleCreatePlatformSuggestion = async (
    event: FormEvent<HTMLFormElement>,
    formKind: 'feature' | 'improvement'
  ): Promise<void> => {
    event.preventDefault()

    if (!userId) return

    const isFeatureForm = formKind === 'feature'
    const isSubmitting = isFeatureForm ? isSubmittingFeatureSuggestion : isSubmittingImprovementSuggestion
    if (isSubmitting) return

    const formState = isFeatureForm ? featureSuggestionForm : improvementSuggestionForm
    const validation = validatePlatformSuggestionForm(formState)
    setShapeFeedback(null)

    if (isFeatureForm) {
      setFeatureSuggestionErrors(validation.errors)
    } else {
      setImprovementSuggestionErrors(validation.errors)
    }

    if (Object.keys(validation.errors).length > 0) {
      return
    }

    if (isFeatureForm) {
      setIsSubmittingFeatureSuggestion(true)
    } else {
      setIsSubmittingImprovementSuggestion(true)
    }

    try {
      await createCustomerPlatformSuggestion({
        customerId: userId,
        suggestionType: validation.values.suggestionType,
        title: validation.values.title,
        message: validation.values.message,
      })
      await refreshPlatformSuggestions()

      if (isFeatureForm) {
        setFeatureSuggestionForm(defaultFeatureSuggestionForm)
      } else {
        setImprovementSuggestionForm(defaultImprovementSuggestionForm)
      }

      setShapeFeedback({ kind: 'success', text: 'Suggestion submitted.' })
    } catch (error) {
      console.error('Failed to create customer platform suggestion:', error)
      setShapeFeedback({ kind: 'error', text: 'We could not submit your suggestion. Please try again.' })
    } finally {
      if (isFeatureForm) {
        setIsSubmittingFeatureSuggestion(false)
      } else {
        setIsSubmittingImprovementSuggestion(false)
      }
    }
  }

  const markSupportShared = async (support: CustomerBusinessSupportRow): Promise<void> => {
    if (!userId) return

    setSharingSupportId(support.id)

    try {
      const nextSupport = await markBusinessSupportShared(support.id, userId)
      updateSupportInList(nextSupport)
    } catch (error) {
      console.error('Failed to update supported business share status:', error)
      setPreviewFeedback({
        kind: 'error',
        text: 'Shared, but we could not update the invitation status right now.',
      })
    } finally {
      setSharingSupportId(null)
    }
  }

  const copyTextToClipboard = async (text: string): Promise<boolean> => {
    if (!navigator.clipboard?.writeText) {
      setPreviewFeedback({
        kind: 'error',
        text: 'Clipboard copy is not available in this browser.',
      })
      return false
    }

    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      setPreviewFeedback({
        kind: 'error',
        text: 'We could not copy to your clipboard. Please try again.',
      })
      return false
    }
  }

  const handleCopyMessage = async (support: CustomerBusinessSupportRow): Promise<void> => {
    const invitationLink = invitationLinkForSupport(support)
    const invitationMessage = buildInvitationMessage(support, invitationLink)

    setPreviewFeedback(null)
    const copied = await copyTextToClipboard(invitationMessage)
    if (!copied) return

    setPreviewFeedback({ kind: 'success', text: 'Invitation message copied.' })
    await markSupportShared(support)
  }

  const handleCopyInvitationLink = async (support: CustomerBusinessSupportRow): Promise<void> => {
    const invitationLink = invitationLinkForSupport(support)

    setPreviewFeedback(null)
    const copied = await copyTextToClipboard(invitationLink)
    if (!copied) return

    setPreviewFeedback({ kind: 'success', text: 'Invitation link copied.' })
    await markSupportShared(support)
  }

  const handleWhatsAppShare = async (support: CustomerBusinessSupportRow): Promise<void> => {
    const invitationLink = invitationLinkForSupport(support)
    const invitationMessage = buildInvitationMessage(support, invitationLink)
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(invitationMessage)}`

    setPreviewFeedback({ kind: 'success', text: 'WhatsApp share opened.' })
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
    await markSupportShared(support)
  }

  const handleShareAgain = (support: CustomerBusinessSupportRow) => {
    setActiveSupport(support)
    setPreviewFeedback(null)
    setSupportFeedback({
      kind: 'success',
      text: 'Invitation preview loaded. You can share this business again.',
    })
  }

  const activeInvitationLink = activeSupport ? invitationLinkForSupport(activeSupport) : ''
  const activeInvitationMessage = activeSupport
    ? buildInvitationMessage(activeSupport, activeInvitationLink)
    : ''

  return (
    <div className={isMenuMode ? 'text-black' : 'min-h-screen bg-[#eef4fa] text-black'}>
      <main className={isMenuMode ? '' : 'mx-auto max-w-4xl px-4 py-10 sm:py-12'}>
        {!isMenuMode && (
          <>
            <section className="mb-8">
              <div className="inline-flex items-center rounded-full border border-[#c7d2df] bg-white px-3 py-1 text-xs font-semibold text-blue-700">
                Community Preview
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-black sm:text-3xl">Your Local Community</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black sm:text-base">
                Support trusted businesses, track your contribution, and help shape the platform.
              </p>
            </section>

            <div className="mb-6 flex flex-wrap gap-3">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id

                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`${tabButtonClassName} ${
                      isActive
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-[#c7d2df] bg-white text-black'
                    }`}
                    onClick={() => navigate(`/customer/community#${tab.id}`)}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </>
        )}

        <div>
          {activeTab === 'impact' && (
            <section id="impact" className={sectionClassName}>
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-black sm:text-xl">My Local Impact</h2>
                <p className="mt-1 text-sm text-black">
                  See how the businesses you support contribute to your local community impact.
                </p>
              </div>

              {isSupportsLoading && !impactDisplayError && (
                <div className={`mt-5 ${cardClassName}`}>
                  <p className="text-sm text-black">Loading your local impact...</p>
                </div>
              )}

              {impactDisplayError && (
                <div className={`mt-5 ${cardClassName}`}>
                  <p className="text-sm text-red-700">{impactDisplayError}</p>
                </div>
              )}

              {!isSupportsLoading && !impactDisplayError && impactSummary.businessesSupported === 0 && (
                <div className={`mt-5 ${cardClassName}`}>
                  <p className="text-base font-semibold text-black">Start building your local impact</p>
                  <p className="mt-1 text-sm text-black">
                    Businesses you support will appear here as part of your local contribution.
                  </p>
                  <div className="mt-4">
                    <button
                      type="button"
                      className={actionButtonClassName}
                      onClick={() => navigate('/customer/community#support')}
                    >
                      Support a Business
                    </button>
                  </div>
                </div>
              )}

              {!isSupportsLoading && !impactDisplayError && impactSummary.businessesSupported > 0 && (
                <>
                  <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
                          Current supporter badge
                        </p>
                        <p className="mt-1 text-xl font-semibold text-black">{impactSummary.badge}</p>
                        <p className="mt-2 text-sm text-black">
                          Your support helps trusted local businesses become easier to find online.
                        </p>
                      </div>
                      <span className="inline-flex self-start rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700">
                        {impactSummary.level}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className={cardClassName}>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Businesses supported
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-black">{impactSummary.businessesSupported}</p>
                    </div>
                    <div className={cardClassName}>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Invitations shared
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-black">{impactSummary.invitationsShared}</p>
                    </div>
                    <div className={cardClassName}>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Profiles published
                      </p>
                      <p className="mt-1 text-2xl font-semibold text-black">{impactSummary.profilesPublished}</p>
                    </div>
                  </div>

                  <div className={`mt-5 ${cardClassName}`}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Progress toward next level
                        </p>
                        <p className="mt-1 text-sm font-medium text-black">{impactSummary.progress.text}</p>
                      </div>
                      <p className="text-sm font-semibold text-blue-700">{impactSummary.progress.percent}%</p>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${impactSummary.progress.percent}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-7">
                    <h3 className="text-base font-semibold text-black">Recent supported businesses</h3>
                    <div className="mt-4 space-y-3">
                      {impactSummary.recentSupports.map((support) => (
                        <article key={support.id} className={cardClassName}>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-base font-semibold text-black">{support.business_name}</p>
                              <p className="mt-1 text-sm text-black">{support.business_category}</p>
                              <p className="mt-1 text-sm text-black">{support.business_location}</p>
                              <p className="mt-2 text-sm text-slate-500">Submitted {formatDate(support.created_at)}</p>
                            </div>
                            <span
                              className={`inline-flex self-start rounded-full px-3 py-1 text-xs font-semibold ${statusPillClass(
                                support.status
                              )}`}
                            >
                              {support.status}
                            </span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <button type="button" className={secondaryButtonClassName} disabled>
                      View Impact Details
                    </button>
                    <p className="text-sm text-slate-500">Detailed impact insights are coming soon.</p>
                  </div>
                </>
              )}
            </section>
          )}

          {activeTab === 'support' && (
            <section id="support" className={sectionClassName}>
              <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4">
                <h2 className="text-lg font-semibold tracking-tight text-black sm:text-xl">
                  Support a Trusted Local Business
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black">
                  Know a local business that should be easier to find online? Invite them to create a professional digital profile and become part of your local business network.
                </p>
                <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-black sm:grid-cols-3">
                  <div className="rounded-2xl border border-blue-100 bg-white px-3 py-3">1. Add basic business details</div>
                  <div className="rounded-2xl border border-blue-100 bg-white px-3 py-3">2. Write or edit your invitation message</div>
                  <div className="rounded-2xl border border-blue-100 bg-white px-3 py-3">3. Share the invitation with the business owner</div>
                </div>
              </div>

              {supportFeedback && (
                <div
                  className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
                    supportFeedback.kind === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-red-200 bg-red-50 text-red-700'
                  }`}
                >
                  {supportFeedback.text}
                </div>
              )}

              <form className="mt-6 space-y-5" onSubmit={(event) => void handleCreateSupport(event)}>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelClassName}>Business name</span>
                    <input
                      type="text"
                      value={supportForm.businessName}
                      onChange={(event) => handleSupportFormChange('businessName', event.target.value)}
                      placeholder="Example: Sharma Dental Clinic"
                      maxLength={90}
                      className={fieldClassName}
                      aria-invalid={Boolean(formErrors.businessName)}
                    />
                    {formErrors.businessName && <p className={errorClassName}>{formErrors.businessName}</p>}
                  </label>

                  <label className="block">
                    <span className={labelClassName}>Business category</span>
                    <select
                      value={supportForm.businessCategory}
                      onChange={(event) => handleSupportFormChange('businessCategory', event.target.value)}
                      className={fieldClassName}
                    >
                      <option value="">Select category</option>
                      {BUSINESS_CATEGORY_OPTIONS.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                    <p className={helperClassName}>Optional. If skipped, it will be saved as Not specified.</p>
                  </label>
                </div>

                <label className="block">
                  <span className={labelClassName}>Business location</span>
                  <input
                    type="text"
                    value={supportForm.businessLocation}
                    onChange={(event) => handleSupportFormChange('businessLocation', event.target.value)}
                    placeholder="Example: Vaishali Nagar, Jaipur"
                    maxLength={130}
                    className={fieldClassName}
                    aria-invalid={Boolean(formErrors.businessLocation)}
                  />
                  {formErrors.businessLocation && <p className={errorClassName}>{formErrors.businessLocation}</p>}
                </label>

                <label className="block">
                  <span className={labelClassName}>Your message to the business owner</span>
                  <textarea
                    value={supportForm.customMessage}
                    onChange={(event) => handleSupportFormChange('customMessage', event.target.value)}
                    placeholder="I trust your business and thought more customers should be able to find and contact you online."
                    rows={4}
                    maxLength={320}
                    className={fieldClassName}
                    aria-invalid={Boolean(formErrors.customMessage)}
                  />
                  <p className={helperClassName}>{normalizeText(supportForm.customMessage).length}/300 characters. Links are not allowed.</p>
                  {formErrors.customMessage && <p className={errorClassName}>{formErrors.customMessage}</p>}
                </label>

                <button
                  type="submit"
                  className={actionButtonClassName}
                  disabled={isSavingSupport || !userId}
                >
                  {isSavingSupport ? 'Generating...' : 'Save & Generate Invitation'}
                </button>
              </form>

              {activeSupport && (
                <div className="mt-7 rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-black">Invitation Preview</h3>
                      <p className="mt-1 text-sm text-black">{activeSupport.business_name}</p>
                    </div>
                    <span
                      className={`inline-flex self-start rounded-full px-3 py-1 text-xs font-semibold ${statusPillClass(
                        activeSupport.status
                      )}`}
                    >
                      {activeSupport.status}
                    </span>
                  </div>

                  <pre className="mt-4 whitespace-pre-wrap rounded-2xl border border-[#c7d2df] bg-white px-4 py-4 text-sm leading-relaxed text-black">
                    {activeInvitationMessage}
                  </pre>

                  {previewFeedback && (
                    <div
                      className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                        previewFeedback.kind === 'success'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-red-200 bg-red-50 text-red-700'
                      }`}
                    >
                      {previewFeedback.text}
                    </div>
                  )}

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      onClick={() => void handleCopyMessage(activeSupport)}
                      disabled={sharingSupportId === activeSupport.id}
                    >
                      Copy Message
                    </button>
                    <button
                      type="button"
                      className={actionButtonClassName}
                      onClick={() => void handleWhatsAppShare(activeSupport)}
                      disabled={sharingSupportId === activeSupport.id}
                    >
                      Share on WhatsApp
                    </button>
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      onClick={() => void handleCopyInvitationLink(activeSupport)}
                      disabled={sharingSupportId === activeSupport.id}
                    >
                      Copy Invitation Link
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-7">
                <h3 className="text-base font-semibold text-black">Supported Businesses</h3>

                <div className="mt-4 space-y-4">
                  {isSupportsLoading && !supportDisplayError && (
                    <div className={cardClassName}>
                      <p className="text-sm text-black">Loading supported businesses...</p>
                    </div>
                  )}

                  {supportDisplayError && (
                    <div className={cardClassName}>
                      <p className="text-sm text-red-700">{supportDisplayError}</p>
                    </div>
                  )}

                  {!isSupportsLoading && !supportDisplayError && supportedBusinesses.length === 0 && (
                    <div className={cardClassName}>
                      <p className="text-sm font-semibold text-black">No supported businesses yet</p>
                      <p className="mt-1 text-sm text-black">Businesses you invite will appear here.</p>
                    </div>
                  )}

                  {!supportDisplayError &&
                    supportedBusinesses.map((support) => (
                      <article key={support.id} className={cardClassName}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-base font-semibold text-black">{support.business_name}</p>
                            <p className="mt-1 text-sm text-black">{support.business_category}</p>
                            <p className="mt-1 text-sm text-black">{support.business_location}</p>
                          </div>
                          <span
                            className={`inline-flex self-start rounded-full px-3 py-1 text-xs font-semibold ${statusPillClass(
                              support.status
                            )}`}
                          >
                            {support.status}
                          </span>
                        </div>

                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm text-slate-500">Submitted {formatDate(support.created_at)}</p>
                          <button
                            type="button"
                            className={secondaryButtonClassName}
                            onClick={() => handleShareAgain(support)}
                          >
                            Share Again
                          </button>
                        </div>
                      </article>
                    ))}
                </div>
              </div>
            </section>
          )}

          {activeTab === 'shape' && (
            <section id="shape" className={sectionClassName}>
              <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4">
                <h2 className="text-lg font-semibold tracking-tight text-black sm:text-xl">Shape the Platform</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black">
                  Vote on upcoming features, suggest improvements, and help us build a better local business network.
                </p>
              </div>

              {shapeFeedback && (
                <div
                  className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
                    shapeFeedback.kind === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-red-200 bg-red-50 text-red-700'
                  }`}
                >
                  {shapeFeedback.text}
                </div>
              )}

              {showShapeLoading && !shapeDisplayError && (
                <div className={`mt-5 ${cardClassName}`}>
                  <p className="text-sm text-black">Loading platform options...</p>
                </div>
              )}

              {shapeDisplayError && (
                <div className={`mt-5 ${cardClassName}`}>
                  <p className="text-sm text-red-700">{shapeDisplayError}</p>
                </div>
              )}

              {!showShapeLoading && !shapeDisplayError && (
                <>
                  <div className="mt-7">
                    <h3 className="text-base font-semibold text-black">Vote on Upcoming Features</h3>
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {CUSTOMER_FEATURE_OPTIONS.map((feature) => {
                        const hasVoted = votedFeatureKeys.has(feature.key)
                        const isVoting = votingFeatureKey === feature.key

                        return (
                          <article key={feature.key} className={cardClassName}>
                            <div className="flex h-full flex-col justify-between gap-4">
                              <div>
                                <h4 className="text-sm font-semibold text-black sm:text-base">{feature.title}</h4>
                                <p className="mt-2 text-sm leading-relaxed text-black">{feature.description}</p>
                              </div>
                              <button
                                type="button"
                                className={hasVoted ? secondaryButtonClassName : actionButtonClassName}
                                onClick={() => void handleToggleFeatureVote(feature)}
                                disabled={Boolean(votingFeatureKey)}
                              >
                                {isVoting ? 'Updating...' : hasVoted ? 'Voted' : 'Vote'}
                              </button>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                    <p className={helperClassName}>
                      Your votes are private. Public vote counts and leaderboards are not part of this MVP.
                    </p>
                  </div>

                  <form
                    className="mt-8 rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-4 py-4"
                    onSubmit={(event) => void handleCreatePlatformSuggestion(event, 'feature')}
                  >
                    <div>
                      <h3 className="text-base font-semibold text-black">Submit Feature Suggestion</h3>
                      <p className="mt-1 text-sm text-black">Share one feature idea that would make the platform better.</p>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-5">
                      <label className="block">
                        <span className={labelClassName}>Suggestion title</span>
                        <input
                          type="text"
                          value={featureSuggestionForm.title}
                          onChange={(event) =>
                            handlePlatformSuggestionFormChange('feature', 'title', event.target.value)
                          }
                          placeholder="Example: WhatsApp enquiry button"
                          maxLength={80}
                          className={fieldClassName}
                          aria-invalid={Boolean(featureSuggestionErrors.title)}
                        />
                        <p className={helperClassName}>{normalizeText(featureSuggestionForm.title).length}/80 characters. Links are not allowed.</p>
                        {featureSuggestionErrors.title && <p className={errorClassName}>{featureSuggestionErrors.title}</p>}
                      </label>

                      <label className="block">
                        <span className={labelClassName}>Suggestion message</span>
                        <textarea
                          value={featureSuggestionForm.message}
                          onChange={(event) =>
                            handlePlatformSuggestionFormChange('feature', 'message', event.target.value)
                          }
                          placeholder="Describe what the feature should do and why it would help customers."
                          rows={4}
                          maxLength={500}
                          className={fieldClassName}
                          aria-invalid={Boolean(featureSuggestionErrors.message)}
                        />
                        <p className={helperClassName}>{normalizeText(featureSuggestionForm.message).length}/500 characters. Links are not allowed.</p>
                        {featureSuggestionErrors.message && <p className={errorClassName}>{featureSuggestionErrors.message}</p>}
                      </label>
                    </div>

                    <div className="mt-5">
                      <button
                        type="submit"
                        className={actionButtonClassName}
                        disabled={isSubmittingFeatureSuggestion || !userId}
                      >
                        {isSubmittingFeatureSuggestion ? 'Submitting...' : 'Submit Feature Suggestion'}
                      </button>
                    </div>
                  </form>

                  <form
                    className="mt-5 rounded-2xl border border-[#c7d2df] bg-[#f8fafc] px-4 py-4"
                    onSubmit={(event) => void handleCreatePlatformSuggestion(event, 'improvement')}
                  >
                    <div>
                      <h3 className="text-base font-semibold text-black">Suggest Category or Improvement</h3>
                      <p className="mt-1 text-sm text-black">Suggest a missing category or a focused platform improvement.</p>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-5">
                      <label className="block">
                        <span className={labelClassName}>Suggestion type</span>
                        <select
                          value={improvementSuggestionForm.suggestionType}
                          onChange={(event) =>
                            handlePlatformSuggestionFormChange('improvement', 'suggestionType', event.target.value)
                          }
                          className={fieldClassName}
                        >
                          {improvementSuggestionTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className={labelClassName}>Title</span>
                        <input
                          type="text"
                          value={improvementSuggestionForm.title}
                          onChange={(event) =>
                            handlePlatformSuggestionFormChange('improvement', 'title', event.target.value)
                          }
                          placeholder="Example: Pet Grooming"
                          maxLength={80}
                          className={fieldClassName}
                          aria-invalid={Boolean(improvementSuggestionErrors.title)}
                        />
                        <p className={helperClassName}>{normalizeText(improvementSuggestionForm.title).length}/80 characters. Links are not allowed.</p>
                        {improvementSuggestionErrors.title && <p className={errorClassName}>{improvementSuggestionErrors.title}</p>}
                      </label>

                      <label className="block">
                        <span className={labelClassName}>Message</span>
                        <textarea
                          value={improvementSuggestionForm.message}
                          onChange={(event) =>
                            handlePlatformSuggestionFormChange('improvement', 'message', event.target.value)
                          }
                          placeholder="Add context for the category or improvement you want to suggest."
                          rows={4}
                          maxLength={500}
                          className={fieldClassName}
                          aria-invalid={Boolean(improvementSuggestionErrors.message)}
                        />
                        <p className={helperClassName}>{normalizeText(improvementSuggestionForm.message).length}/500 characters. Links are not allowed.</p>
                        {improvementSuggestionErrors.message && <p className={errorClassName}>{improvementSuggestionErrors.message}</p>}
                      </label>
                    </div>

                    <div className="mt-5">
                      <button
                        type="submit"
                        className={actionButtonClassName}
                        disabled={isSubmittingImprovementSuggestion || !userId}
                      >
                        {isSubmittingImprovementSuggestion ? 'Submitting...' : 'Submit Suggestion'}
                      </button>
                    </div>
                  </form>

                  <div className="mt-8">
                    <h3 className="text-base font-semibold text-black">My Suggestions</h3>
                    <div className="mt-4 space-y-4">
                      {platformSuggestions.length === 0 && (
                        <div className={cardClassName}>
                          <p className="text-sm font-semibold text-black">No suggestions yet</p>
                          <p className="mt-1 text-sm text-black">
                            Your submitted ideas and improvements will appear here.
                          </p>
                        </div>
                      )}

                      {platformSuggestions.map((suggestion) => (
                        <article key={suggestion.id} className={cardClassName}>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                                {suggestion.suggestion_type}
                              </p>
                              <h4 className="mt-1 text-base font-semibold text-black">{suggestion.title}</h4>
                              <p className="mt-2 text-sm leading-relaxed text-black">
                                {getMessagePreview(suggestion.message)}
                              </p>
                              <p className="mt-2 text-sm text-slate-500">
                                Submitted {formatDate(suggestion.created_at)}
                              </p>
                            </div>
                            <span
                              className={`inline-flex self-start rounded-full px-3 py-1 text-xs font-semibold ${suggestionStatusPillClass(
                                suggestion.status
                              )}`}
                            >
                              {suggestion.status}
                            </span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  )
}

export default CustomerCommunityPage
