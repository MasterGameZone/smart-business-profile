import { useEffect, useRef, useState, type CSSProperties, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  formatKeywordsForForm,
  formatServicesForForm,
  normalizeBusinessProfileDocuments,
  normalizeFaqItems,
  normalizeProductItems,
  normalizeQualificationItems,
  normalizeSocialLinks,
  normalizeStringArray,
  normalizeWorkingHours,
  useProfile,
} from '../context/ProfileContext.tsx'
import { useAuth } from '../context/AuthContext.tsx'
import { signOut } from '../lib/authService.ts'
import {
  ensureProfileUpdateReminderNotification,
  listBusinessOwnerNotifications,
  markBusinessOwnerNotificationRead,
} from '../lib/businessOwnerNotificationService.ts'
import {
  getBusinessOwnerNotificationPreference,
  upsertBusinessOwnerNotificationPreference,
} from '../lib/businessOwnerNotificationPreferenceService.ts'
import {
  createBusinessOwnerHelpSuggestion,
  listBusinessOwnerHelpSuggestions,
} from '../lib/businessOwnerHelpSuggestionService.ts'
import {
  getBusinessOwnerProfile,
  upsertBusinessOwnerProfile,
} from '../lib/businessOwnerProfileService.ts'
import type { BusinessProfileRow } from '../types/businessProfile.ts'
import type {
  BusinessOwnerHelpSuggestionRow,
  BusinessOwnerHelpSuggestionType,
  CreateBusinessOwnerHelpSuggestionInput,
} from '../types/businessOwnerHelpSuggestion.ts'
import type { BusinessOwnerNotificationRow } from '../types/businessOwnerNotification.ts'
import type { BusinessOwnerProfileFormValues } from '../types/businessOwnerProfile.ts'
import { ToastContainer, type ToastItem } from './Toast.tsx'

interface AppHeaderPreviewConfig {
  backPath: string
  backLabel: string
}

interface AppHeaderProps {
  previewConfig?: AppHeaderPreviewConfig | null
  variant?: 'default' | 'publicBusinessProfile'
  businessOwnerMenuState?: BusinessOwnerMenuState | null
}

interface NavItem {
  label: string
  path: string
  emphasis?: boolean
  type?: 'route' | 'scroll'
}

interface HomeMenuItem {
  label: string
  path?: string
  disabled?: boolean
  onSelect?: () => void | Promise<void>
}

interface BusinessOwnerMenuState {
  hasBusinessProfile: boolean
  businessProfile?: BusinessProfileRow | null
  businessName?: string
  ownerEmail?: string
  businessCategory?: string
  businessLogoUrl?: string | null
  businessSlug?: string | null
  profileStatusLabel?: string
}

type BusinessOwnerMenuPanel = 'main' | 'profile' | 'analytics' | 'notifications' | 'settings'
type BusinessOwnerSettingsView = 'main' | 'faqs' | 'suggestions' | 'recent'
type BusinessOwnerPhoneModalMode = 'add' | 'change'
type BusinessOwnerPhoneModalStep = 'phone' | 'otp' | 'success'
let hasPlayedNavbarEntrance = false

function getInitials(value: string): string {
  return value
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'SB'
}

function getMetadataString(metadata: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return null
}

function ProfileIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 19.5h16M7.5 19.5v-1.25A4.25 4.25 0 0 1 11.75 14h.5A4.25 4.25 0 0 1 16.5 18.25v1.25" />
      <circle cx="12" cy="8.5" r="3.25" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
    </svg>
  )
}

function AnalyticsIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 19.5h16M6.5 16V10m5 6V7m5.5 9V12" />
    </svg>
  )
}

function NotificationsIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19.4 15a1.8 1.8 0 00.36 1.98l.05.05a2 2 0 01-2.83 2.83l-.05-.05A1.8 1.8 0 0015 19.4a1.8 1.8 0 00-1.1 1.65V21a2 2 0 01-4 0v-.07A1.8 1.8 0 008.8 19.3a1.8 1.8 0 00-1.98.36l-.05.05a2 2 0 01-2.83-2.83l.05-.05A1.8 1.8 0 004.6 15a1.8 1.8 0 00-1.65-1.1H3a2 2 0 010-4h.07A1.8 1.8 0 004.7 8.8a1.8 1.8 0 00-.36-1.98l-.05-.05a2 2 0 012.83-2.83l.05.05A1.8 1.8 0 009 4.6a1.8 1.8 0 001.1-1.65V3a2 2 0 014 0v.07A1.8 1.8 0 0015.2 4.7a1.8 1.8 0 001.98-.36l.05-.05a2 2 0 012.83 2.83l-.05.05A1.8 1.8 0 0019.4 9c.7.25 1.6.7 1.6 1.65v2.7c0 .95-.9 1.4-1.6 1.65z" />
    </svg>
  )
}

function SwitchIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h11l-2.5-2.5M17.5 5.5 20 8m-1 9H8l2.5 2.5M8.5 18.5 6 16" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 8.5a4.5 4.5 0 0 1 4.5-4.5h1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 15.5a4.5 4.5 0 0 1-4.5 4.5h-1.5" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17l-4-5 4-5" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 12h9" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14 4.5h3.5A2.5 2.5 0 0 1 20 7v10a2.5 2.5 0 0 1-2.5 2.5H14" />
    </svg>
  )
}

function containsLink(value: string): boolean {
  return /(https?:\/\/|www\.)/i.test(value)
}

function normalizePhoneNumber(value: string): string {
  return value.replace(/\D/g, '')
}

function isValidPhoneNumber(value: string): boolean {
  if (!value) {
    return true
  }

  return /^\d{10}$/.test(value)
}

function formatNotificationDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatBusinessOwnerHelpSuggestionTypeLabel(type: BusinessOwnerHelpSuggestionType): string {
  switch (type) {
    case 'suggestion':
      return 'Suggestion'
    case 'help_request':
      return 'Help request'
    case 'issue_problem':
      return 'Issue / problem'
    case 'profile_improvement_help':
      return 'Profile improvement help'
    default:
      return type
  }
}

function formatBusinessOwnerHelpSuggestionStatusLabel(status: BusinessOwnerHelpSuggestionRow['status']): string {
  switch (status) {
    case 'submitted':
      return 'Submitted'
    case 'in_review':
      return 'In Review'
    case 'replied':
      return 'Replied'
    case 'closed':
      return 'Closed'
    default:
      return status
  }
}

const businessOwnerFaqItems = [
  {
    question: 'How do I complete my business profile?',
    answer:
      'Go to Edit Profile and fill in your business details, contact information, location, services, gallery, working hours, and other important sections. A more complete profile helps customers understand and trust your business.',
  },
  {
    question: 'How do I edit my business profile?',
    answer:
      'Use the Edit Profile action from your Business Home or business account menu. You can update your business details, contact information, services, images, working hours, and other profile sections.',
  },
  {
    question: 'How do I view my public business profile?',
    answer:
      'Use View Profile to open the public version of your business profile. This is the page customers will see when they open your business link or QR code.',
  },
  {
    question: 'How do I share my business profile?',
    answer:
      'Use the Share Profile action to copy or share your public business profile link. You can send this link to customers through WhatsApp, messages, social media, or other channels.',
  },
  {
    question: 'How does the QR Code work?',
    answer:
      'Your QR Code opens your public business profile. You can download or share it so customers can scan it and quickly view your business details.',
  },
  {
    question: 'How do I update my gallery images?',
    answer:
      'Use Manage Gallery or Edit Profile to add, remove, or update business images. Good-quality images help customers understand your work, place, products, or services.',
  },
  {
    question: 'What does Profile Completion mean?',
    answer:
      'Profile Completion shows how much important business information you have added. Completing more sections can make your profile more useful and trustworthy for customers.',
  },
  {
    question: 'Why should I add working hours?',
    answer:
      'Working hours help customers know when your business is open. They also improve the usefulness of your profile when customers want to call, visit, or contact you.',
  },
  {
    question: 'Why should I add certificates or documents?',
    answer:
      'Certificates, licenses, qualifications, or documents can help build trust, especially for professional services, clinics, consultants, tutors, and similar businesses.',
  },
  {
    question: 'Can customers contact me from my profile?',
    answer:
      'Yes. Customers can use the contact actions available on your public profile, such as call, WhatsApp, email, directions, website, or other links you have added.',
  },
  {
    question: 'Can I switch back to Customer mode?',
    answer:
      'Yes. Use Switch to Customer from the business account menu to browse and interact with businesses as a customer.',
  },
  {
    question: 'Why should I keep my profile updated?',
    answer:
      'Updated information helps customers get the correct contact details, services, location, working hours, and business details. This reduces confusion and improves trust.',
  },
]

const businessOwnerSuggestionTypeOptions: Array<{
  value: BusinessOwnerHelpSuggestionType
  label: string
}> = [
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'help_request', label: 'Help request' },
  { value: 'issue_problem', label: 'Issue / problem' },
  { value: 'profile_improvement_help', label: 'Profile improvement help' },
]

const businessOwnerSuggestionSubjectOptionsByType: Record<BusinessOwnerHelpSuggestionType, string[]> = {
  suggestion: [
    'New feature suggestion',
    'Improve business profile design',
    'Improve QR Code feature',
    'Improve profile sharing',
    'Improve customer contact options',
    'Improve gallery/images section',
    'Improve business search/directory',
    'Improve business account menu',
    'Improve notifications',
    'Others',
  ],
  help_request: [
    'Help completing my business profile',
    'Help editing business details',
    'Help adding services/products',
    'Help adding gallery/images',
    'Help adding working hours',
    'Help with QR Code',
    'Help sharing my profile',
    'Help switching account mode',
    'Help understanding profile completion',
    'Others',
  ],
  issue_problem: [
    'Profile is not saving',
    'Images are not uploading',
    'Gallery is not updating',
    'QR Code is not working',
    'Public profile is not opening',
    'Business details are showing incorrectly',
    'Contact buttons are not working',
    'Notifications are not loading correctly',
    'Account/menu issue',
    'Others',
  ],
  profile_improvement_help: [
    'Improve my profile content',
    'Improve my business description',
    'Improve services/products section',
    'Improve gallery/images',
    'Improve working hours/contact details',
    'Improve trust with certificates/documents',
    'Improve profile completion score',
    'Improve customer conversion',
    'Improve profile presentation/design',
    'Others',
  ],
}

interface BusinessOwnerSuggestionFormState {
  type: BusinessOwnerHelpSuggestionType
  subject: string
  customSubject: string
  message: string
}

function AppHeader({ previewConfig = null, variant = 'default', businessOwnerMenuState = null }: AppHeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isLoading, accountMode, isBusinessOwnerEnabled, setPreferredAccountMode } = useAuth()
  const { profileData, setProfileData } = useProfile()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isHomeMenuOpen, setIsHomeMenuOpen] = useState(false)
  const [businessOwnerMenuPanel, setBusinessOwnerMenuPanel] = useState<BusinessOwnerMenuPanel>('main')
  const [businessOwnerSettingsView, setBusinessOwnerSettingsView] = useState<BusinessOwnerSettingsView>('main')
  const [openBusinessOwnerFaqQuestion, setOpenBusinessOwnerFaqQuestion] = useState<string | null>(null)
  const [isLandingMobileMenuOpen, setIsLandingMobileMenuOpen] = useState(false)
  const [businessOwnerSuggestionForm, setBusinessOwnerSuggestionForm] = useState<BusinessOwnerSuggestionFormState>({
    type: 'suggestion',
    subject: '',
    customSubject: '',
    message: '',
  })
  const [businessOwnerSuggestionErrors, setBusinessOwnerSuggestionErrors] = useState<{
    type?: string
    subject?: string
    message?: string
  }>({})
  const [businessOwnerSuggestionFeedback, setBusinessOwnerSuggestionFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [isBusinessOwnerSuggestionSubmitting, setIsBusinessOwnerSuggestionSubmitting] = useState(false)
  const [businessOwnerRecentHelpSuggestions, setBusinessOwnerRecentHelpSuggestions] = useState<BusinessOwnerHelpSuggestionRow[]>([])
  const [isBusinessOwnerRecentHelpSuggestionsLoading, setIsBusinessOwnerRecentHelpSuggestionsLoading] = useState(false)
  const [businessOwnerRecentHelpSuggestionsError, setBusinessOwnerRecentHelpSuggestionsError] = useState('')
  const [hasLoadedBusinessOwnerRecentHelpSuggestions, setHasLoadedBusinessOwnerRecentHelpSuggestions] = useState(false)
  const [businessOwnerRecentHelpSuggestionsStale, setBusinessOwnerRecentHelpSuggestionsStale] = useState(false)
  const [openBusinessOwnerRecentHelpSuggestionId, setOpenBusinessOwnerRecentHelpSuggestionId] = useState<string | null>(null)
  const [businessOwnerProfileForm, setBusinessOwnerProfileForm] = useState<BusinessOwnerProfileFormValues>({
    name: '',
    phoneNumber: '',
    preferredCity: '',
  })
  const [businessOwnerPhoneValidationMessage, setBusinessOwnerPhoneValidationMessage] = useState('')
  const [isBusinessOwnerProfileLoading, setIsBusinessOwnerProfileLoading] = useState(false)
  const [isBusinessOwnerProfileSaving, setIsBusinessOwnerProfileSaving] = useState(false)
  const [hasSavedBusinessOwnerPhoneNumber, setHasSavedBusinessOwnerPhoneNumber] = useState(false)
  const [businessOwnerProfileFeedback, setBusinessOwnerProfileFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [isBusinessOwnerChangeEmailModalOpen] = useState(false)
  const [businessOwnerChangeEmailValue, setBusinessOwnerChangeEmailValue] = useState('')
  const [businessOwnerChangeEmailError, setBusinessOwnerChangeEmailError] = useState('')
  const [businessOwnerChangeEmailSuccess, setBusinessOwnerChangeEmailSuccess] = useState(false)
  const [isBusinessOwnerChangeEmailSubmitting] = useState(false)
  const [isBusinessOwnerPhoneModalOpen] = useState(false)
  const [businessOwnerPhoneModalMode] = useState<BusinessOwnerPhoneModalMode>('change')
  const [businessOwnerPhoneModalStep, setBusinessOwnerPhoneModalStep] = useState<BusinessOwnerPhoneModalStep>('phone')
  const [businessOwnerPhoneModalPhoneValue, setBusinessOwnerPhoneModalPhoneValue] = useState('')
  const [businessOwnerPhoneModalOtpValue, setBusinessOwnerPhoneModalOtpValue] = useState('')
  const [businessOwnerPhoneModalPhoneError, setBusinessOwnerPhoneModalPhoneError] = useState('')
  const [businessOwnerPhoneModalOtpError, setBusinessOwnerPhoneModalOtpError] = useState('')
  const [businessOwnerNotifications, setBusinessOwnerNotifications] = useState<BusinessOwnerNotificationRow[]>([])
  const [isBusinessOwnerNotificationsLoading, setIsBusinessOwnerNotificationsLoading] = useState(false)
  const [businessOwnerNotificationsError, setBusinessOwnerNotificationsError] = useState('')
  const [loadedBusinessOwnerNotificationsSessionKey, setLoadedBusinessOwnerNotificationsSessionKey] = useState('')
  const [readingBusinessOwnerNotificationId, setReadingBusinessOwnerNotificationId] = useState<string | null>(null)
  const [businessOwnerNotificationsEnabled, setBusinessOwnerNotificationsEnabled] = useState(true)
  const [isBusinessOwnerNotificationPreferenceLoading, setIsBusinessOwnerNotificationPreferenceLoading] = useState(false)
  const [isBusinessOwnerNotificationPreferenceSaving, setIsBusinessOwnerNotificationPreferenceSaving] = useState(false)
  const [businessOwnerNotificationPreferenceError, setBusinessOwnerNotificationPreferenceError] = useState('')
  const [businessOwnerNotificationPreferenceFeedback, setBusinessOwnerNotificationPreferenceFeedback] = useState('')
  const [loadedBusinessOwnerNotificationPreferenceUserId, setLoadedBusinessOwnerNotificationPreferenceUserId] = useState('')
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [shouldAnimateEntrance] = useState(() => !hasPlayedNavbarEntrance)
  const toastIdRef = useRef(0)
  const homeMenuRef = useRef<HTMLDivElement | null>(null)
  const businessOwnerChangeEmailModalRef = useRef<HTMLDivElement | null>(null)
  const customerMenuOverlayRef = useRef<HTMLDivElement | null>(null)
  const landingMobileMenuRef = useRef<HTMLDivElement | null>(null)
  const userMetadata = (user?.user_metadata ?? {}) as Record<string, unknown>
  const isLandingPage = location.pathname === '/'
  const isStartBusinessPage = location.pathname === '/start-business'
  const isBusinessHomePage = location.pathname === '/business-home'
  const isCreateProfilePage = location.pathname === '/create-profile'
  const isProfilePreviewPage = location.pathname === '/profile-preview'
  const isDirectoryPage = location.pathname === '/directory'
  const isAuthEntryPage = location.pathname === '/login' || location.pathname === '/signup'
  const isPublicBusinessProfileVariant = variant === 'publicBusinessProfile'
  const isSimpleDarkNavbarPage = isAuthEntryPage || isDirectoryPage || isPublicBusinessProfileVariant
  const showCreateProfileTopBar = Boolean(user) && isCreateProfilePage
  const showProfilePreviewTopBar = isProfilePreviewPage
  const showMinimalCustomerTopBar = Boolean(user) && (isLandingPage || isStartBusinessPage)
  const showStartBusinessLogoOnly = Boolean(user) && isStartBusinessPage
  const showBusinessHomeTopBar = Boolean(user) && isBusinessHomePage
  const isDarkLandingNavbar =
    isLandingPage ||
    isStartBusinessPage ||
    isBusinessHomePage ||
    isCreateProfilePage ||
    isProfilePreviewPage ||
    isSimpleDarkNavbarPage
  const showPreviewHeader = Boolean(previewConfig) && !isPublicBusinessProfileVariant
  const useDarkHeaderStyle = isDarkLandingNavbar || showPreviewHeader
  const hideAuthenticatedNavButtons =
    showMinimalCustomerTopBar ||
    showBusinessHomeTopBar ||
    showCreateProfileTopBar ||
    showProfilePreviewTopBar ||
    isPublicBusinessProfileVariant
  const showLoggedInHomeIcons = showMinimalCustomerTopBar && !showStartBusinessLogoOnly
  const hasTopBarMenu = showLoggedInHomeIcons || showBusinessHomeTopBar
  const hasOpenMenu = isHomeMenuOpen || isLandingMobileMenuOpen
  const authenticatedHomePath = isCreateProfilePage && accountMode === 'business_owner' ? '/business-home' : '/'
  const useInlineDarkNavbarLayout =
    isProfilePreviewPage || isPublicBusinessProfileVariant || ((isLandingPage || isSimpleDarkNavbarPage) && !user)
  const showLandingMobileHamburger = !user && isLandingPage
  const publicBusinessProfileBackPath = previewConfig?.backPath ?? '/'
  const publicBusinessProfileBackLabel = previewConfig?.backLabel ?? 'Home'
  const navbarInteractionStyle: CSSProperties = {
    WebkitTapHighlightColor: 'transparent',
  }
  const effectiveBusinessOwnerMenuState =
    businessOwnerMenuState ??
    (showBusinessHomeTopBar
      ? {
          hasBusinessProfile: Boolean(profileData.id),
          businessProfile: null,
          businessName: profileData.businessName || 'Business Profile',
          ownerEmail: user?.email ?? 'Owner account',
          businessCategory: profileData.businessCategory || '',
          businessLogoUrl: profileData.existingLogoUrl ?? null,
          businessSlug: profileData.slug,
          profileStatusLabel: profileData.id ? (profileData.isPublic === false ? 'Hidden' : 'Published') : 'Not created',
        }
      : null)
  const businessOwnerOwnerEmail = effectiveBusinessOwnerMenuState?.ownerEmail?.trim() || user?.email || 'Owner account'
  const businessOwnerAccountName =
    getMetadataString(userMetadata, ['full_name', 'name', 'display_name']) ??
    (user?.email ? user.email.split('@')[0] : 'Business Owner')
  const businessOwnerAccountInitials = getInitials(businessOwnerAccountName || 'Business Owner') || 'BO'
  const businessOwnerPublicProfilePath = effectiveBusinessOwnerMenuState?.businessSlug?.trim()
    ? `/business/${effectiveBusinessOwnerMenuState.businessSlug.trim()}`
    : null
  const businessOwnerProfileForNotifications = effectiveBusinessOwnerMenuState?.businessProfile ?? null
  const businessOwnerNotificationsSessionKey = `${user?.id ?? ''}:${businessOwnerProfileForNotifications?.id ?? ''}`
  const businessOwnerMenuRowClass =
    'flex w-full items-center justify-between border-b border-slate-100/90 px-3 py-3 text-left text-sm text-[#0f172a] transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none'
  const businessOwnerPanelCardClass = 'rounded-2xl border border-slate-200 bg-slate-50/80 p-3'
  const businessOwnerInputClass = 'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-[#0f172a] outline-none focus:ring-2 focus:ring-slate-300'
  const businessOwnerAnalyticsPreviewItems = [
    'Profile views',
    'Customer actions',
    'Calls and WhatsApp clicks',
    'Direction clicks',
    'Saved business activity',
  ]
  const businessOwnerSettingsSections = [
    {
      title: 'Help & Suggestions',
      items: [
        'Business account FAQs',
        'Suggestions',
        'Recent help & suggestions',
      ],
    },
    {
      title: 'Security',
      items: [
        'Change phone number',
        'Change email address',
        'Change password',
      ],
    },
    {
      title: 'Delete Account',
      items: ['Delete business profile', 'Delete business account'],
      danger: true,
    },
  ]

  const resetBusinessOwnerNotificationsSession = () => {
    setBusinessOwnerNotifications([])
    setIsBusinessOwnerNotificationsLoading(false)
    setBusinessOwnerNotificationsError('')
    setLoadedBusinessOwnerNotificationsSessionKey('')
    setReadingBusinessOwnerNotificationId(null)
  }

  const resetBusinessOwnerNotificationPreferenceSession = () => {
    setBusinessOwnerNotificationsEnabled(true)
    setIsBusinessOwnerNotificationPreferenceLoading(false)
    setIsBusinessOwnerNotificationPreferenceSaving(false)
    setBusinessOwnerNotificationPreferenceError('')
    setBusinessOwnerNotificationPreferenceFeedback('')
    setLoadedBusinessOwnerNotificationPreferenceUserId('')
  }

  const resetBusinessOwnerSuggestionForm = () => {
    setBusinessOwnerSuggestionForm({
      type: 'suggestion',
      subject: '',
      customSubject: '',
      message: '',
    })
    setBusinessOwnerSuggestionErrors({})
    setBusinessOwnerSuggestionFeedback(null)
    setIsBusinessOwnerSuggestionSubmitting(false)
  }

  const resetBusinessOwnerRecentHelpSuggestions = () => {
    setBusinessOwnerRecentHelpSuggestions([])
    setIsBusinessOwnerRecentHelpSuggestionsLoading(false)
    setBusinessOwnerRecentHelpSuggestionsError('')
    setHasLoadedBusinessOwnerRecentHelpSuggestions(false)
    setBusinessOwnerRecentHelpSuggestionsStale(false)
    setOpenBusinessOwnerRecentHelpSuggestionId(null)
  }

  const resetBusinessOwnerChangeEmailModal = () => {
    setBusinessOwnerChangeEmailValue('')
    setBusinessOwnerChangeEmailError('')
    setBusinessOwnerChangeEmailSuccess(false)
  }

  const resetBusinessOwnerPhoneModal = () => {
    setBusinessOwnerPhoneModalPhoneValue('')
    setBusinessOwnerPhoneModalOtpValue('')
    setBusinessOwnerPhoneModalPhoneError('')
    setBusinessOwnerPhoneModalOtpError('')
    setBusinessOwnerPhoneModalStep('phone')
  }

  const closeHomeMenu = () => {
    resetBusinessOwnerNotificationsSession()
    resetBusinessOwnerNotificationPreferenceSession()
    resetBusinessOwnerRecentHelpSuggestions()
    setIsHomeMenuOpen(false)
  }

  useEffect(() => {
    if (shouldAnimateEntrance) {
      hasPlayedNavbarEntrance = true
    }
  }, [shouldAnimateEntrance])

  useEffect(() => {
    if (!hasTopBarMenu || !isHomeMenuOpen) {
      return undefined
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node

      if (showLoggedInHomeIcons && customerMenuOverlayRef.current?.contains(target)) {
        return
      }

      if (!homeMenuRef.current?.contains(target)) {
        closeHomeMenu()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeHomeMenu()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [hasTopBarMenu, isHomeMenuOpen, showLoggedInHomeIcons])

  useEffect(() => {
    if (!hasOpenMenu) {
      return undefined
    }

    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow

    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
    }
  }, [hasOpenMenu])

  useEffect(() => {
    if (!showLandingMobileHamburger || !isLandingMobileMenuOpen) {
      return undefined
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!landingMobileMenuRef.current?.contains(event.target as Node)) {
        setIsLandingMobileMenuOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsLandingMobileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isLandingMobileMenuOpen, showLandingMobileHamburger])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      closeHomeMenu()
      setIsLandingMobileMenuOpen(false)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [location.pathname, location.hash])

  useEffect(() => {
    if (businessOwnerMenuPanel !== 'profile' || !user?.id) {
      return
    }

    let isActive = true

    const loadBusinessOwnerProfile = async () => {
      setIsBusinessOwnerProfileLoading(true)
      setBusinessOwnerProfileFeedback(null)

      try {
        const profile = await getBusinessOwnerProfile(user.id)
        if (!isActive) {
          return
        }

        setBusinessOwnerProfileForm({
          name: profile?.name ?? '',
          phoneNumber: profile?.phone_number ?? '',
          preferredCity: profile?.preferred_city ?? '',
        })
        setHasSavedBusinessOwnerPhoneNumber(Boolean(profile?.phone_number?.trim()))
        setBusinessOwnerPhoneValidationMessage('')
      } catch {
        if (!isActive) {
          return
        }

        setBusinessOwnerProfileFeedback({
          type: 'error',
          message: 'Unable to load your profile details right now.',
        })
      } finally {
        if (isActive) {
          setIsBusinessOwnerProfileLoading(false)
        }
      }
    }

    void loadBusinessOwnerProfile()

    return () => {
      isActive = false
    }
  }, [businessOwnerMenuPanel, user?.id])

  useEffect(() => {
    if (!isHomeMenuOpen || !showBusinessHomeTopBar || !user?.id) {
      return
    }

    if (loadedBusinessOwnerNotificationPreferenceUserId === user.id) {
      return
    }

    let isActive = true

    const loadBusinessOwnerNotificationPreference = async () => {
      setIsBusinessOwnerNotificationPreferenceLoading(true)
      setBusinessOwnerNotificationPreferenceError('')
      setBusinessOwnerNotificationPreferenceFeedback('')

      try {
        const preference = await getBusinessOwnerNotificationPreference(user.id)
        if (!isActive) {
          return
        }

        setBusinessOwnerNotificationsEnabled(preference.notifications_enabled)
        setLoadedBusinessOwnerNotificationPreferenceUserId(user.id)
      } catch {
        if (isActive) {
          setBusinessOwnerNotificationPreferenceError('Could not load notification setting right now.')
        }
      } finally {
        if (isActive) {
          setIsBusinessOwnerNotificationPreferenceLoading(false)
        }
      }
    }

    void loadBusinessOwnerNotificationPreference()

    return () => {
      isActive = false
    }
  }, [isHomeMenuOpen, loadedBusinessOwnerNotificationPreferenceUserId, showBusinessHomeTopBar, user?.id])

  useEffect(() => {
    if (businessOwnerMenuPanel !== 'notifications' || !user?.id) {
      return
    }

    if (isBusinessOwnerNotificationPreferenceLoading || businessOwnerNotificationPreferenceError) {
      return
    }

    if (loadedBusinessOwnerNotificationPreferenceUserId !== user.id) {
      return
    }

    if (!businessOwnerNotificationsEnabled) {
      return
    }

    if (loadedBusinessOwnerNotificationsSessionKey === businessOwnerNotificationsSessionKey) {
      return
    }

    let isActive = true

    const loadBusinessOwnerNotifications = async () => {
      setIsBusinessOwnerNotificationsLoading(true)
      setBusinessOwnerNotificationsError('')

      try {
        if (businessOwnerProfileForNotifications?.id) {
          try {
            await ensureProfileUpdateReminderNotification(user.id, businessOwnerProfileForNotifications)
          } catch {
            // Reminder creation is best-effort; the existing notification list should still open.
          }
        }

        const nextNotifications = await listBusinessOwnerNotifications(user.id)
        if (isActive) {
          setBusinessOwnerNotifications(nextNotifications)
          setLoadedBusinessOwnerNotificationsSessionKey(businessOwnerNotificationsSessionKey)
        }
      } catch {
        if (isActive) {
          setBusinessOwnerNotificationsError('Could not load notifications right now.')
        }
      } finally {
        if (isActive) {
          setIsBusinessOwnerNotificationsLoading(false)
        }
      }
    }

    void loadBusinessOwnerNotifications()

    return () => {
      isActive = false
    }
  }, [
    businessOwnerMenuPanel,
    businessOwnerNotificationPreferenceError,
    businessOwnerNotificationsEnabled,
    businessOwnerNotificationsSessionKey,
    businessOwnerProfileForNotifications,
    isBusinessOwnerNotificationPreferenceLoading,
    loadedBusinessOwnerNotificationPreferenceUserId,
    loadedBusinessOwnerNotificationsSessionKey,
    user?.id,
  ])

  useEffect(() => {
    if (businessOwnerMenuPanel !== 'settings' || businessOwnerSettingsView !== 'recent' || !user?.id) {
      return
    }

    if (hasLoadedBusinessOwnerRecentHelpSuggestions && !businessOwnerRecentHelpSuggestionsStale) {
      return
    }

    let isActive = true

    const loadBusinessOwnerRecentHelpSuggestions = async () => {
      setIsBusinessOwnerRecentHelpSuggestionsLoading(true)
      setBusinessOwnerRecentHelpSuggestionsError('')

      try {
        const nextSuggestions = await listBusinessOwnerHelpSuggestions(user.id)
        if (isActive) {
          setBusinessOwnerRecentHelpSuggestions(nextSuggestions)
          setHasLoadedBusinessOwnerRecentHelpSuggestions(true)
          setBusinessOwnerRecentHelpSuggestionsStale(false)
        }
      } catch {
        if (isActive) {
          setBusinessOwnerRecentHelpSuggestionsError('Could not load recent help & suggestions right now.')
        }
      } finally {
        if (isActive) {
          setIsBusinessOwnerRecentHelpSuggestionsLoading(false)
        }
      }
    }

    void loadBusinessOwnerRecentHelpSuggestions()

    return () => {
      isActive = false
    }
  }, [
    businessOwnerMenuPanel,
    businessOwnerSettingsView,
    businessOwnerRecentHelpSuggestionsStale,
    hasLoadedBusinessOwnerRecentHelpSuggestions,
    user?.id,
  ])

  const showError = (message: string) => {
    const id = ++toastIdRef.current
    setToasts((prev) => [...prev, { id, message, type: 'error' }])
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 4000)
  }

  const navItems: NavItem[] = isSimpleDarkNavbarPage
    ? [{ label: 'Home', path: '/' }]
    : user
    ? [
        { label: 'Home', path: authenticatedHomePath },
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Directory', path: '/directory' },
        { label: 'Create Business', path: '/create-profile', emphasis: true },
      ]
    : isLandingPage
      ? [
          { label: 'Businesses', path: '/directory' },
          { label: 'Features', path: '#features', type: 'scroll' },
          { label: 'Login', path: '/login', emphasis: true },
        ]
      : [
          { label: 'Home', path: '/' },
          { label: 'Directory', path: '/directory' },
          { label: 'Login', path: '/login' },
          { label: 'Get Started', path: '/signup', emphasis: true },
        ]

  const handleLogout = async () => {
    if (isSigningOut) return

    setIsSigningOut(true)
    const { error } = await signOut()
    setIsSigningOut(false)

    if (error) {
      showError(error)
      return
    }

    navigate('/')
  }

  const handleBrandClick = () => {
    if (user && showCreateProfileTopBar) {
      navigate(authenticatedHomePath)
      return
    }

    navigate(user ? '/dashboard' : '/')
  }

  const handleCreateProfileHelp = () => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message: 'Help is coming soon.', type: 'info' }])
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 4000)
  }

  const handleNavItemClick = (item: NavItem) => {
    setIsLandingMobileMenuOpen(false)

    if (item.type === 'scroll') {
      const sectionId = item.path.replace('#', '')
      navigate({ pathname: '/', hash: item.path })
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    navigate(item.path)
  }

  const handleBusinessOwnerProfileFieldChange =
    (field: keyof BusinessOwnerProfileFormValues) => (event: ChangeEvent<HTMLInputElement>) => {
      const value = field === 'phoneNumber' ? normalizePhoneNumber(event.target.value) : event.target.value
      setBusinessOwnerProfileFeedback(null)
      if (field === 'phoneNumber') {
        const normalizedValue = normalizePhoneNumber(value.trim())
        setBusinessOwnerPhoneValidationMessage(
          !isValidPhoneNumber(normalizedValue) ? 'Please enter exactly 10 digits.' : ''
        )
      }
      setBusinessOwnerProfileForm((prev) => ({ ...prev, [field]: value }))
    }

  const handleBusinessOwnerSuggestionFieldChange =
    (field: keyof CreateBusinessOwnerHelpSuggestionInput) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = event.target.value
      setBusinessOwnerSuggestionFeedback(null)
      setBusinessOwnerSuggestionErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }))
      setBusinessOwnerSuggestionForm((prev) => {
        if (field === 'type') {
          return {
            ...prev,
            type: value as BusinessOwnerHelpSuggestionType,
            subject: '',
            customSubject: '',
          }
        }

        return { ...prev, [field]: value }
      })
    }

  const handleBusinessOwnerSuggestionSubmit = async () => {
    if (!user?.id || isBusinessOwnerSuggestionSubmitting) {
      return
    }

    const finalSubject =
      businessOwnerSuggestionForm.subject === 'Others'
        ? businessOwnerSuggestionForm.customSubject.trim()
        : businessOwnerSuggestionForm.subject.trim()

    const trimmedValues: CreateBusinessOwnerHelpSuggestionInput = {
      type: businessOwnerSuggestionForm.type,
      subject: finalSubject,
      message: businessOwnerSuggestionForm.message.trim(),
    }

    const nextErrors: {
      type?: string
      subject?: string
      message?: string
    } = {}

    if (!trimmedValues.type) {
      nextErrors.type = 'Please select a type.'
    }

    if (!businessOwnerSuggestionForm.subject) {
      nextErrors.subject = 'Please select a subject.'
    } else if (businessOwnerSuggestionForm.subject === 'Others' && !trimmedValues.subject) {
      nextErrors.subject = 'Please specify the subject.'
    } else if (trimmedValues.subject.length > 80) {
      nextErrors.subject = 'Subject must be 80 characters or fewer.'
    }

    if (!trimmedValues.message) {
      nextErrors.message = 'Please enter a message.'
    } else if (trimmedValues.message.length > 1000) {
      nextErrors.message = 'Message must be 1000 characters or fewer.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setBusinessOwnerSuggestionErrors(nextErrors)
      return
    }

    setBusinessOwnerSuggestionErrors({})
    setBusinessOwnerSuggestionFeedback(null)
    setIsBusinessOwnerSuggestionSubmitting(true)

    try {
      await createBusinessOwnerHelpSuggestion(user.id, trimmedValues)
      setBusinessOwnerSuggestionForm({
        type: 'suggestion',
        subject: '',
        customSubject: '',
        message: '',
      })
      setBusinessOwnerRecentHelpSuggestionsStale(true)
      setBusinessOwnerSuggestionFeedback({
        type: 'success',
        message: 'Thanks, your message has been sent.',
      })
    } catch {
      setBusinessOwnerSuggestionFeedback({
        type: 'error',
        message: 'Could not send your message right now. Please try again.',
      })
    } finally {
      setIsBusinessOwnerSuggestionSubmitting(false)
    }
  }

  const handleBusinessOwnerProfileSave = async () => {
    if (!user?.id || isBusinessOwnerProfileSaving) {
      return
    }

    const trimmedValues = {
      name: businessOwnerProfileForm.name.trim(),
      phoneNumber: normalizePhoneNumber(businessOwnerProfileForm.phoneNumber.trim()),
      preferredCity: businessOwnerProfileForm.preferredCity.trim(),
    }

    if (trimmedValues.phoneNumber && !isValidPhoneNumber(trimmedValues.phoneNumber)) {
      setBusinessOwnerPhoneValidationMessage('Please enter exactly 10 digits.')
      return
    }

    setBusinessOwnerPhoneValidationMessage('')

    if (trimmedValues.name.length > 80) {
      setBusinessOwnerProfileFeedback({ type: 'error', message: 'Name must be 80 characters or fewer.' })
      return
    }

    if (trimmedValues.preferredCity.length > 80) {
      setBusinessOwnerProfileFeedback({ type: 'error', message: 'Preferred City must be 80 characters or fewer.' })
      return
    }

    if (
      containsLink(trimmedValues.name) ||
      containsLink(trimmedValues.phoneNumber) ||
      containsLink(trimmedValues.preferredCity)
    ) {
      setBusinessOwnerProfileFeedback({
        type: 'error',
        message: 'Links are not allowed in these profile fields.',
      })
      return
    }

    setIsBusinessOwnerProfileSaving(true)
    setBusinessOwnerProfileFeedback(null)

    try {
      const savedProfile = await upsertBusinessOwnerProfile(user.id, trimmedValues)
      setBusinessOwnerProfileForm({
        name: savedProfile.name ?? '',
        phoneNumber: savedProfile.phone_number ?? '',
        preferredCity: savedProfile.preferred_city ?? '',
      })
      setHasSavedBusinessOwnerPhoneNumber(Boolean(savedProfile.phone_number?.trim()))
      setBusinessOwnerProfileFeedback({
        type: 'success',
        message: 'Profile details saved successfully.',
      })
    } catch {
      setBusinessOwnerProfileFeedback({
        type: 'error',
        message: 'Unable to save your profile details right now.',
      })
    } finally {
      setIsBusinessOwnerProfileSaving(false)
    }
  }

  const prepareBusinessProfileEditor = (profile: BusinessProfileRow) => {
    setProfileData({
      ...profileData,
      id: profile.id,
      slug: profile.slug,
      ownerId: profile.owner_id,
      businessName: profile.business_name,
      ownerName: profile.owner_name,
      businessCategory: profile.business_category,
      businessSubcategories: Array.isArray(profile.business_subcategories) ? profile.business_subcategories : [],
      establishedYear: typeof profile.established_year === 'number' ? String(profile.established_year) : '',
      yearsOfExperience:
        typeof profile.years_of_experience === 'number' ? String(profile.years_of_experience) : '',
      highlights: normalizeStringArray(profile.highlights),
      faqs: normalizeFaqItems(profile.faqs),
      productsMenuPackages: normalizeProductItems(profile.products_menu_packages),
      qualifications: normalizeQualificationItems(profile.qualifications),
      phoneNumber: profile.phone_number,
      whatsappNumber: profile.whatsapp_number || '',
      email: profile.email || '',
      website: profile.website || '',
      address: profile.address || '',
      aboutBusiness: profile.about_business || '',
      tagline: profile.tagline || '',
      servicesText: formatServicesForForm(profile.services),
      workingHours: normalizeWorkingHours(profile.working_hours),
      googleMapsUrl: profile.google_maps_url || '',
      socialLinks: normalizeSocialLinks(profile.social_links),
      keywordsText: formatKeywordsForForm(profile.keywords),
      isPublic: profile.is_public ?? true,
      logo: null,
      existingLogoUrl: profile.logo_url,
      coverBanner: null,
      existingCoverBannerUrl: profile.cover_banner_url,
      galleryImages: [],
      existingGalleryImageUrls: Array.isArray(profile.gallery_images)
        ? profile.gallery_images.filter((imageUrl): imageUrl is string => typeof imageUrl === 'string')
        : [],
      documentName: '',
      documentFiles: [],
      existingDocuments: normalizeBusinessProfileDocuments(profile.business_profile_documents),
    })
  }

  const markBusinessOwnerNotificationReadLocally = async (
    notification: BusinessOwnerNotificationRow
  ): Promise<BusinessOwnerNotificationRow> => {
    if (!user?.id || notification.is_read || readingBusinessOwnerNotificationId === notification.id) {
      return notification
    }

    setReadingBusinessOwnerNotificationId(notification.id)

    try {
      const updatedNotification = await markBusinessOwnerNotificationRead(notification.id, user.id)
      setBusinessOwnerNotifications((currentNotifications) =>
        currentNotifications.map((item) => (item.id === updatedNotification.id ? updatedNotification : item))
      )
      return updatedNotification
    } catch {
      return notification
    } finally {
      setReadingBusinessOwnerNotificationId(null)
    }
  }

  const handleBusinessOwnerNotificationOpen = async (notification: BusinessOwnerNotificationRow) => {
    await markBusinessOwnerNotificationReadLocally(notification)

    if (!notification.action_url) {
      return
    }

    if (notification.type === 'profile_update_reminder' && businessOwnerProfileForNotifications) {
      prepareBusinessProfileEditor(businessOwnerProfileForNotifications)
    }

    closeHomeMenu()
    navigate(notification.action_url)
  }

  const handleBusinessOwnerNotificationPreferenceToggle = async (notificationsEnabled: boolean) => {
    if (!user?.id || isBusinessOwnerNotificationPreferenceSaving) {
      return
    }

    setIsBusinessOwnerNotificationPreferenceSaving(true)
    setBusinessOwnerNotificationPreferenceError('')
    setBusinessOwnerNotificationPreferenceFeedback('')

    try {
      const preference = await upsertBusinessOwnerNotificationPreference(user.id, notificationsEnabled)
      setBusinessOwnerNotificationsEnabled(preference.notifications_enabled)
      setLoadedBusinessOwnerNotificationPreferenceUserId(user.id)
      resetBusinessOwnerNotificationsSession()
      setBusinessOwnerNotificationPreferenceFeedback(
        preference.notifications_enabled ? 'Business notifications are on.' : 'Business notifications are off.'
      )
    } catch {
      setBusinessOwnerNotificationPreferenceError('Could not update notification setting right now. Please try again.')
    } finally {
      setIsBusinessOwnerNotificationPreferenceSaving(false)
    }
  }

  const handleBusinessOwnerChangeEmailSubmit = () => {
    resetBusinessOwnerChangeEmailModal()
  }

  const handleBusinessOwnerPhoneModalSendOtp = () => {
    setBusinessOwnerPhoneModalPhoneError('')
    setBusinessOwnerPhoneModalOtpError('')
    setBusinessOwnerPhoneModalStep('phone')
  }

  const handleBusinessOwnerPhoneModalVerifyOtp = () => {
    setBusinessOwnerPhoneModalOtpError('')
    setBusinessOwnerPhoneModalStep('success')
  }

  const customerDisplayName =
    getMetadataString(userMetadata, ['full_name', 'name', 'display_name']) ??
    (user?.email ? user.email.split('@')[0] : 'Customer')
  const customerEmail = user?.email ?? ''
  const customerLocation = getMetadataString(userMetadata, ['preferred_location', 'location', 'city'])
  const customerAvatarUrl = getMetadataString(userMetadata, ['avatar_url', 'picture'])

  const customerProfileSettingsItem: HomeMenuItem = {
    label: 'View Profile & Settings',
    path: '/customer/profile-settings',
  }

  const customerPrimaryMenuItems: HomeMenuItem[] = [
    { label: 'Notifications', path: '/customer/notifications' },
    { label: 'Saved Businesses', path: '/customer/saved-businesses' },
  ]

  const customerActivityMenuItems: HomeMenuItem[] = [
    { label: 'Ratings & Reviews', path: '/customer/my-activity#reviews' },
    { label: 'Reported Profiles', path: '/customer/my-activity#reports' },
    { label: 'Submitted Corrections', path: '/customer/my-activity#corrections' },
  ]

  const customerCommunityMenuItems: HomeMenuItem[] = [
    { label: 'My Local Impact', path: '/customer/community#impact' },
    { label: 'Support a Business', path: '/customer/community#support' },
    { label: 'Shape the Platform', path: '/customer/community#shape' },
  ]

  const customerHelpMenuItems: HomeMenuItem[] = [
    { label: 'Help Articles', path: '/customer/help-feedback#help' },
    { label: 'Contact Support', path: '/customer/help-feedback#help' },
    { label: 'Report a Problem', path: '/customer/help-feedback#report' },
    { label: 'Submit Feedback', path: '/customer/help-feedback#feedback' },
  ]

  const switchToBusinessModeMenuItem: HomeMenuItem = isBusinessOwnerEnabled
    ? {
        label: 'Switch to Business Mode',
        onSelect: async () => {
          try {
            await setPreferredAccountMode('business_owner')
            navigate('/business-home')
          } catch (error) {
            console.error('Failed to switch to Business Owner mode:', error)
            showError('Unable to switch to Business Owner mode. Please try again.')
          }
        },
      }
    : { label: 'Switch to Business Mode', path: '/start-business' }

  const handleHomeMenuItemClick = async (item: HomeMenuItem) => {
    if (item.disabled) {
      return
    }

    closeHomeMenu()
    if (item.onSelect) {
      await item.onSelect()
      return
    }

    if (item.path) {
      navigate(item.path)
    }
  }

  const navButtonClass = (item: NavItem) => {
    const isActive =
      item.type === 'scroll'
        ? location.pathname === '/' && location.hash === item.path
        : location.pathname === item.path
    const baseClass =
      `relative inline-flex min-w-[4rem] items-center justify-center overflow-hidden rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.01em] focus:outline-none focus-visible:ring-2 sm:min-w-[4.5rem] sm:px-3.5 sm:py-1.5 sm:text-sm ${
        useDarkHeaderStyle
          ? 'focus-visible:ring-slate-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950'
          : 'focus-visible:ring-slate-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50'
      }`

    if (useDarkHeaderStyle) {
      return `${baseClass} ${
        isActive
          ? 'border-white/10 bg-white/10 text-[#0f172a]'
          : 'border-transparent bg-transparent text-[#0f172a]'
      }`
    }

    return `${baseClass} ${
      isActive
        ? 'border-slate-200 bg-slate-100 text-[#0f172a]'
        : 'border-transparent bg-transparent text-[#0f172a]'
    }`
  }

  const customerMenuItemClass = (item: HomeMenuItem) =>
    `flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm ${
      item.disabled
        ? 'cursor-not-allowed text-slate-500'
        : 'text-[#0f172a] transition hover:bg-slate-50 focus:bg-slate-50'
    } focus:outline-none`

  const renderBusinessOwnerAccountHeader = () => (
    <div className="border-b border-slate-100 bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-sky-100 bg-sky-50 text-sm font-semibold text-sky-700">
            {businessOwnerAccountInitials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[#0f172a]">{businessOwnerAccountName || 'Business Owner'}</p>
            <p className="truncate text-xs text-slate-500">{businessOwnerOwnerEmail || 'Owner account'}</p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close business account menu"
          onClick={closeHomeMenu}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-[0_10px_22px_-18px_rgba(15,23,42,0.32)] transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          if (!businessOwnerPublicProfilePath) {
            return
          }

          closeHomeMenu()
          navigate(businessOwnerPublicProfilePath)
        }}
        disabled={!businessOwnerPublicProfilePath}
        className={`mt-3 flex w-full items-center justify-between rounded-2xl border px-3 py-2.5 text-left text-sm font-medium shadow-[0_10px_22px_-18px_rgba(15,23,42,0.32)] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 ${
          businessOwnerPublicProfilePath
            ? 'border-slate-200 bg-white text-[#0f172a] transition hover:bg-slate-50'
            : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
        }`}
      >
        <span>View Business Profile</span>
      </button>
    </div>
  )

  const renderBusinessOwnerPanelHeader = (title: string) => (
    <div className="mb-3 flex items-center justify-between gap-3">
      {businessOwnerMenuPanel === 'main' ? (
        <h2 className="text-sm font-semibold text-[#0f172a]">Business Account</h2>
      ) : (
        <>
          <h2 className="text-sm font-semibold text-[#0f172a]">{title}</h2>
          <button
            type="button"
            onClick={() => setBusinessOwnerMenuPanel('main')}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            <span>Back</span>
          </button>
        </>
      )}
    </div>
  )

  const renderBusinessOwnerSubPanelHeader = (title: string, onBack: () => void) => (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold text-[#0f172a]">{title}</h2>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
      >
        <span>Back</span>
      </button>
    </div>
  )

  const renderBusinessOwnerMainMenu = () => (
    <>
      {renderBusinessOwnerPanelHeader('Business Account')}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {[
          { key: 'profile', label: 'Profile', icon: <ProfileIcon /> },
          { key: 'analytics', label: 'Analytics', icon: <AnalyticsIcon /> },
          { key: 'notifications', label: 'Notifications', icon: <NotificationsIcon /> },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            role="menuitem"
            onClick={() => setBusinessOwnerMenuPanel(item.key as BusinessOwnerMenuPanel)}
            className={businessOwnerMenuRowClass}
          >
            <span className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                {item.icon}
              </span>
              <span className="font-medium">{item.label}</span>
            </span>
            <span className="text-slate-400" aria-hidden="true">&gt;</span>
          </button>
        ))}
        <button
          type="button"
          role="menuitem"
          onClick={async () => {
            setIsHomeMenuOpen(false)
            try {
              await setPreferredAccountMode('customer')
              navigate('/')
            } catch (error) {
              console.error('Failed to switch to Customer mode:', error)
              showError('Unable to switch to Customer mode. Please try again.')
            }
          }}
          className={businessOwnerMenuRowClass}
        >
          <span className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <SwitchIcon />
            </span>
            <span className="font-medium">Switch to Customer</span>
          </span>
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setBusinessOwnerSettingsView('main')
            setBusinessOwnerMenuPanel('settings')
          }}
          className={`${businessOwnerMenuRowClass} border-b-0`}
        >
          <span className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <SettingsIcon />
            </span>
            <span className="font-medium">Settings</span>
          </span>
          <span className="text-slate-400" aria-hidden="true">&gt;</span>
        </button>
      </div>
    </>
  )

  const renderBusinessOwnerProfilePanel = () => (
    <>
      {renderBusinessOwnerPanelHeader('Profile')}
      <section className={businessOwnerPanelCardClass}>
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-600">
            Name
            <input
              className={businessOwnerInputClass}
              value={businessOwnerProfileForm.name}
              onChange={handleBusinessOwnerProfileFieldChange('name')}
              maxLength={80}
              disabled={isBusinessOwnerProfileLoading || isBusinessOwnerProfileSaving}
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Phone Number
            <input
              className={`${businessOwnerInputClass} ${
                hasSavedBusinessOwnerPhoneNumber ? 'cursor-default bg-slate-100 text-slate-500' : ''
              }`}
              value={businessOwnerProfileForm.phoneNumber}
              onChange={handleBusinessOwnerProfileFieldChange('phoneNumber')}
              inputMode="numeric"
              pattern="\d{10}"
              maxLength={10}
              readOnly={hasSavedBusinessOwnerPhoneNumber}
              aria-readonly={hasSavedBusinessOwnerPhoneNumber}
              disabled={isBusinessOwnerProfileLoading || isBusinessOwnerProfileSaving}
            />
            {businessOwnerPhoneValidationMessage ? (
              <p className="mt-1.5 text-xs text-rose-700">{businessOwnerPhoneValidationMessage}</p>
            ) : null}
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Email Address
            <input
              className={`${businessOwnerInputClass} cursor-default bg-slate-100 text-slate-500`}
              value={businessOwnerOwnerEmail}
              readOnly
              aria-readonly="true"
              tabIndex={-1}
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Preferred City
            <input
              className={businessOwnerInputClass}
              value={businessOwnerProfileForm.preferredCity}
              onChange={handleBusinessOwnerProfileFieldChange('preferredCity')}
              maxLength={80}
              disabled={isBusinessOwnerProfileLoading || isBusinessOwnerProfileSaving}
            />
          </label>
          {businessOwnerProfileFeedback ? (
            <p
              className={`text-xs ${
                businessOwnerProfileFeedback.type === 'success' ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {businessOwnerProfileFeedback.message}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void handleBusinessOwnerProfileSave()}
            disabled={
              isBusinessOwnerProfileLoading ||
              isBusinessOwnerProfileSaving ||
              Boolean(businessOwnerPhoneValidationMessage)
            }
            className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isBusinessOwnerProfileLoading ? 'Loading...' : isBusinessOwnerProfileSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </section>
    </>
  )

  const renderBusinessOwnerAnalyticsPanel = () => (
    <>
      {renderBusinessOwnerPanelHeader('Analytics')}
      <section className={businessOwnerPanelCardClass}>
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">Premium Feature</span>
        <p className="mt-2 text-sm text-slate-600">Unlock customer activity and profile insights with a premium plan.</p>
        <ul className="mt-4 space-y-2 text-sm text-slate-700">
          {businessOwnerAnalyticsPreviewItems.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <button type="button" className="mt-4 rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700">
          Upgrade to Premium
        </button>
      </section>
    </>
  )

  const renderBusinessOwnerNotificationsPanel = () => (
    <>
      {renderBusinessOwnerPanelHeader('Notifications')}
      <section className={businessOwnerPanelCardClass}>
        <p className="mt-2 text-sm text-slate-600">Stay updated about important business account activity.</p>
        {isBusinessOwnerNotificationPreferenceLoading ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-3 py-4 text-sm text-slate-600">
            Loading notification setting...
          </div>
        ) : !businessOwnerNotificationsEnabled ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-3 py-4">
            <p className="text-sm font-semibold text-[#0f172a]">Notifications are turned off</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Turn on notifications to receive important in-app updates about your business profile, support replies, reviews, reports, and subscription activity.
            </p>
            {businessOwnerNotificationPreferenceError ? (
              <p className="mt-3 text-xs text-rose-700">{businessOwnerNotificationPreferenceError}</p>
            ) : null}
            <button
              type="button"
              onClick={() => void handleBusinessOwnerNotificationPreferenceToggle(true)}
              disabled={isBusinessOwnerNotificationPreferenceSaving}
              className="mt-3 inline-flex rounded-full border border-sky-200 bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isBusinessOwnerNotificationPreferenceSaving ? 'Turning on...' : 'Turn On Notifications'}
            </button>
          </div>
        ) : businessOwnerNotificationPreferenceError && loadedBusinessOwnerNotificationPreferenceUserId !== user?.id ? (
          <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-4 text-sm text-rose-700">
            {businessOwnerNotificationPreferenceError}
          </div>
        ) : isBusinessOwnerNotificationsLoading ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-3 py-4 text-sm text-slate-600">
            Loading notifications...
          </div>
        ) : businessOwnerNotificationsError ? (
          <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-4 text-sm text-rose-700">
            {businessOwnerNotificationsError}
          </div>
        ) : businessOwnerNotifications.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-3 py-4">
            <p className="text-sm font-semibold text-[#0f172a]">No notifications yet</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Important updates about your business profile, support replies, reviews, reports, and subscription activity will appear here.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {businessOwnerNotifications.map((notification) => {
              const isUnread = !notification.is_read
              const notificationDate = formatNotificationDate(notification.created_at)

              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void handleBusinessOwnerNotificationOpen(notification)}
                  disabled={readingBusinessOwnerNotificationId === notification.id}
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-wait disabled:opacity-80 ${
                    isUnread
                      ? 'border-sky-100 bg-sky-50/80 hover:bg-sky-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700">
                      <NotificationsIcon />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className={`text-sm ${isUnread ? 'font-semibold text-[#0f172a]' : 'font-medium text-slate-700'}`}>
                          {notification.title}
                        </span>
                        {isUnread ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500" /> : null}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-slate-600">{notification.message}</span>
                      <span className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        {notificationDate ? <span>{notificationDate}</span> : null}
                        {notification.action_label ? (
                          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 font-semibold text-slate-700">
                            {notification.action_label}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </section>
    </>
  )

  const renderBusinessOwnerSettingsPanel = () => (
    businessOwnerSettingsView === 'faqs' ? (
      <>
        {renderBusinessOwnerSubPanelHeader('Business account FAQs', () => setBusinessOwnerSettingsView('main'))}
        <section className="space-y-3">
          <div className={businessOwnerPanelCardClass}>
            <p className="text-sm leading-relaxed text-slate-600">
              Quick answers about managing your business account and keeping your public profile useful for customers.
            </p>
          </div>
          <div className="space-y-2">
            {businessOwnerFaqItems.map((item) => (
              <button
                key={item.question}
                type="button"
                onClick={() =>
                  setOpenBusinessOwnerFaqQuestion((currentQuestion) =>
                    currentQuestion === item.question ? null : item.question
                  )
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="text-sm font-semibold text-[#0f172a]">{item.question}</span>
                  <span className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true">
                    {openBusinessOwnerFaqQuestion === item.question ? (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 15l-6-6-6 6" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                      </svg>
                    )}
                  </span>
                </span>
                {openBusinessOwnerFaqQuestion === item.question ? (
                  <span className="mt-2 block border-t border-slate-100 pt-2 text-xs leading-relaxed text-slate-600">
                    {item.answer}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </section>
      </>
    ) : businessOwnerSettingsView === 'suggestions' ? (
      <>
        {renderBusinessOwnerSubPanelHeader('Suggestions', () => setBusinessOwnerSettingsView('main'))}
        <section className="space-y-3">
          <div className={businessOwnerPanelCardClass}>
            <p className="text-sm leading-relaxed text-slate-600">
              Share feedback, report an issue, or ask for help improving your business account.
            </p>
          </div>
          <div className={`${businessOwnerPanelCardClass} space-y-3`}>
            <label className="block text-xs font-semibold text-slate-600">
              Type
              <select
                className={businessOwnerInputClass}
                value={businessOwnerSuggestionForm.type}
                onChange={handleBusinessOwnerSuggestionFieldChange('type')}
                disabled={isBusinessOwnerSuggestionSubmitting}
              >
                {businessOwnerSuggestionTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {businessOwnerSuggestionErrors.type ? (
                <p className="mt-1.5 text-xs text-rose-700">{businessOwnerSuggestionErrors.type}</p>
              ) : null}
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Subject
              <select
                className={businessOwnerInputClass}
                value={businessOwnerSuggestionForm.subject}
                onChange={handleBusinessOwnerSuggestionFieldChange('subject')}
                disabled={isBusinessOwnerSuggestionSubmitting}
              >
                <option value="">Select subject</option>
                {businessOwnerSuggestionSubjectOptionsByType[businessOwnerSuggestionForm.type].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {businessOwnerSuggestionErrors.subject ? (
                <p className="mt-1.5 text-xs text-rose-700">{businessOwnerSuggestionErrors.subject}</p>
              ) : null}
            </label>
            {businessOwnerSuggestionForm.subject === 'Others' ? (
              <label className="block text-xs font-semibold text-slate-600">
                Please specify subject
                <input
                  className={businessOwnerInputClass}
                  value={businessOwnerSuggestionForm.customSubject}
                  onChange={handleBusinessOwnerSuggestionFieldChange('customSubject' as keyof CreateBusinessOwnerHelpSuggestionInput)}
                  maxLength={80}
                  disabled={isBusinessOwnerSuggestionSubmitting}
                />
              </label>
            ) : null}
            <label className="block text-xs font-semibold text-slate-600">
              Message
              <textarea
                className={`${businessOwnerInputClass} min-h-28 resize-y`}
                value={businessOwnerSuggestionForm.message}
                onChange={handleBusinessOwnerSuggestionFieldChange('message')}
                maxLength={1000}
                disabled={isBusinessOwnerSuggestionSubmitting}
              />
              {businessOwnerSuggestionErrors.message ? (
                <p className="mt-1.5 text-xs text-rose-700">{businessOwnerSuggestionErrors.message}</p>
              ) : null}
            </label>
            {businessOwnerSuggestionFeedback ? (
              <p
                className={`text-xs ${
                  businessOwnerSuggestionFeedback.type === 'success' ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {businessOwnerSuggestionFeedback.message}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => void handleBusinessOwnerSuggestionSubmit()}
              disabled={isBusinessOwnerSuggestionSubmitting}
              className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isBusinessOwnerSuggestionSubmitting ? 'Sending...' : 'Send suggestion'}
            </button>
          </div>
        </section>
      </>
    ) : businessOwnerSettingsView === 'recent' ? (
      <>
        {renderBusinessOwnerSubPanelHeader('Recent help & suggestions', () => setBusinessOwnerSettingsView('main'))}
        <section className="space-y-3">
          <div className={businessOwnerPanelCardClass}>
            <p className="text-sm leading-relaxed text-slate-600">
              Review your recent suggestions, help requests, issues, and profile improvement submissions.
            </p>
          </div>
          {isBusinessOwnerRecentHelpSuggestionsLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-4 text-sm text-slate-600">
              Loading recent help & suggestions...
            </div>
          ) : businessOwnerRecentHelpSuggestionsError ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-4 text-sm text-rose-700">
              {businessOwnerRecentHelpSuggestionsError}
            </div>
          ) : businessOwnerRecentHelpSuggestions.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-4">
              <p className="text-sm font-semibold text-[#0f172a]">No help or suggestions yet</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Your submitted suggestions, help requests, issues, and profile improvement requests will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {businessOwnerRecentHelpSuggestions.map((item) => {
                const isOpen = openBusinessOwnerRecentHelpSuggestionId === item.id
                const messagePreview =
                  item.message.length > 140 ? `${item.message.slice(0, 140)}...` : item.message

                return (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold text-slate-700">
                            {formatBusinessOwnerHelpSuggestionTypeLabel(item.type)}
                          </span>
                          <span className="rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 font-semibold text-sky-700">
                            {formatBusinessOwnerHelpSuggestionStatusLabel(item.status)}
                          </span>
                          <span>{formatNotificationDate(item.created_at)}</span>
                        </div>
                        <div className="mt-2 text-sm font-semibold text-[#0f172a]">{item.subject}</div>
                        <div className="mt-1 text-xs leading-relaxed text-slate-600">
                          {isOpen ? item.message : messagePreview}
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-label={isOpen ? 'Collapse message details' : 'Expand message details'}
                        onClick={() =>
                          setOpenBusinessOwnerRecentHelpSuggestionId((currentId) => (currentId === item.id ? null : item.id))
                        }
                        className="mt-0.5 shrink-0 rounded-full border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                      >
                        {isOpen ? (
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18 15l-6-6-6 6" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {isOpen ? (
                      <div className="mt-3 border-t border-slate-100 pt-0" />
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </>
    ) : (
      <>
        {renderBusinessOwnerPanelHeader('Settings')}
        <section className="space-y-3">
          {businessOwnerSettingsSections.slice(0, 1).map((section) => (
            <div
              key={section.title}
              className={`rounded-2xl border p-3 ${
                section.danger ? 'border-rose-100 bg-rose-50/70' : 'border-slate-200 bg-slate-50/80'
              }`}
            >
              <h3 className={`text-sm font-semibold ${section.danger ? 'text-rose-700' : 'text-[#0f172a]'}`}>
                {section.title}
              </h3>
              <div className="mt-2 overflow-hidden rounded-xl border border-white/70 bg-white">
                {section.items.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={
                      item === 'Business account FAQs'
                        ? () => {
                            setOpenBusinessOwnerFaqQuestion(null)
                            setBusinessOwnerSettingsView('faqs')
                          }
                        : item === 'Suggestions'
                          ? () => {
                              resetBusinessOwnerSuggestionForm()
                              setBusinessOwnerSettingsView('suggestions')
                            }
                          : item === 'Recent help & suggestions'
                            ? () => {
                                setOpenBusinessOwnerRecentHelpSuggestionId(null)
                                setBusinessOwnerSettingsView('recent')
                              }
                          : undefined
                    }
                    className={`flex w-full items-center justify-between border-b border-slate-100 px-3 py-2.5 text-left text-sm last:border-b-0 ${
                      section.danger ? 'text-rose-700' : 'text-slate-700'
                    }`}
                  >
                    <span>{item}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className={businessOwnerPanelCardClass}>
            <h3 className="text-sm font-semibold text-[#0f172a]">Notification Settings</h3>
            <div className="mt-3 flex items-start justify-between gap-3 rounded-xl border border-white/70 bg-white px-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#0f172a]">Business notifications</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Receive important in-app updates about your business profile, support replies, reviews, reports, and subscription activity.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={businessOwnerNotificationsEnabled}
                onClick={() => void handleBusinessOwnerNotificationPreferenceToggle(!businessOwnerNotificationsEnabled)}
                disabled={
                  isBusinessOwnerNotificationPreferenceLoading ||
                  isBusinessOwnerNotificationPreferenceSaving
                }
                className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span
                  className={`flex h-6 w-11 items-center rounded-full px-1 transition ${
                    businessOwnerNotificationsEnabled ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`h-4 w-4 rounded-full bg-white shadow-sm transition ${
                      businessOwnerNotificationsEnabled ? 'ml-auto' : ''
                    }`}
                  />
                </span>
                {businessOwnerNotificationsEnabled ? 'On' : 'Off'}
              </button>
            </div>
            {businessOwnerNotificationPreferenceFeedback ? (
              <p className="mt-2 text-xs text-emerald-700">{businessOwnerNotificationPreferenceFeedback}</p>
            ) : null}
            {businessOwnerNotificationPreferenceError ? (
              <p className="mt-2 text-xs text-rose-700">{businessOwnerNotificationPreferenceError}</p>
            ) : null}
          </div>
          {businessOwnerSettingsSections.slice(1).map((section) => (
            <div
              key={section.title}
              className={`rounded-2xl border p-3 ${
                section.danger ? 'border-rose-100 bg-rose-50/70' : 'border-slate-200 bg-slate-50/80'
              }`}
            >
              <h3 className={`text-sm font-semibold ${section.danger ? 'text-rose-700' : 'text-[#0f172a]'}`}>
                {section.title}
              </h3>
              <div className="mt-2 overflow-hidden rounded-xl border border-white/70 bg-white">
                {section.items.map((item) => (
                  <div
                    key={item}
                    className={`flex w-full items-center justify-between border-b border-slate-100 px-3 py-2.5 text-left text-sm last:border-b-0 ${
                      section.danger ? 'text-rose-700' : 'text-slate-700'
                    } ${item === 'Change email address' || item === 'Change phone number' ? 'opacity-80' : ''}`}
                  >
                    <span>{item}</span>
                    {item === 'Change email address' || item === 'Change phone number' ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                        Coming Soon
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setIsHomeMenuOpen(false)
              await handleLogout()
            }}
            disabled={isSigningOut}
            className="flex w-full items-center justify-between rounded-2xl border border-rose-100 bg-rose-50/70 px-3 py-3 text-left text-sm font-medium text-rose-700 transition hover:bg-rose-50 focus:bg-rose-50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-rose-600">
                <LogoutIcon />
              </span>
              <span>{isSigningOut ? 'Logging out...' : 'Log Out'}</span>
            </span>
          </button>
        </section>
      </>
    )
  )

  const renderBusinessOwnerMenuContent = () => {
    if (businessOwnerMenuPanel === 'profile') return renderBusinessOwnerProfilePanel()
    if (businessOwnerMenuPanel === 'analytics') return renderBusinessOwnerAnalyticsPanel()
    if (businessOwnerMenuPanel === 'notifications') return renderBusinessOwnerNotificationsPanel()
    if (businessOwnerMenuPanel === 'settings') return renderBusinessOwnerSettingsPanel()
    return renderBusinessOwnerMainMenu()
  }

  return (
    <>
      {isBusinessOwnerPhoneModalOpen && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.5)] sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-[#0f172a]">
                  {businessOwnerPhoneModalMode === 'add' ? 'Add Phone Number' : 'Change Phone Number'}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {businessOwnerPhoneModalMode === 'add'
                    ? 'Enter your phone number. We’ll send an OTP to verify the number.'
                    : 'Enter your new phone number. We’ll send an OTP to verify the number.'}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close change phone dialog"
                onClick={resetBusinessOwnerPhoneModal}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="mt-4">
              {businessOwnerPhoneModalStep === 'phone' ? (
                <>
                  <label className="block text-xs font-semibold text-slate-600">
                    {businessOwnerPhoneModalMode === 'add' ? 'Phone Number' : 'New Phone Number'}
                    <input
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="9876543210"
                      value={businessOwnerPhoneModalPhoneValue}
                      onChange={(event) => {
                        setBusinessOwnerPhoneModalPhoneValue(normalizePhoneNumber(event.target.value))
                        setBusinessOwnerPhoneModalPhoneError('')
                      }}
                      className={businessOwnerInputClass}
                    />
                  </label>
                  {businessOwnerPhoneModalPhoneError ? (
                    <p className="mt-1.5 text-xs text-rose-700">{businessOwnerPhoneModalPhoneError}</p>
                  ) : null}
                </>
              ) : businessOwnerPhoneModalStep === 'otp' ? (
                <>
                  <div>
                    <p className="text-sm font-semibold text-[#0f172a]">Enter OTP</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Enter the OTP sent to your phone number.
                    </p>
                  </div>
                  <label className="mt-3 block text-xs font-semibold text-slate-600">
                    OTP
                    <input
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="Enter OTP"
                      value={businessOwnerPhoneModalOtpValue}
                      onChange={(event) => {
                        setBusinessOwnerPhoneModalOtpValue(event.target.value.replace(/\D/g, '').slice(0, 6))
                        setBusinessOwnerPhoneModalOtpError('')
                      }}
                      className={businessOwnerInputClass}
                    />
                  </label>
                  {businessOwnerPhoneModalOtpError ? (
                    <p className="mt-1.5 text-xs text-rose-700">{businessOwnerPhoneModalOtpError}</p>
                  ) : null}
                </>
              ) : (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-3">
                  <p className="text-sm font-semibold text-emerald-800">Phone number verification UI completed.</p>
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {businessOwnerPhoneModalStep === 'phone' ? (
                <>
                  <button
                    type="button"
                    onClick={resetBusinessOwnerPhoneModal}
                    className="inline-flex justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBusinessOwnerPhoneModalSendOtp}
                    className="inline-flex justify-center rounded-full border border-sky-200 bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                  >
                    Send OTP
                  </button>
                </>
              ) : businessOwnerPhoneModalStep === 'otp' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setBusinessOwnerPhoneModalStep('phone')
                      setBusinessOwnerPhoneModalOtpValue('')
                      setBusinessOwnerPhoneModalOtpError('')
                    }}
                    className="inline-flex justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleBusinessOwnerPhoneModalVerifyOtp}
                    className="inline-flex justify-center rounded-full border border-sky-200 bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                  >
                    Verify OTP
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={resetBusinessOwnerPhoneModal}
                  className="inline-flex justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
      {isBusinessOwnerChangeEmailModalOpen && createPortal(
        <div
          ref={businessOwnerChangeEmailModalRef}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.5)] sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-[#0f172a]">Change Email Address</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  Enter your new email address. We&apos;ll send a verification email to confirm the change.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close change email dialog"
                onClick={resetBusinessOwnerChangeEmailModal}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-600">
                New Email Address
                <input
                  type="email"
                  placeholder="newemail@example.com"
                  value={businessOwnerChangeEmailValue}
                  onChange={(event) => {
                    setBusinessOwnerChangeEmailValue(event.target.value)
                    setBusinessOwnerChangeEmailError('')
                    if (businessOwnerChangeEmailSuccess) {
                      setBusinessOwnerChangeEmailSuccess(false)
                    }
                  }}
                  disabled={isBusinessOwnerChangeEmailSubmitting}
                  className={businessOwnerInputClass}
                />
              </label>
              {businessOwnerChangeEmailError ? (
                <p className="mt-1.5 text-xs text-rose-700">{businessOwnerChangeEmailError}</p>
              ) : null}
              {businessOwnerChangeEmailSuccess ? (
                <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-3">
                  <p className="text-sm font-semibold text-emerald-800">Verification email sent</p>
                  <p className="mt-1 text-xs leading-relaxed text-emerald-700">
                    Please open your inbox and verify the new email address to complete the change.
                  </p>
                </div>
              ) : null}
            </div>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={resetBusinessOwnerChangeEmailModal}
                disabled={isBusinessOwnerChangeEmailSubmitting}
                className="inline-flex justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleBusinessOwnerChangeEmailSubmit()}
                disabled={isBusinessOwnerChangeEmailSubmitting}
                className="inline-flex justify-center rounded-full border border-sky-200 bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isBusinessOwnerChangeEmailSubmitting ? 'Sending...' : 'Send Verification Email'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      <header className={`sticky top-0 w-full px-3 pt-0 pb-0.5 sm:px-4 sm:pb-1 ${hasOpenMenu ? 'z-50' : 'z-30'}`}>
        <ToastContainer toasts={toasts} />
        <div className={`mx-auto w-full max-w-[1440px] ${shouldAnimateEntrance ? 'animate-[navFloatIn_620ms_cubic-bezier(0.22,1,0.36,1)]' : ''}`}>
          <div
            className={`rounded-[2rem] px-3 py-1.5 backdrop-blur-xl sm:px-4 sm:py-2 md:px-5 ${
              useDarkHeaderStyle
                ? 'border border-[rgba(199,210,223,0.10)] bg-[#f8fafc] shadow-[0_18px_36px_-28px_rgba(2,6,23,0.75)]'
                : 'border border-[rgba(199,210,223,0.80)] bg-[#f8fafc] shadow-[0_22px_48px_-30px_rgba(15,23,42,0.34),0_14px_24px_-24px_rgba(15,23,42,0.22)]'
            }`}
          >
          <div
            className={`flex items-center justify-between gap-2 sm:gap-3 ${
              useInlineDarkNavbarLayout ? 'flex-nowrap' : 'flex-wrap'
            }`}
          >
            <button
              type="button"
              onClick={handleBrandClick}
              className={`inline-flex shrink-0 items-center gap-2 text-xs font-semibold tracking-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2 sm:text-sm ${
                useDarkHeaderStyle
                  ? 'text-[#0f172a] focus-visible:ring-offset-slate-950'
                  : 'text-[#0f172a] focus-visible:ring-offset-slate-50'
              }`}
              aria-label="Go to Smart Business Profile home"
              style={navbarInteractionStyle}
            >
              <span
                className={`relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border text-[10px] font-bold text-white sm:h-9 sm:w-9 sm:text-[11px] ${
                  useDarkHeaderStyle
                    ? 'border-sky-400/20 bg-[linear-gradient(145deg,#020617_0%,#0f172a_58%,#0b1120_100%)] shadow-[0_14px_30px_-20px_rgba(14,165,233,0.4)]'
                    : 'border-transparent bg-[linear-gradient(145deg,#020617_0%,#0f172a_65%,#111827_100%)] shadow-[0_14px_30px_-18px_rgba(15,23,42,0.72)]'
                }`}
              >
                <span
                  className={`pointer-events-none absolute inset-x-2 top-1 h-3 rounded-full blur-sm ${
                    useDarkHeaderStyle ? 'bg-sky-300/20' : 'bg-white/20'
                  }`}
                  aria-hidden="true"
                />
                <span className="relative z-10">SB</span>
              </span>
              {!showPreviewHeader &&
                !isLandingPage &&
                !isStartBusinessPage &&
                !isBusinessHomePage &&
                !isCreateProfilePage &&
                !isProfilePreviewPage &&
                !isSimpleDarkNavbarPage &&
                'Smart Business Profile'}
            </button>

            {!isLoading && showPreviewHeader && previewConfig && (
              <div className="ml-auto flex items-center gap-2" aria-label="Preview quick actions">
                <button
                  type="button"
                  onClick={() => navigate(previewConfig.backPath)}
                  className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  style={navbarInteractionStyle}
                >
                  {previewConfig.backLabel}
                </button>
                <button
                  type="button"
                  aria-label="Help"
                  onClick={handleCreateProfileHelp}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/5 text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  style={navbarInteractionStyle}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4.5 w-4.5"
                  >
                    <path d="M9.09 9a3 3 0 1 1 5.82 1c0 2-3 3-3 3" />
                    <path d="M12 17h.01" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                </button>
              </div>
            )}

            {!isLoading && isPublicBusinessProfileVariant && (
              <div className="ml-auto flex shrink-0 items-center gap-2" aria-label="Public business profile quick actions">
                <button
                  type="button"
                  onClick={() => navigate(publicBusinessProfileBackPath)}
                  className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  style={navbarInteractionStyle}
                >
                  {publicBusinessProfileBackLabel}
                </button>
                <button
                  type="button"
                  aria-label="Help"
                  onClick={handleCreateProfileHelp}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/5 text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  style={navbarInteractionStyle}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4.5 w-4.5"
                  >
                    <path d="M9.09 9a3 3 0 1 1 5.82 1c0 2-3 3-3 3" />
                    <path d="M12 17h.01" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                </button>
              </div>
            )}

            {!isLoading && !showPreviewHeader && showCreateProfileTopBar && (
              <div className="ml-auto flex items-center gap-2" aria-label="Create profile quick actions">
                <button
                  type="button"
                  onClick={() => navigate(authenticatedHomePath)}
                  className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  style={navbarInteractionStyle}
                >
                  Home
                </button>
                <button
                  type="button"
                  aria-label="Help"
                  onClick={handleCreateProfileHelp}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/5 text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  style={navbarInteractionStyle}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4.5 w-4.5"
                  >
                    <path d="M9.09 9a3 3 0 1 1 5.82 1c0 2-3 3-3 3" />
                    <path d="M12 17h.01" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                </button>
              </div>
            )}

            {!isLoading && !showPreviewHeader && showProfilePreviewTopBar && (
              <div className="ml-auto flex shrink-0 items-center gap-2" aria-label="Profile preview quick actions">
                <button
                  type="button"
                  onClick={() => navigate('/business-home')}
                  className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  style={navbarInteractionStyle}
                >
                  Home
                </button>
              </div>
            )}

            {!isLoading && !showPreviewHeader && showBusinessHomeTopBar && (
              <div
                ref={homeMenuRef}
                className="ml-auto flex items-center gap-2"
                aria-label="Business home quick actions"
              >
                <button
                  type="button"
                  aria-label={isHomeMenuOpen ? 'Close account menu' : 'Open account menu'}
                  aria-expanded={isHomeMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => {
                    if (!isHomeMenuOpen) {
                      setBusinessOwnerMenuPanel('main')
                      setIsHomeMenuOpen(true)
                      return
                    }
                    closeHomeMenu()
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/5 text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  style={navbarInteractionStyle}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4.5 w-4.5"
                  >
                    <path d="M4 7h16" />
                    <path d="M4 12h16" />
                    <path d="M4 17h16" />
                  </svg>
                </button>

                {isHomeMenuOpen && (
                  <>
                    {createPortal(
                      <div
                        aria-hidden="true"
                        className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-sm"
                        onMouseDown={closeHomeMenu}
                      />,
                      document.body
                    )}
                    <div
                      role="menu"
                      aria-label="Business owner menu"
                      className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-1rem))] max-h-[calc(100vh-5rem)] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white shadow-[0_24px_48px_-28px_rgba(15,23,42,0.45)]"
                    >
                      {businessOwnerMenuPanel === 'main' ? renderBusinessOwnerAccountHeader() : null}
                      <div className="p-3">{renderBusinessOwnerMenuContent()}</div>
                    </div>
                  </>
                )}
              </div>
            )}

            {!isLoading && !showPreviewHeader && !hideAuthenticatedNavButtons && (
              <nav
                className={`items-center ${
                  useInlineDarkNavbarLayout
                    ? 'ml-auto shrink-0 flex-nowrap gap-1 sm:gap-2'
                    : 'w-full flex-wrap justify-end gap-2 pt-2 sm:w-auto sm:pt-0'
                } ${showLandingMobileHamburger ? 'hidden sm:flex' : 'flex'}`}
                aria-label="Primary navigation"
              >
                {navItems.map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => handleNavItemClick(item)}
                    className={navButtonClass(item)}
                    style={navbarInteractionStyle}
                  >
                    <span className="relative z-10">{item.label}</span>
                  </button>
                ))}
                {user && !isPublicBusinessProfileVariant && (
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={isSigningOut}
                    className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 sm:px-3.5 sm:py-1.5 sm:text-sm ${
                      isDarkLandingNavbar
                        ? 'border-white/12 bg-white/5 text-[#0f172a] focus-visible:ring-slate-300 focus-visible:ring-offset-slate-950'
                        : 'border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] text-[#0f172a] shadow-[0_12px_26px_-22px_rgba(15,23,42,0.38)] focus-visible:ring-slate-300 focus-visible:ring-offset-slate-50'
                    }`}
                    style={navbarInteractionStyle}
                  >
                    {isSigningOut ? 'Logging out...' : 'Log Out'}
                  </button>
                )}
              </nav>
            )}

            {!isLoading && showLandingMobileHamburger && (
              <div ref={landingMobileMenuRef} className="relative ml-auto flex shrink-0 items-center sm:hidden" aria-label="Landing page mobile navigation">
                <button
                  type="button"
                  aria-label={isLandingMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                  aria-expanded={isLandingMobileMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => setIsLandingMobileMenuOpen((open) => !open)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/5 text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  style={navbarInteractionStyle}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4.5 w-4.5"
                  >
                    {isLandingMobileMenuOpen ? (
                      <>
                        <path d="M6 6l12 12" />
                        <path d="M18 6L6 18" />
                      </>
                    ) : (
                      <>
                        <path d="M4 7h16" />
                        <path d="M4 12h16" />
                        <path d="M4 17h16" />
                      </>
                    )}
                  </svg>
                </button>

                {isLandingMobileMenuOpen && (
                  <>
                    {createPortal(
                      <div
                        aria-hidden="true"
                        className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-sm"
                        onMouseDown={() => setIsLandingMobileMenuOpen(false)}
                      />,
                      document.body
                    )}
                    <div
                      role="menu"
                      aria-label="Landing page navigation menu"
                      className="absolute right-0 top-full z-50 mt-2 w-[min(9rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_48px_-28px_rgba(15,23,42,0.45)]"
                    >
                      <div className="p-2">
                        {navItems.map((item) => (
                          <button
                            key={item.path}
                            type="button"
                            role="menuitem"
                            onClick={() => handleNavItemClick(item)}
                            className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#0f172a] hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                          >
                            <span className="truncate">{item.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {!isLoading && !showPreviewHeader && showLoggedInHomeIcons && (
              <div ref={homeMenuRef} className="relative ml-auto flex items-center gap-2" aria-label="Home quick actions">
                <button
                  type="button"
                  aria-label="Notifications"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/5 text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  style={navbarInteractionStyle}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4.5 w-4.5"
                  >
                    <path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
                    <path d="M10 20a2 2 0 0 0 4 0" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="Open account menu"
                  aria-expanded={isHomeMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => setIsHomeMenuOpen((open) => !open)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/5 text-[#0f172a] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  style={navbarInteractionStyle}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4.5 w-4.5"
                  >
                    {isHomeMenuOpen ? (
                      <>
                        <path d="M6 6l12 12" />
                        <path d="M18 6L6 18" />
                      </>
                    ) : (
                      <>
                        <path d="M4 7h16" />
                        <path d="M4 12h16" />
                        <path d="M4 17h16" />
                      </>
                    )}
                  </svg>
                </button>

                {isHomeMenuOpen && createPortal(
                  <div
                    ref={customerMenuOverlayRef}
                    className="fixed inset-0 z-[100] overflow-hidden bg-slate-950/12 backdrop-blur-[2px]"
                    onMouseDown={(event) => {
                      if (event.target === event.currentTarget) {
                        setIsHomeMenuOpen(false)
                      }
                    }}
                  >
                    <div className="flex h-[100dvh] w-full justify-end">
                      <div className="flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-white shadow-[0_32px_80px_-36px_rgba(15,23,42,0.45)] sm:m-3 sm:h-[calc(100dvh-1.5rem)] sm:rounded-[1.75rem] sm:border sm:border-slate-200">
                        <div className="border-b border-slate-100 bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)] px-4 py-4">
                          <div className="mb-4 flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              {customerAvatarUrl ? (
                                <img
                                  src={customerAvatarUrl}
                                  alt={`${customerDisplayName} profile`}
                                  className="h-12 w-12 rounded-full border border-sky-100 object-cover"
                                />
                              ) : (
                                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-sky-100 bg-sky-50 text-sm font-semibold text-sky-700">
                                  {getInitials(customerDisplayName)}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-[#0f172a]">{customerDisplayName}</p>
                                <p className="truncate text-xs text-slate-500">{customerEmail}</p>
                                {customerLocation && (
                                  <div className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">
                                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={1.8}
                                        d="M12 21s6-4.35 6-10a6 6 0 1 0-12 0c0 5.65 6 10 6 10z"
                                      />
                                      <circle cx="12" cy="11" r="2.5" strokeWidth={1.8} />
                                    </svg>
                                    <span className="truncate">{customerLocation}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              aria-label="Close customer menu"
                              onClick={() => setIsHomeMenuOpen(false)}
                              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-[0_10px_22px_-18px_rgba(15,23,42,0.32)] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2"
                            >
                              <svg
                                aria-hidden="true"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-4.5 w-4.5"
                              >
                                <path d="M6 6l12 12" />
                                <path d="M18 6L6 18" />
                              </svg>
                            </button>
                          </div>
                          <button
                            type="button"
                            role="menuitem"
                            disabled={customerProfileSettingsItem.disabled}
                            onClick={() => void handleHomeMenuItemClick(customerProfileSettingsItem)}
                            className={`flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-medium shadow-[0_10px_22px_-18px_rgba(15,23,42,0.32)] ${
                              customerProfileSettingsItem.disabled
                                ? 'cursor-not-allowed text-slate-500'
                                : 'text-[#0f172a] hover:bg-slate-50 focus:bg-slate-50'
                            } focus:outline-none`}
                          >
                            <span>{customerProfileSettingsItem.label}</span>
                          </button>
                        </div>

                        <div role="menu" aria-label="Customer menu" className="flex-1 overflow-y-auto overscroll-contain px-0 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                          <div className="p-2">
                            {customerPrimaryMenuItems.map((item, index) => (
                              <button
                                key={item.label}
                                type="button"
                                role="menuitem"
                                disabled={item.disabled}
                                onClick={() => void handleHomeMenuItemClick(item)}
                                className={customerMenuItemClass(item)}
                              >
                                <span className="flex items-center gap-3">
                                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-600">
                                    {index === 0 ? (
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 20a2 2 0 0 0 4 0" />
                                      </svg>
                                    ) : (
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 16.5v-9z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m9 12 2 2 4-5" />
                                      </svg>
                                    )}
                                  </span>
                                  <span>{item.label}</span>
                                </span>
                                {item.disabled && (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                                    Soon
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                          <div className="px-4 pb-1 pt-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">My Activity</p>
                          </div>
                          <div className="p-2 pt-1">
                            {customerActivityMenuItems.map((item, index) => (
                              <button
                                key={item.label}
                                type="button"
                                role="menuitem"
                                disabled={item.disabled}
                                onClick={() => void handleHomeMenuItemClick(item)}
                                className={customerMenuItemClass(item)}
                              >
                                <span className="flex items-center gap-3">
                                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-600">
                                    {index === 0 ? (
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h10M7 12h6m-6 5h10M5 4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-15z" />
                                      </svg>
                                    ) : index === 1 ? (
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v4m0 4h.01M10.3 3.9l-8 13.8A1 1 0 0 0 3.2 19h17.6a1 1 0 0 0 .9-1.3l-8-13.8a1 1 0 0 0-1.8 0z" />
                                      </svg>
                                    ) : (
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h4M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                                      </svg>
                                    )}
                                  </span>
                                  <span>{item.label}</span>
                                </span>
                              </button>
                            ))}
                          </div>
                          <div className="px-4 pb-1 pt-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Community</p>
                          </div>
                          <div className="p-2 pt-1">
                            {customerCommunityMenuItems.map((item, index) => (
                              <button
                                key={item.label}
                                type="button"
                                role="menuitem"
                                disabled={item.disabled}
                                onClick={() => void handleHomeMenuItemClick(item)}
                                className={customerMenuItemClass(item)}
                              >
                                <span className="flex items-center gap-3">
                                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-600">
                                    {index === 0 ? (
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9h.01M11 12h1v4h1" />
                                      </svg>
                                    ) : index === 1 ? (
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4" />
                                      </svg>
                                    ) : (
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h8M8 14h5M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                                      </svg>
                                    )}
                                  </span>
                                  <span>{item.label}</span>
                                </span>
                              </button>
                            ))}
                          </div>
                          <div className="mx-4 my-2 h-px bg-slate-100" />
                          <div className="p-2 pt-0">
                            <button
                              type="button"
                              role="menuitem"
                              disabled={switchToBusinessModeMenuItem.disabled}
                              onClick={() => void handleHomeMenuItemClick(switchToBusinessModeMenuItem)}
                              className={customerMenuItemClass(switchToBusinessModeMenuItem)}
                            >
                              <span className="flex items-center gap-3">
                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sky-700">
                                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7h16M4 12h10M4 17h16" />
                                  </svg>
                                </span>
                                <span>{switchToBusinessModeMenuItem.label}</span>
                              </span>
                            </button>
                          </div>
                          <div className="mx-4 my-2 h-px bg-slate-100" />
                          <div className="px-4 pb-1 pt-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Help &amp; Feedback</p>
                          </div>
                          <div className="p-2 pt-1">
                            {customerHelpMenuItems.map((item, index) => (
                              <button
                                key={item.label}
                                type="button"
                                role="menuitem"
                                disabled={item.disabled}
                                onClick={() => void handleHomeMenuItemClick(item)}
                                className={customerMenuItemClass(item)}
                              >
                                <span className="flex items-center gap-3">
                                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-600">
                                    {index === 0 ? (
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.5 5 8v8l7 3.5 7-3.5V8l-7-3.5zM12 12l7-4M12 12 5 8m7 0v7.5" />
                                      </svg>
                                    ) : index === 1 ? (
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 8h10M7 12h10m-10 4h6M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                                      </svg>
                                    ) : index === 2 ? (
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v4m0 4h.01M10.3 3.9l-8 13.8A1 1 0 0 0 3.2 19h17.6a1 1 0 0 0 .9-1.3l-8-13.8a1 1 0 0 0-1.8 0z" />
                                      </svg>
                                    ) : (
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h8M8 14h4M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                                      </svg>
                                    )}
                                  </span>
                                  <span>{item.label}</span>
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="border-t border-slate-100 bg-white px-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={async () => {
                              setIsHomeMenuOpen(false)
                              await handleLogout()
                            }}
                            disabled={isSigningOut}
                            className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 focus:bg-rose-50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            <span>{isSigningOut ? 'Logging out...' : 'Log Out'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>,
                  document.body
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      </header>
    </>
  )
}

export default AppHeader
