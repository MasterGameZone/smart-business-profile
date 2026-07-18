import { useEffect, useRef, useState, type CSSProperties, type ChangeEvent, type ReactNode } from 'react'
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
import { changeAuthenticatedPassword, resetPassword, signOut } from '../lib/authService.ts'
import {
  ensureProfileUpdateReminderNotification,
  listBusinessOwnerNotifications,
  markBusinessOwnerNotificationRead,
} from '../lib/businessOwnerNotificationService.ts'
import {
  listCustomerNotifications,
  markCustomerNotificationRead,
  syncSupporterProgramAnnouncementNotifications,
} from '../lib/customerNotificationService.ts'
import {
  getCustomerProfile,
  saveCustomerProfile,
} from '../lib/customerProfileService.ts'
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
import { getBusinessProfileFollowersCount } from '../lib/businessProfileFollowService.ts'
import {
  getBusinessProfileViewActivity,
  getBusinessProfileViewsCount,
  type BusinessProfileViewActivityPoint,
} from '../lib/businessProfileViewService.ts'
import {
  getBusinessProfileInsights,
  type BusinessProfileInsight,
} from '../lib/businessProfileInsightsService.ts'
import {
  getBusinessProfileSavesCount,
  getFavoriteBusinessesByUser,
  removeFavoriteBusiness,
} from '../lib/favoriteBusinessService.ts'
import { getBusinessProfileActionCount } from '../lib/businessProfileActionService.ts'
import type { BusinessProfileRow } from '../types/businessProfile.ts'
import type {
  BusinessOwnerHelpSuggestionRow,
  BusinessOwnerHelpSuggestionType,
  CreateBusinessOwnerHelpSuggestionInput,
} from '../types/businessOwnerHelpSuggestion.ts'
import type { BusinessOwnerNotificationRow } from '../types/businessOwnerNotification.ts'
import type { BusinessOwnerProfileFormValues } from '../types/businessOwnerProfile.ts'
import type { CustomerNotificationRow } from '../types/customerNotification.ts'
import type { CustomerProfileFormValues } from '../types/customerProfile.ts'
import type { FavoriteBusinessWithProfileRow } from '../types/favoriteBusiness.ts'
import CustomerCommunityPage from '../pages/CustomerCommunityPage.tsx'
import CustomerMyActivityPage from '../pages/CustomerMyActivityPage.tsx'
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

interface CustomerMenuRenderItem extends HomeMenuItem {
  icon: ReactNode
  showChevron?: boolean
  panel?: CustomerMenuPanel
}

type SupporterBenefitStatus = 'Active / Improving' | 'Planned' | 'Coming Soon' | 'Under Review'

interface SupporterBenefitContent {
  id: string
  title: string
  status: SupporterBenefitStatus
  value: string
  purpose: string
  experience: string[]
  eligibility: string[]
  safeguards: string[]
  future: string
}

const supporterBenefits: SupporterBenefitContent[] = [
  {
    id: 'supporter-badges',
    title: 'Supporter Badges',
    status: 'Active / Improving',
    value: 'Milestone-based recognition for supporters whose invitations lead to published business profiles.',
    purpose: 'Make community contribution visible and measurable.',
    experience: [
      'Badge shown in My Local Impact.',
      'Progress based on published profiles.',
      'Congratulations modal when a new level is reached.',
    ],
    eligibility: [
      'Local Supporter starts at 0 published profiles.',
      'Community Builder starts at 3 published profiles.',
      'Local Champion starts at 10 published profiles, with a 25+ milestone.',
    ],
    safeguards: [
      'Only linked and published profiles count.',
      'Duplicate, test, fraudulent, or abusive activity may be excluded.',
    ],
    future: 'Badge levels may continue improving as the supporter programme matures.',
  },
  {
    id: 'community-recognition',
    title: 'Community Recognition',
    status: 'Active / Improving',
    value: 'Recognition for supporters who help local businesses become discoverable.',
    purpose: 'Make supporters feel appreciated for useful community work.',
    experience: [
      'Current level, contribution metrics, and recent supported businesses.',
      'New badge milestone celebrations.',
      'Future public recognition may be optional.',
    ],
    eligibility: ['Based on verified supporter contribution and published-profile outcomes.'],
    safeguards: [
      'No supporter should be publicly displayed without appropriate visibility controls.',
      'Recognition does not create business authority or ownership.',
    ],
    future: 'Recognition may expand with optional public visibility controls.',
  },
  {
    id: 'supporter-community',
    title: 'Supporter Community',
    status: 'Planned',
    value: 'A dedicated space for supporters to connect, share progress, and participate in local initiatives.',
    purpose: 'Build a sense of belonging around local business growth.',
    experience: [
      'Local, city, or community spaces.',
      'Supporter stories, tips, campaigns, and challenges.',
      'Moderated discussions.',
    ],
    eligibility: ['Eligibility rules will be defined before this planned feature becomes available.'],
    safeguards: [
      'No spam or harassment.',
      'No sharing personal information without consent.',
    ],
    future: 'This is planned as a moderated supporter space.',
  },
  {
    id: 'local-vouchers-offers',
    title: 'Local Vouchers & Offers',
    status: 'Coming Soon',
    value: 'Possible discounts, vouchers, rewards, or special local offers for eligible supporters.',
    purpose: 'Give practical value to supporters while encouraging local discovery.',
    experience: [
      'Supporter-only offers area.',
      'Clear terms, expiry, location, and redemption instructions.',
    ],
    eligibility: ['Availability and qualification rules will depend on each offer.'],
    safeguards: [
      'Offers must show terms and limits.',
      'Availability is not guaranteed after limits are reached.',
      'Abuse controls are required.',
    ],
    future: 'Offers are coming soon and will depend on participating businesses and clear terms.',
  },
  {
    id: 'priority-platform-influence',
    title: 'Priority Platform Influence',
    status: 'Active / Improving',
    value: 'Supporters can help shape platform priorities through suggestions and voting.',
    purpose: 'Use supporter experience to guide product decisions.',
    experience: [
      'Submit feature suggestions.',
      'Vote on eligible platform ideas.',
      'Future status updates may show idea progress.',
    ],
    eligibility: ['Voting and suggestion access follows the current Community privilege rules.'],
    safeguards: [
      'Votes are advisory, not binding.',
      'Security, legal, technical, and strategic constraints still apply.',
    ],
    future: 'Influence tools may improve with clearer proposal status updates.',
  },
  {
    id: 'early-access-features',
    title: 'Early Access to Features',
    status: 'Planned',
    value: 'Selected supporters may test features before broad release.',
    purpose: 'Improve product quality while rewarding engaged supporters.',
    experience: [
      'Early Access or Beta labels.',
      'Clear explanation of limitations.',
      'Feedback submission.',
    ],
    eligibility: ['Selection criteria will be defined before early access is offered.'],
    safeguards: [
      'Beta features may change, pause, or be withdrawn.',
      'Sensitive features need stronger controls.',
    ],
    future: 'Early access is planned for suitable features after safeguards are ready.',
  },
  {
    id: 'supporter-authority',
    title: 'Supporter Authority Over Supported Business',
    status: 'Under Review',
    value: 'A possible future advisory relationship with businesses the supporter helped onboard.',
    purpose: 'Explore useful ongoing guidance without creating ownership or control risks.',
    experience: [
      'Business-controlled invitation to become a recognised supporter or advisor.',
      'Structured suggestions or feedback.',
    ],
    eligibility: ['Would require business consent and approved programme rules.'],
    safeguards: [
      'No automatic edit access, ownership, account access, employment status, or legal authority.',
      'Business consent is required.',
      'Business can revoke access.',
    ],
    future: 'This remains under review and may change substantially before any release.',
  },
  {
    id: 'revenue-share',
    title: 'Revenue-Share Opportunities',
    status: 'Under Review',
    value: 'Potential future earning or reward models tied to eligible referrals, campaigns, or outcomes.',
    purpose: 'Explore whether high-impact supporters can share in created value.',
    experience: [
      'Future programme page with qualifying actions, reward rules, and payment status if approved.',
    ],
    eligibility: ['Would require approved qualifying actions and eligibility checks.'],
    safeguards: [
      'No guaranteed income.',
      'No equity or profit ownership promise.',
      'Legal, tax, fraud, payment, and eligibility checks required.',
    ],
    future: 'This is under review and is not an active reward or income programme.',
  },
  {
    id: 'supporter-leaderboard',
    title: 'Supporter Leaderboard',
    status: 'Planned',
    value: 'Optional rankings for high-impact supporters by city, period, or contribution category.',
    purpose: 'Add motivation and public recognition.',
    experience: [
      'City, monthly, quarterly, or all-time views.',
      'Optional public display.',
    ],
    eligibility: ['Scoring and qualification rules will be defined before launch.'],
    safeguards: [
      'Anti-gaming rules.',
      'Privacy-preserving display.',
      'Clear scoring method.',
    ],
    future: 'A leaderboard is planned with privacy and fairness controls.',
  },
  {
    id: 'city-champion-recognition',
    title: 'City Champion Recognition',
    status: 'Coming Soon',
    value: 'Higher-level recognition for exceptional contribution within a city or area.',
    purpose: 'Celebrate sustained local impact.',
    experience: [
      'City Champion title or marker.',
      'Possible local highlights, discussions, pilots, or events.',
    ],
    eligibility: ['Qualification criteria will be defined before this recognition becomes available.'],
    safeguards: [
      'Does not create authority over businesses or supporters.',
      'Can be removed for fraud, abuse, or misleading representation.',
    ],
    future: 'City recognition is coming soon as the supporter programme grows.',
  },
  {
    id: 'impact-certificate',
    title: 'Impact Certificate',
    status: 'Planned',
    value: 'Downloadable or shareable certificate showing verified supporter contribution.',
    purpose: 'Give supporters a formal record of community impact.',
    experience: [
      'Certificate after an eligible milestone.',
      'Verification link or certificate ID.',
    ],
    eligibility: ['Certificate milestones and verification rules will be defined before launch.'],
    safeguards: [
      'Not an academic, government, employment, or professional qualification.',
      'Personal information only with consent.',
    ],
    future: 'Impact certificates are planned after verification and privacy controls are ready.',
  },
  {
    id: 'public-impact-profile',
    title: 'Public Impact Profile',
    status: 'Planned',
    value: 'Optional public page showing badge, impact metrics, and supporter achievements.',
    purpose: 'Help supporters build a credible public identity around community contribution.',
    experience: [
      'Unique shareable supporter profile link.',
      'Visibility controls.',
      'Verified activity indicators.',
    ],
    eligibility: ['Supporter opt-in and visibility controls will be required.'],
    safeguards: [
      'Do not expose invitation tokens, private messages, phone numbers, or non-public business data.',
      'Must not imply employment, partnership, ownership, or guaranteed endorsement.',
    ],
    future: 'This is planned as an optional public identity feature.',
  },
  {
    id: 'trusted-supporter-tag',
    title: 'Trusted Supporter Tag',
    status: 'Planned',
    value: 'A trust indicator for supporters with verified contribution and responsible conduct.',
    purpose: 'Help distinguish established, policy-compliant supporters.',
    experience: [
      'Visible Trusted Supporter marker.',
      'Explanation of what it means and does not mean.',
    ],
    eligibility: ['Would require verified contribution and responsible conduct.'],
    safeguards: [
      'Not a guarantee of honesty, competence, or authority.',
      'Requires clear review and appeal rules.',
    ],
    future: 'This tag is planned after review standards are defined.',
  },
  {
    id: 'special-event-access',
    title: 'Special Event Access',
    status: 'Coming Soon',
    value: 'Invitations or priority access to selected online or local events.',
    purpose: 'Strengthen community connection and recognition.',
    experience: [
      'Event invitations, registration, event details, and post-event materials.',
    ],
    eligibility: ['Access will depend on event rules, capacity, and supporter criteria.'],
    safeguards: [
      'Invitation does not guarantee admission after capacity is reached.',
      'Events require conduct, safety, consent, and venue rules.',
    ],
    future: 'Event access is coming soon where suitable events are available.',
  },
  {
    id: 'supporter-announcements',
    title: 'Supporter-Only Announcements',
    status: 'Planned',
    value: 'Dedicated communication channel for supporter programme updates and opportunities.',
    purpose: 'Keep supporters informed without mixing programme updates into general notifications.',
    experience: [
      'Supporter announcement feed.',
      'Unread indicators and deep links.',
    ],
    eligibility: ['Announcement access will depend on supporter programme availability.'],
    safeguards: [
      'Avoid excessive promotional messaging.',
      'Provide notification controls where possible.',
    ],
    future: 'Supporter-only announcements are planned for programme updates.',
  },
  {
    id: 'community-voting-powers',
    title: 'Community Voting Powers',
    status: 'Active / Improving',
    value: 'Ability to vote on selected platform features and future community decisions.',
    purpose: 'Give supporters a structured way to express priorities.',
    experience: [
      'Vote on eligible features or proposals.',
      'See summaries, voting periods, and results where available.',
    ],
    eligibility: ['Voting access follows the current Community privilege rules.'],
    safeguards: [
      'Votes are advisory, not binding.',
      'Bot activity, duplicate accounts, coercion, and manipulation are prohibited.',
    ],
    future: 'Voting powers may expand as community decision flows mature.',
  },
]

function supporterBenefitStatusClass(status: SupporterBenefitStatus): string {
  switch (status) {
    case 'Active / Improving':
      return 'bg-emerald-50 text-emerald-700'
    case 'Coming Soon':
      return 'bg-blue-50 text-blue-700'
    case 'Planned':
      return 'bg-slate-100 text-slate-700'
    case 'Under Review':
      return 'bg-amber-50 text-amber-700'
  }
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
type BusinessOwnerSettingsView = 'main' | 'help' | 'notifications' | 'security' | 'faqs' | 'suggestions' | 'recent'
type BusinessOwnerPhoneModalMode = 'add' | 'change'
type BusinessOwnerPhoneModalStep = 'phone' | 'otp' | 'success'
type BusinessOwnerAnalyticsRange = '7D' | '30D' | '90D'
type BusinessOwnerProfileActivityInterval = 'Daily' | 'Weekly' | 'Monthly'
type CustomerMenuPanel =
  | 'main'
  | 'profile'
  | 'notifications'
  | 'saved'
  | 'activity'
  | 'activityReviews'
  | 'activityReports'
  | 'activityCorrections'
  | 'community'
  | 'communityImpact'
  | 'communitySupport'
  | 'communityShape'
  | 'communityBenefit'
  | 'settings'
  | 'helpSuggestions'
  | 'customerFaqs'
  | 'helpSuggestionsRecent'
type CustomerSavedBusinessesLoadState = 'idle' | 'loading' | 'found' | 'empty' | 'error'
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

function CrownIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m4.5 8.5 4 3.5 3.5-6 3.5 6 4-3.5-1.5 9H6l-1.5-9Z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6.5 20h11" />
    </svg>
  )
}

function EyeMetricIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.5 12s3.25-5.5 8.5-5.5 8.5 5.5 8.5 5.5-3.25 5.5-8.5 5.5S3.5 12 3.5 12Z" />
      <circle cx="12" cy="12" r="2.5" strokeWidth={1.8} />
    </svg>
  )
}

function FollowersMetricIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.5 11.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.5 19a5 5 0 0 1 10 0" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16.5 11.5a2.75 2.75 0 1 0 0-5.5" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.5 14.5A4.25 4.25 0 0 1 20.5 19" />
    </svg>
  )
}

function BookmarkMetricIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6.5 4.5h11v15L12 16l-5.5 3.5v-15Z" />
    </svg>
  )
}

function ActionMetricIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m13 2.75-8 11h6l-1 7.5 8-11h-6l1-7.5Z" />
    </svg>
  )
}

function PhoneActionIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6.75 4.5 9 8.75l-1.8 1.8a12.5 12.5 0 0 0 6.25 6.25L15.25 15l4.25 2.25v2.25a2 2 0 0 1-2.18 2A16.75 16.75 0 0 1 2.5 6.68a2 2 0 0 1 2-2.18h2.25Z" />
    </svg>
  )
}

function MessageActionIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 5.75A3.25 3.25 0 0 1 8.25 2.5h7.5A3.25 3.25 0 0 1 19 5.75v5.5a3.25 3.25 0 0 1-3.25 3.25H11l-4.5 4v-4.15A3.25 3.25 0 0 1 5 11.25v-5.5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.5 7.5h7M8.5 10.5h4.5" />
    </svg>
  )
}

function NavigationActionIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20.5 3.5 11.25 20l-1.75-7.5L2 10.75 20.5 3.5Z" />
    </svg>
  )
}

function GlobeActionIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3.5 12h17M12 3.5c2.25 2.3 3.35 5.13 3.35 8.5S14.25 18.2 12 20.5C9.75 18.2 8.65 15.37 8.65 12S9.75 5.8 12 3.5Z" />
    </svg>
  )
}

function TrendInsightIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 17.5 9 12l4 3 6.5-8" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.5 6.5h4v4" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m9 6 6 6-6 6" />
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

function getBusinessOwnerInsightIcon(insightType: string) {
  switch (insightType) {
    case 'most_used_action':
      return <MessageActionIcon />
    case 'followers_30d':
      return <FollowersMetricIcon />
    case 'profile_views_weekly':
    default:
      return <TrendInsightIcon />
  }
}

function getBusinessOwnerInsightAccentClassName(insight: BusinessProfileInsight): string {
  if (insight.insight_type === 'followers_30d') {
    return 'bg-violet-100 text-violet-700'
  }

  if (insight.insight_type === 'most_used_action') {
    return insight.trend === 'positive' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'
  }

  if (insight.trend === 'negative') {
    return 'bg-rose-100 text-rose-700'
  }

  if (insight.trend === 'positive') {
    return 'bg-sky-100 text-sky-700'
  }

  return 'bg-slate-100 text-slate-600'
}

function formatMetricCount(value: number | null): string {
  return value === null ? '—' : value.toLocaleString()
}

function truncateCustomerSavedBusinessText(text: string, length: number): string {
  if (text.length <= length) return text
  return `${text.slice(0, length).trimEnd()}...`
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

const customerFaqItems = [
  {
    question: 'How do I update my customer profile?',
    answer:
      'Open the customer menu, select Profile & Settings, update your name, phone number, preferred city, or preferred area, and then save your changes.',
  },
  {
    question: 'Can I change the email address linked to my account?',
    answer:
      'Your email address is connected to your login account and is currently read-only inside Profile & Settings. Email-address changes are not currently available from the customer profile screen.',
  },
  {
    question: 'How do I verify my email address?',
    answer:
      'Open Profile & Settings and check the verification status shown beside your email address. If your email is not verified, use the available resend verification email option and follow the link sent to your inbox.',
  },
  {
    question: 'How do I reset my password?',
    answer:
      'Open Profile & Settings, go to Login & Security, and select the password reset option. A password reset link will be sent to your registered email address.',
  },
  {
    question: 'Where can I find businesses I have saved?',
    answer:
      'Open the customer menu and select Saved Businesses to view the businesses you have saved for later.',
  },
  {
    question: 'Where can I view or manage my ratings and reviews?',
    answer:
      'Open the customer menu, go to My Activity, and select Ratings & Reviews. You can view, edit, or delete your existing reviews from there.',
  },
  {
    question: 'Where can I check the profiles I have reported?',
    answer:
      'Open the customer menu, go to My Activity, and select Reported Profiles. You can view your submitted reports and their available status information there.',
  },
  {
    question: 'How can I support a local business?',
    answer:
      'Open the customer menu, go to Community, and select Support a Business. You can enter the business details and share the generated invitation through WhatsApp, a copied message, or an invitation link.',
  },
  {
    question: 'What is My Local Impact?',
    answer:
      'My Local Impact shows your contribution to supporting local businesses, including businesses supported, invitations shared, published profiles, supporter level, and progress toward the next level.',
  },
  {
    question: 'How do I switch to a Business Account?',
    answer:
      'Open the customer menu and select Switch to Business Mode. This allows you to access business-owner features and create or manage a business profile without creating a separate login account.',
  },
  {
    question: 'Where can I see my customer notifications?',
    answer:
      'Open the customer menu and select Notifications. Customer notifications may include supported-business updates, supporter-level achievements, report-status updates, and saved-business updates.',
  },
  {
    question: 'How do I contact support or submit a suggestion?',
    answer:
      'Open Settings, select Help & Suggestions, and then choose Suggestions or Contact Us. You can also use Recent to view available previous submissions.',
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

const CUSTOMER_SAVED_BUSINESS_ABOUT_TRUNCATE_LENGTH = 160
const emptyCustomerProfileFormValues: CustomerProfileFormValues = {
  customerName: '',
  phoneNumber: '',
  preferredCity: '',
  preferredArea: '',
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
  const { user, isLoading, accountMode, isBusinessOwnerEnabled, setPreferredAccountMode, setLogoutInProgress } = useAuth()
  const { profileData, setProfileData } = useProfile()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [isHomeMenuOpen, setIsHomeMenuOpen] = useState(false)
  const [businessOwnerMenuPanel, setBusinessOwnerMenuPanel] = useState<BusinessOwnerMenuPanel>('main')
  const [customerMenuPanel, setCustomerMenuPanel] = useState<CustomerMenuPanel>('main')
  const [selectedSupporterBenefitId, setSelectedSupporterBenefitId] = useState<string | null>(null)
  const [isCustomerImpactSummaryView, setIsCustomerImpactSummaryView] = useState(true)
  const [businessOwnerSettingsView, setBusinessOwnerSettingsView] = useState<BusinessOwnerSettingsView>('main')
  const [businessOwnerAnalyticsRange, setBusinessOwnerAnalyticsRange] = useState<BusinessOwnerAnalyticsRange>('30D')
  const [businessOwnerFollowersCount, setBusinessOwnerFollowersCount] = useState<number | null>(null)
  const [businessOwnerProfileViewsCount, setBusinessOwnerProfileViewsCount] = useState<number | null>(null)
  const [businessOwnerSavesCount, setBusinessOwnerSavesCount] = useState<number | null>(null)
  const [businessOwnerCallClicksCount, setBusinessOwnerCallClicksCount] = useState<number | null>(null)
  const [businessOwnerWhatsAppClicksCount, setBusinessOwnerWhatsAppClicksCount] = useState<number | null>(null)
  const [businessOwnerDirectionClicksCount, setBusinessOwnerDirectionClicksCount] = useState<number | null>(null)
  const [businessOwnerWebsiteClicksCount, setBusinessOwnerWebsiteClicksCount] = useState<number | null>(null)
  const [businessOwnerProfileActivityInterval, setBusinessOwnerProfileActivityInterval] =
    useState<BusinessOwnerProfileActivityInterval>('Daily')
  const [businessOwnerProfileActivityPoints, setBusinessOwnerProfileActivityPoints] =
    useState<BusinessProfileViewActivityPoint[] | null>(null)
  const [businessOwnerInsightRows, setBusinessOwnerInsightRows] = useState<BusinessProfileInsight[] | null>(null)
  const [openBusinessOwnerFaqQuestion, setOpenBusinessOwnerFaqQuestion] = useState<string | null>(null)
  const [openCustomerFaqQuestion, setOpenCustomerFaqQuestion] = useState<string | null>(null)
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
  const [isBusinessOwnerChangePasswordModalOpen, setIsBusinessOwnerChangePasswordModalOpen] = useState(false)
  const [businessOwnerCurrentPasswordValue, setBusinessOwnerCurrentPasswordValue] = useState('')
  const [businessOwnerNewPasswordValue, setBusinessOwnerNewPasswordValue] = useState('')
  const [businessOwnerConfirmPasswordValue, setBusinessOwnerConfirmPasswordValue] = useState('')
  const [businessOwnerChangePasswordErrors, setBusinessOwnerChangePasswordErrors] = useState<{
    currentPassword?: string
    newPassword?: string
    confirmPassword?: string
    submit?: string
  }>({})
  const [businessOwnerChangePasswordSuccess, setBusinessOwnerChangePasswordSuccess] = useState(false)
  const [isBusinessOwnerChangePasswordSubmitting, setIsBusinessOwnerChangePasswordSubmitting] = useState(false)
  const [isBusinessOwnerPasswordResetEmailSubmitting, setIsBusinessOwnerPasswordResetEmailSubmitting] = useState(false)
  const [businessOwnerPasswordResetEmailError, setBusinessOwnerPasswordResetEmailError] = useState('')
  const [businessOwnerPasswordResetEmailSuccess, setBusinessOwnerPasswordResetEmailSuccess] = useState('')
  const [businessOwnerSecuritySuccessMessage, setBusinessOwnerSecuritySuccessMessage] = useState('')
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
  const [customerNotifications, setCustomerNotifications] = useState<CustomerNotificationRow[]>([])
  const [customerNotificationsError, setCustomerNotificationsError] = useState('')
  const [loadedCustomerNotificationsUserId, setLoadedCustomerNotificationsUserId] = useState('')
  const [readingCustomerNotificationId, setReadingCustomerNotificationId] = useState<string | null>(null)
  const [customerSavedBusinesses, setCustomerSavedBusinesses] = useState<FavoriteBusinessWithProfileRow[]>([])
  const [customerSavedBusinessesLoadState, setCustomerSavedBusinessesLoadState] =
    useState<CustomerSavedBusinessesLoadState>('idle')
  const [removingCustomerSavedBusinessId, setRemovingCustomerSavedBusinessId] = useState<string | null>(null)
  const [customerSavedBusinessesReloadKey, setCustomerSavedBusinessesReloadKey] = useState(0)
  const [customerProfileForm, setCustomerProfileForm] =
    useState<CustomerProfileFormValues>(emptyCustomerProfileFormValues)
  const [loadedCustomerProfileUserId, setLoadedCustomerProfileUserId] = useState('')
  const [customerProfileError, setCustomerProfileError] = useState('')
  const [customerProfileSuccess, setCustomerProfileSuccess] = useState('')
  const [isCustomerProfileSaving, setIsCustomerProfileSaving] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [shouldAnimateEntrance] = useState(() => !hasPlayedNavbarEntrance)
  const toastIdRef = useRef(0)
  const homeMenuRef = useRef<HTMLDivElement | null>(null)
  const businessOwnerChangeEmailModalRef = useRef<HTMLDivElement | null>(null)
  const businessOwnerChangePasswordButtonRef = useRef<HTMLButtonElement | null>(null)
  const businessOwnerCurrentPasswordInputRef = useRef<HTMLInputElement | null>(null)
  const isAppHeaderMountedRef = useRef(true)
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
  const isBusinessOwnerAnalyticsScreenOpen =
    isHomeMenuOpen && showBusinessHomeTopBar && businessOwnerMenuPanel === 'analytics'
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
  const businessOwnerAnalyticsProfileId = businessOwnerMenuState?.businessProfile?.id ?? null
  const businessOwnerProfileForNotifications = effectiveBusinessOwnerMenuState?.businessProfile ?? null
  const businessOwnerNotificationsSessionKey = `${user?.id ?? ''}:${businessOwnerProfileForNotifications?.id ?? ''}`
  const businessOwnerMenuRowClass =
    'flex w-full items-center justify-between border-b border-slate-100/90 px-3 py-3 text-left text-sm text-[#0f172a] transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none'
  const businessOwnerPanelCardClass = 'rounded-2xl border border-slate-200 bg-slate-50/80 p-3'
  const businessOwnerInputClass = 'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-[#0f172a] outline-none focus:ring-2 focus:ring-slate-300'
  const businessOwnerAnalyticsRanges: BusinessOwnerAnalyticsRange[] = ['7D', '30D', '90D']
  const businessOwnerActionCounts = [
    businessOwnerCallClicksCount,
    businessOwnerWhatsAppClicksCount,
    businessOwnerDirectionClicksCount,
    businessOwnerWebsiteClicksCount,
  ]
  const businessOwnerTotalActionsCount = businessOwnerActionCounts.every((count): count is number => count !== null)
    ? businessOwnerActionCounts.reduce((total, count) => total + count, 0)
    : null
  const businessOwnerAnalyticsMetrics = [
    {
      label: 'Profile Views',
      value: formatMetricCount(businessOwnerProfileViewsCount),
      growth: 'Live total views',
      icon: <EyeMetricIcon />,
      accentClassName: 'bg-sky-100 text-sky-700',
    },
    {
      label: 'Followers',
      value: formatMetricCount(businessOwnerFollowersCount),
      growth: 'Live total followers',
      icon: <FollowersMetricIcon />,
      accentClassName: 'bg-violet-100 text-violet-700',
    },
    {
      label: 'Saves',
      value: formatMetricCount(businessOwnerSavesCount),
      growth: 'Live total saves',
      icon: <BookmarkMetricIcon />,
      accentClassName: 'bg-emerald-100 text-emerald-700',
    },
    {
      label: 'Total Actions',
      value: formatMetricCount(businessOwnerTotalActionsCount),
      growth: 'Live total actions',
      icon: <ActionMetricIcon />,
      accentClassName: 'bg-orange-100 text-orange-700',
    },
  ]
  const businessOwnerCustomerActionMetrics = [
    {
      label: 'Call Clicks',
      value: formatMetricCount(businessOwnerCallClicksCount),
      growth: 'Live call clicks',
      icon: <PhoneActionIcon />,
      accentClassName: 'bg-sky-100 text-sky-700',
      growthClassName: 'text-emerald-600',
    },
    {
      label: 'WhatsApp Clicks',
      value: formatMetricCount(businessOwnerWhatsAppClicksCount),
      growth: 'Live WhatsApp clicks',
      icon: <MessageActionIcon />,
      accentClassName: 'bg-emerald-100 text-emerald-700',
      growthClassName: 'text-emerald-600',
    },
    {
      label: 'Direction Clicks',
      value: formatMetricCount(businessOwnerDirectionClicksCount),
      growth: 'Live direction clicks',
      icon: <NavigationActionIcon />,
      accentClassName: 'bg-blue-100 text-blue-700',
      growthClassName: 'text-emerald-600',
    },
    {
      label: 'Website Clicks',
      value: formatMetricCount(businessOwnerWebsiteClicksCount),
      growth: 'Live website clicks',
      icon: <GlobeActionIcon />,
      accentClassName: 'bg-violet-100 text-violet-700',
      growthClassName: 'text-rose-600',
    },
  ]
  const businessOwnerProfileActivityOptions: BusinessOwnerProfileActivityInterval[] = ['Daily', 'Weekly', 'Monthly']
  const businessOwnerProfileActivityChartPoints = businessOwnerProfileActivityPoints ?? []
  const hasBusinessOwnerProfileActivityChartPoints = businessOwnerProfileActivityChartPoints.length > 0
  const businessOwnerProfileActivityValues = businessOwnerProfileActivityChartPoints.map((point) => point.value)
  const businessOwnerProfileActivityMinValue = hasBusinessOwnerProfileActivityChartPoints
    ? Math.min(...businessOwnerProfileActivityValues)
    : 0
  const businessOwnerProfileActivityMaxValue = hasBusinessOwnerProfileActivityChartPoints
    ? Math.max(...businessOwnerProfileActivityValues)
    : 0
  const businessOwnerProfileActivityRange = Math.max(
    businessOwnerProfileActivityMaxValue - businessOwnerProfileActivityMinValue,
    1
  )
  const businessOwnerProfileActivityChart = {
    width: 320,
    height: 96,
    left: 38,
    right: 14,
    top: 12,
    bottom: 24,
  }
  const businessOwnerProfileActivityChartWidth =
    businessOwnerProfileActivityChart.width -
    businessOwnerProfileActivityChart.left -
    businessOwnerProfileActivityChart.right
  const businessOwnerProfileActivityChartHeight =
    businessOwnerProfileActivityChart.height -
    businessOwnerProfileActivityChart.top -
    businessOwnerProfileActivityChart.bottom
  const businessOwnerProfileActivityCoordinates = businessOwnerProfileActivityChartPoints.map((point, index) => {
    const x =
      businessOwnerProfileActivityChart.left +
      (businessOwnerProfileActivityChartPoints.length === 1
        ? businessOwnerProfileActivityChartWidth / 2
        : (index / (businessOwnerProfileActivityChartPoints.length - 1)) * businessOwnerProfileActivityChartWidth)
    const y =
      businessOwnerProfileActivityChart.top +
      ((businessOwnerProfileActivityMaxValue - point.value) / businessOwnerProfileActivityRange) *
        businessOwnerProfileActivityChartHeight

    return {
      ...point,
      x,
      y,
    }
  })
  const businessOwnerProfileActivityLinePath = businessOwnerProfileActivityCoordinates
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')
  const businessOwnerProfileActivityAreaPath = `${businessOwnerProfileActivityLinePath} L ${
    businessOwnerProfileActivityCoordinates[businessOwnerProfileActivityCoordinates.length - 1]?.x ??
    businessOwnerProfileActivityChart.left
  } ${businessOwnerProfileActivityChart.height - businessOwnerProfileActivityChart.bottom} L ${
    businessOwnerProfileActivityCoordinates[0]?.x ?? businessOwnerProfileActivityChart.left
  } ${businessOwnerProfileActivityChart.height - businessOwnerProfileActivityChart.bottom} Z`
  const businessOwnerProfileActivityYAxisValues = [
    businessOwnerProfileActivityMaxValue,
    Math.round((businessOwnerProfileActivityMaxValue + businessOwnerProfileActivityMinValue) / 2),
    businessOwnerProfileActivityMinValue,
  ]
  const businessOwnerInsights = businessOwnerInsightRows?.map((insight) => ({
    ariaLabel: `${insight.title || 'Business insight'} insight`,
    icon: getBusinessOwnerInsightIcon(insight.insight_type),
    accentClassName: getBusinessOwnerInsightAccentClassName(insight),
    title: insight.title || 'Business insight',
    description: insight.description,
  }))
  const businessOwnerHelpSettingsItems = [
    'Business account FAQs',
    'Suggestions',
    'Recent help & suggestions',
  ]
  const businessOwnerSecuritySettingsItems = [
    'Change phone number',
    'Change email address',
    'Change password',
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

  const resetBusinessOwnerChangePasswordModal = () => {
    setBusinessOwnerCurrentPasswordValue('')
    setBusinessOwnerNewPasswordValue('')
    setBusinessOwnerConfirmPasswordValue('')
    setBusinessOwnerChangePasswordErrors({})
    setBusinessOwnerChangePasswordSuccess(false)
    setIsBusinessOwnerChangePasswordSubmitting(false)
    setIsBusinessOwnerPasswordResetEmailSubmitting(false)
    setBusinessOwnerPasswordResetEmailError('')
    setBusinessOwnerPasswordResetEmailSuccess('')
    setIsBusinessOwnerChangePasswordModalOpen(false)
    window.requestAnimationFrame(() => {
      businessOwnerChangePasswordButtonRef.current?.focus()
    })
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
    setBusinessOwnerSecuritySuccessMessage('')
    setCustomerMenuPanel('main')
    setSelectedSupporterBenefitId(null)
    setIsCustomerImpactSummaryView(true)
    setIsHomeMenuOpen(false)
  }

  useEffect(() => {
    if (shouldAnimateEntrance) {
      hasPlayedNavbarEntrance = true
    }
  }, [shouldAnimateEntrance])

  useEffect(() => {
    return () => {
      isAppHeaderMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!showLoggedInHomeIcons) {
      return
    }

    if (window.sessionStorage.getItem('smart-business-profile:open-customer-settings') === 'true') {
      window.sessionStorage.removeItem('smart-business-profile:open-customer-settings')
      setBusinessOwnerMenuPanel('main')
      setCustomerMenuPanel('settings')
      setIsHomeMenuOpen(true)
      return
    }

    if (window.sessionStorage.getItem('smart-business-profile:open-customer-help-suggestions') !== 'true') {
      return
    }

    window.sessionStorage.removeItem('smart-business-profile:open-customer-help-suggestions')
    setBusinessOwnerMenuPanel('main')
    setCustomerMenuPanel('helpSuggestions')
    setIsHomeMenuOpen(true)
  }, [location.pathname, showLoggedInHomeIcons])

  useEffect(() => {
    if (!hasTopBarMenu || !isHomeMenuOpen) {
      return undefined
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (isBusinessOwnerChangePasswordModalOpen) {
        return
      }

      const target = event.target as Node

      if (showLoggedInHomeIcons && customerMenuOverlayRef.current?.contains(target)) {
        return
      }

      if (!homeMenuRef.current?.contains(target)) {
        closeHomeMenu()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isBusinessOwnerChangePasswordModalOpen) {
        return
      }

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
  }, [hasTopBarMenu, isHomeMenuOpen, isBusinessOwnerChangePasswordModalOpen, showLoggedInHomeIcons])

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
    if (!isBusinessOwnerChangePasswordModalOpen) {
      return undefined
    }

    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.requestAnimationFrame(() => {
      businessOwnerCurrentPasswordInputRef.current?.focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !isBusinessOwnerChangePasswordSubmitting &&
        !isBusinessOwnerPasswordResetEmailSubmitting
      ) {
        resetBusinessOwnerChangePasswordModal()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    isBusinessOwnerChangePasswordModalOpen,
    isBusinessOwnerChangePasswordSubmitting,
    isBusinessOwnerPasswordResetEmailSubmitting,
  ])

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
    let isActive = true

    const loadBusinessOwnerFollowersCount = async () => {
      setBusinessOwnerFollowersCount(null)

      if (!isBusinessOwnerAnalyticsScreenOpen || !businessOwnerAnalyticsProfileId) {
        return
      }

      try {
        const followersCount = await getBusinessProfileFollowersCount(businessOwnerAnalyticsProfileId)
        if (isActive) {
          setBusinessOwnerFollowersCount(followersCount)
        }
      } catch (error) {
        console.warn('Failed to load business profile follower count:', error)
        if (isActive) {
          setBusinessOwnerFollowersCount(null)
        }
      }
    }

    void loadBusinessOwnerFollowersCount()

    return () => {
      isActive = false
    }
  }, [businessOwnerAnalyticsProfileId, isBusinessOwnerAnalyticsScreenOpen])

  useEffect(() => {
    let isActive = true

    const loadBusinessOwnerWebsiteClicksCount = async () => {
      setBusinessOwnerWebsiteClicksCount(null)

      if (!isBusinessOwnerAnalyticsScreenOpen || !businessOwnerAnalyticsProfileId) {
        return
      }

      try {
        const websiteClicksCount = await getBusinessProfileActionCount(businessOwnerAnalyticsProfileId, 'website')
        if (isActive) {
          setBusinessOwnerWebsiteClicksCount(websiteClicksCount)
        }
      } catch (error) {
        console.warn('Failed to load business profile website clicks count:', error)
        if (isActive) {
          setBusinessOwnerWebsiteClicksCount(null)
        }
      }
    }

    void loadBusinessOwnerWebsiteClicksCount()

    return () => {
      isActive = false
    }
  }, [businessOwnerAnalyticsProfileId, isBusinessOwnerAnalyticsScreenOpen])

  useEffect(() => {
    let isActive = true

    const loadBusinessOwnerDirectionClicksCount = async () => {
      setBusinessOwnerDirectionClicksCount(null)

      if (!isBusinessOwnerAnalyticsScreenOpen || !businessOwnerAnalyticsProfileId) {
        return
      }

      try {
        const directionClicksCount = await getBusinessProfileActionCount(businessOwnerAnalyticsProfileId, 'directions')
        if (isActive) {
          setBusinessOwnerDirectionClicksCount(directionClicksCount)
        }
      } catch (error) {
        console.warn('Failed to load business profile direction clicks count:', error)
        if (isActive) {
          setBusinessOwnerDirectionClicksCount(null)
        }
      }
    }

    void loadBusinessOwnerDirectionClicksCount()

    return () => {
      isActive = false
    }
  }, [businessOwnerAnalyticsProfileId, isBusinessOwnerAnalyticsScreenOpen])

  useEffect(() => {
    let isActive = true

    const loadBusinessOwnerWhatsAppClicksCount = async () => {
      setBusinessOwnerWhatsAppClicksCount(null)

      if (!isBusinessOwnerAnalyticsScreenOpen || !businessOwnerAnalyticsProfileId) {
        return
      }

      try {
        const whatsAppClicksCount = await getBusinessProfileActionCount(businessOwnerAnalyticsProfileId, 'whatsapp')
        if (isActive) {
          setBusinessOwnerWhatsAppClicksCount(whatsAppClicksCount)
        }
      } catch (error) {
        console.warn('Failed to load business profile WhatsApp clicks count:', error)
        if (isActive) {
          setBusinessOwnerWhatsAppClicksCount(null)
        }
      }
    }

    void loadBusinessOwnerWhatsAppClicksCount()

    return () => {
      isActive = false
    }
  }, [businessOwnerAnalyticsProfileId, isBusinessOwnerAnalyticsScreenOpen])

  useEffect(() => {
    let isActive = true

    const loadBusinessOwnerCallClicksCount = async () => {
      setBusinessOwnerCallClicksCount(null)

      if (!isBusinessOwnerAnalyticsScreenOpen || !businessOwnerAnalyticsProfileId) {
        return
      }

      try {
        const callClicksCount = await getBusinessProfileActionCount(businessOwnerAnalyticsProfileId, 'call')
        if (isActive) {
          setBusinessOwnerCallClicksCount(callClicksCount)
        }
      } catch (error) {
        console.warn('Failed to load business profile call clicks count:', error)
        if (isActive) {
          setBusinessOwnerCallClicksCount(null)
        }
      }
    }

    void loadBusinessOwnerCallClicksCount()

    return () => {
      isActive = false
    }
  }, [businessOwnerAnalyticsProfileId, isBusinessOwnerAnalyticsScreenOpen])

  useEffect(() => {
    let isActive = true

    const loadBusinessOwnerProfileViewsCount = async () => {
      setBusinessOwnerProfileViewsCount(null)

      if (!isBusinessOwnerAnalyticsScreenOpen || !businessOwnerAnalyticsProfileId) {
        return
      }

      try {
        const profileViewsCount = await getBusinessProfileViewsCount(businessOwnerAnalyticsProfileId)
        if (isActive) {
          setBusinessOwnerProfileViewsCount(profileViewsCount)
        }
      } catch (error) {
        console.warn('Failed to load business profile view count:', error)
        if (isActive) {
          setBusinessOwnerProfileViewsCount(null)
        }
      }
    }

    void loadBusinessOwnerProfileViewsCount()

    return () => {
      isActive = false
    }
  }, [businessOwnerAnalyticsProfileId, isBusinessOwnerAnalyticsScreenOpen])

  useEffect(() => {
    let isActive = true

    const loadBusinessOwnerProfileActivity = async () => {
      setBusinessOwnerProfileActivityPoints(null)

      if (!isBusinessOwnerAnalyticsScreenOpen) {
        return
      }

      if (!businessOwnerAnalyticsProfileId) {
        if (isActive) {
          setBusinessOwnerProfileActivityPoints([])
        }
        return
      }

      try {
        const activityPoints = await getBusinessProfileViewActivity(
          businessOwnerAnalyticsProfileId,
          businessOwnerProfileActivityInterval
        )
        if (isActive) {
          setBusinessOwnerProfileActivityPoints(activityPoints)
        }
      } catch (error) {
        console.warn('Failed to load business profile view activity:', error)
        if (isActive) {
          setBusinessOwnerProfileActivityPoints([])
        }
      }
    }

    void loadBusinessOwnerProfileActivity()

    return () => {
      isActive = false
    }
  }, [
    businessOwnerAnalyticsProfileId,
    businessOwnerProfileActivityInterval,
    isBusinessOwnerAnalyticsScreenOpen,
  ])

  useEffect(() => {
    let isActive = true

    const loadBusinessOwnerSavesCount = async () => {
      setBusinessOwnerSavesCount(null)

      if (!isBusinessOwnerAnalyticsScreenOpen || !businessOwnerAnalyticsProfileId) {
        return
      }

      try {
        const savesCount = await getBusinessProfileSavesCount(businessOwnerAnalyticsProfileId)
        if (isActive) {
          setBusinessOwnerSavesCount(savesCount)
        }
      } catch (error) {
        console.warn('Failed to load business profile saves count:', error)
        if (isActive) {
          setBusinessOwnerSavesCount(null)
        }
      }
    }

    void loadBusinessOwnerSavesCount()

    return () => {
      isActive = false
    }
  }, [businessOwnerAnalyticsProfileId, isBusinessOwnerAnalyticsScreenOpen])

  useEffect(() => {
    let isActive = true

    const loadBusinessOwnerInsights = async () => {
      setBusinessOwnerInsightRows(null)

      if (!isBusinessOwnerAnalyticsScreenOpen) {
        return
      }

      if (!businessOwnerAnalyticsProfileId) {
        if (isActive) {
          setBusinessOwnerInsightRows([])
        }
        return
      }

      try {
        const insights = await getBusinessProfileInsights(businessOwnerAnalyticsProfileId)
        if (isActive) {
          setBusinessOwnerInsightRows(insights)
        }
      } catch (error) {
        console.warn('Failed to load business profile insights:', error)
        if (isActive) {
          setBusinessOwnerInsightRows([])
        }
      }
    }

    void loadBusinessOwnerInsights()

    return () => {
      isActive = false
    }
  }, [businessOwnerAnalyticsProfileId, isBusinessOwnerAnalyticsScreenOpen])

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

  useEffect(() => {
    if (!isHomeMenuOpen || customerMenuPanel !== 'notifications' || !user?.id) {
      return undefined
    }

    if (loadedCustomerNotificationsUserId === user.id) {
      return undefined
    }

    let isActive = true

    const loadCustomerNotifications = async () => {
      try {
        try {
          await syncSupporterProgramAnnouncementNotifications()
        } catch (syncError) {
          if (import.meta.env.DEV) {
            console.warn('Failed to sync supporter programme announcements:', syncError)
          }
        }

        const nextNotifications = await listCustomerNotifications(user.id)
        if (!isActive) return
        setCustomerNotifications(nextNotifications)
        setLoadedCustomerNotificationsUserId(user.id)
        setCustomerNotificationsError('')
      } catch (error) {
        if (!isActive) return
        console.error('Failed to load customer notifications:', error)
        setCustomerNotifications([])
        setLoadedCustomerNotificationsUserId(user.id)
        setCustomerNotificationsError('We could not load your notifications right now. Please try again.')
      }
    }

    void loadCustomerNotifications()

    return () => {
      isActive = false
    }
  }, [customerMenuPanel, isHomeMenuOpen, loadedCustomerNotificationsUserId, user?.id])

  useEffect(() => {
    if (!isHomeMenuOpen || customerMenuPanel !== 'profile' || !user?.id) {
      return undefined
    }

    if (loadedCustomerProfileUserId === user.id) {
      return undefined
    }

    let isActive = true

    void getCustomerProfile(user.id)
      .then((profile) => {
        if (!isActive) return
        setCustomerProfileForm({
          customerName: profile?.customer_name ?? '',
          phoneNumber: profile?.phone_number ?? '',
          preferredCity: profile?.preferred_city ?? '',
          preferredArea: profile?.preferred_area ?? '',
        })
        setLoadedCustomerProfileUserId(user.id)
        setCustomerProfileError('')
        setCustomerProfileSuccess('')
      })
      .catch(() => {
        if (!isActive) return
        setCustomerProfileForm(emptyCustomerProfileFormValues)
        setLoadedCustomerProfileUserId(user.id)
        setCustomerProfileError('Unable to load your profile details right now. Please try again.')
        setCustomerProfileSuccess('')
      })

    return () => {
      isActive = false
    }
  }, [customerMenuPanel, isHomeMenuOpen, loadedCustomerProfileUserId, user?.id])

  useEffect(() => {
    if (!isHomeMenuOpen || customerMenuPanel !== 'saved' || !user?.id) {
      return undefined
    }

    let isActive = true

    void getFavoriteBusinessesByUser(user.id)
      .then((nextFavorites) => {
        if (!isActive) return
        setCustomerSavedBusinesses(nextFavorites)
        setCustomerSavedBusinessesLoadState(nextFavorites.length > 0 ? 'found' : 'empty')
      })
      .catch((error) => {
        if (!isActive) return
        console.error('Failed to load favorite businesses:', error)
        setCustomerSavedBusinesses([])
        setCustomerSavedBusinessesLoadState('error')
      })

    return () => {
      isActive = false
    }
  }, [customerMenuPanel, customerSavedBusinessesReloadKey, isHomeMenuOpen, user?.id])

  const showToast = (message: string, type: ToastItem['type'] = 'success') => {
    const id = ++toastIdRef.current
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 4000)
  }

  const showError = (message: string) => {
    showToast(message, 'error')
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

  const handleBusinessOwnerLogout = async () => {
    if (isSigningOut) return

    closeHomeMenu()
    setLogoutInProgress(true)
    setIsSigningOut(true)
    const { error } = await signOut()
    setIsSigningOut(false)

    if (error) {
      setLogoutInProgress(false)
      showError(error)
      return
    }

    navigate('/', { replace: true })
    window.setTimeout(() => {
      setLogoutInProgress(false)
    }, 0)
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

  const markCustomerNotificationReadLocally = async (
    notification: CustomerNotificationRow
  ): Promise<CustomerNotificationRow> => {
    if (!user?.id || notification.is_read || readingCustomerNotificationId === notification.id) {
      return notification
    }

    setReadingCustomerNotificationId(notification.id)

    try {
      const updatedNotification = await markCustomerNotificationRead(notification.id, user.id)
      setCustomerNotifications((currentNotifications) =>
        currentNotifications.map((item) => (item.id === updatedNotification.id ? updatedNotification : item))
      )
      return updatedNotification
    } catch (error) {
      console.error('Failed to mark customer notification read:', error)
      return notification
    } finally {
      setReadingCustomerNotificationId(null)
    }
  }

  const openCustomerProgramNotificationAction = (notification: CustomerNotificationRow): boolean => {
    if (notification.type === 'new_benefit_announced' || notification.type === 'benefit_status_updated') {
      setSelectedSupporterBenefitId(null)
      setCustomerMenuPanel('communityBenefit')
      return true
    }

    if (notification.type !== 'supporter_only_announcement') {
      return false
    }

    if (notification.action_url === '/customer/community#benefit') {
      setSelectedSupporterBenefitId(null)
      setCustomerMenuPanel('communityBenefit')
      return true
    }

    if (notification.action_url === '/customer/community#impact') {
      setCustomerMenuPanel('communityImpact')
      return true
    }

    if (notification.action_url === '/customer/community#support') {
      setCustomerMenuPanel('communitySupport')
      return true
    }

    if (notification.action_url === '/customer/community#shape') {
      setCustomerMenuPanel('communityShape')
      return true
    }

    setCustomerMenuPanel('community')
    return true
  }

  const handleCustomerNotificationOpen = async (notification: CustomerNotificationRow) => {
    const updatedNotification = await markCustomerNotificationReadLocally(notification)

    if (openCustomerProgramNotificationAction(updatedNotification)) {
      return
    }

    if (updatedNotification.action_url) {
      closeHomeMenu()
      navigate(updatedNotification.action_url)
    }
  }

  const handleCustomerSavedBusinessRemove = async (favorite: FavoriteBusinessWithProfileRow) => {
    if (!user?.id || removingCustomerSavedBusinessId) {
      return
    }

    setRemovingCustomerSavedBusinessId(favorite.id)

    try {
      await removeFavoriteBusiness(user.id, favorite.business_profile_id)
      const nextSavedBusinesses = customerSavedBusinesses.filter((item) => item.id !== favorite.id)
      setCustomerSavedBusinesses(nextSavedBusinesses)
      setCustomerSavedBusinessesLoadState(nextSavedBusinesses.length > 0 ? 'found' : 'empty')
      showToast('Saved business removed.')
    } catch (error) {
      console.error('Failed to remove saved business:', error)
      showError('Unable to remove this saved business right now.')
    } finally {
      setRemovingCustomerSavedBusinessId(null)
    }
  }

  const handleCustomerSavedBusinessesRetry = () => {
    setCustomerSavedBusinessesLoadState('idle')
    setCustomerSavedBusinessesReloadKey((currentKey) => currentKey + 1)
  }

  const handleCustomerProfileFieldChange = (field: keyof CustomerProfileFormValues) => (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    setCustomerProfileForm((currentValues) => ({
      ...currentValues,
      [field]: event.target.value,
    }))
    setCustomerProfileError('')
    setCustomerProfileSuccess('')
  }

  const handleCustomerProfileSave = async () => {
    if (!user?.id || isCustomerProfileSaving) {
      return
    }

    setIsCustomerProfileSaving(true)
    setCustomerProfileError('')
    setCustomerProfileSuccess('')

    try {
      const savedProfile = await saveCustomerProfile(user.id, customerProfileForm)
      setCustomerProfileForm({
        customerName: savedProfile.customer_name ?? '',
        phoneNumber: savedProfile.phone_number ?? '',
        preferredCity: savedProfile.preferred_city ?? '',
        preferredArea: savedProfile.preferred_area ?? '',
      })
      setLoadedCustomerProfileUserId(user.id)
      setCustomerProfileSuccess('Your profile settings have been saved.')
    } catch {
      setCustomerProfileError('Unable to save your profile settings right now. Please try again.')
    } finally {
      setIsCustomerProfileSaving(false)
    }
  }

  const handleBusinessOwnerChangeEmailSubmit = () => {
    resetBusinessOwnerChangeEmailModal()
  }

  const handleBusinessOwnerChangePasswordSubmit = async () => {
    if (isBusinessOwnerChangePasswordSubmitting || isBusinessOwnerPasswordResetEmailSubmitting) {
      return
    }

    const nextErrors: {
      currentPassword?: string
      newPassword?: string
      confirmPassword?: string
      submit?: string
    } = {}

    if (!businessOwnerCurrentPasswordValue) {
      nextErrors.currentPassword = 'Please enter your current password.'
    }

    if (!businessOwnerNewPasswordValue) {
      nextErrors.newPassword = 'Please enter a new password.'
    } else if (businessOwnerNewPasswordValue.length < 8) {
      nextErrors.newPassword = 'New password must be at least 8 characters.'
    } else if (
      businessOwnerCurrentPasswordValue &&
      businessOwnerNewPasswordValue === businessOwnerCurrentPasswordValue
    ) {
      nextErrors.newPassword = 'New password must be different from your current password.'
    }

    if (!businessOwnerConfirmPasswordValue) {
      nextErrors.confirmPassword = 'Please confirm your new password.'
    } else if (businessOwnerConfirmPasswordValue !== businessOwnerNewPasswordValue) {
      nextErrors.confirmPassword = 'New password and confirmation do not match.'
    }

    setBusinessOwnerChangePasswordErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setBusinessOwnerChangePasswordSuccess(false)
      setBusinessOwnerPasswordResetEmailSuccess('')
      setBusinessOwnerPasswordResetEmailError('')
      return
    }

    setBusinessOwnerChangePasswordSuccess(false)
    setBusinessOwnerPasswordResetEmailSuccess('')
    setBusinessOwnerPasswordResetEmailError('')
    setBusinessOwnerSecuritySuccessMessage('')
    setIsBusinessOwnerChangePasswordSubmitting(true)

    try {
      const { error } = await changeAuthenticatedPassword(
        businessOwnerCurrentPasswordValue,
        businessOwnerNewPasswordValue
      )

      if (!isAppHeaderMountedRef.current) {
        return
      }

      if (error) {
        setBusinessOwnerChangePasswordErrors({ submit: getBusinessOwnerChangePasswordErrorMessage(error) })
        return
      }

      setBusinessOwnerCurrentPasswordValue('')
      setBusinessOwnerNewPasswordValue('')
      setBusinessOwnerConfirmPasswordValue('')
      setBusinessOwnerChangePasswordErrors({})
      setBusinessOwnerChangePasswordSuccess(true)
    } catch {
      if (!isAppHeaderMountedRef.current) {
        return
      }

      setBusinessOwnerChangePasswordErrors({
        submit: 'We could not change your password. Please try again.',
      })
    } finally {
      if (isAppHeaderMountedRef.current) {
        setIsBusinessOwnerChangePasswordSubmitting(false)
      }
    }
  }

  const getBusinessOwnerChangePasswordErrorMessage = (error: string): string => {
    const message = error.toLowerCase()

    if (message.includes('current password') || message.includes('incorrect')) {
      return 'The current password you entered is incorrect.'
    }

    if (message.includes('weak') || message.includes('security rules') || message.includes('stronger')) {
      return 'This password does not meet the required security rules. Please choose a stronger password.'
    }

    if (message.includes('different') || message.includes('same password')) {
      return 'Your new password must be different from your current password.'
    }

    if (message.includes('session')) {
      return 'Your session has expired. Please log in again before changing your password.'
    }

    if (
      message.includes('additional verification') ||
      message.includes('reauthentication') ||
      message.includes('re-authentication') ||
      message.includes('nonce')
    ) {
      return 'Additional verification is required before changing your password. Please log out, log in again, and retry.'
    }

    if (message.includes('too many') || message.includes('rate limit')) {
      return 'Too many password-change attempts were made. Please wait before trying again.'
    }

    if (message.includes('network') || message.includes('connection')) {
      return 'We could not change your password. Check your connection and try again.'
    }

    return 'We could not change your password. Please try again.'
  }

  const getBusinessOwnerPasswordResetEmailErrorMessage = (error: string): string => {
    const message = error.toLowerCase()

    if (message.includes('session') || message.includes('log in')) {
      return 'Your session has expired. Please log in again and retry.'
    }

    if (message.includes('too many') || message.includes('rate limit')) {
      return 'Too many reset requests were made. Please wait before trying again.'
    }

    if (message.includes('network') || message.includes('connection')) {
      return 'We could not send the reset link. Check your connection and try again.'
    }

    return 'We could not send the password reset link. Please try again.'
  }

  const handleBusinessOwnerForgotCurrentPassword = async () => {
    if (isBusinessOwnerPasswordResetEmailSubmitting || isBusinessOwnerChangePasswordSubmitting) {
      return
    }

    setBusinessOwnerPasswordResetEmailSuccess('')
    setBusinessOwnerPasswordResetEmailError('')
    setBusinessOwnerChangePasswordErrors({})
    setBusinessOwnerChangePasswordSuccess(false)
    setBusinessOwnerSecuritySuccessMessage('')

    if (!user) {
      setBusinessOwnerPasswordResetEmailError('Your session has expired. Please log in again and retry.')
      return
    }

    const registeredEmail = user.email ?? ''

    if (!registeredEmail) {
      setBusinessOwnerPasswordResetEmailError('We could not find an email address for this account.')
      return
    }

    setIsBusinessOwnerPasswordResetEmailSubmitting(true)

    try {
      const { error } = await resetPassword(registeredEmail)

      if (!isAppHeaderMountedRef.current) {
        return
      }

      if (error) {
        setBusinessOwnerPasswordResetEmailError(getBusinessOwnerPasswordResetEmailErrorMessage(error))
        return
      }

      setBusinessOwnerSecuritySuccessMessage('We sent a password reset link to your registered email address.')
      resetBusinessOwnerChangePasswordModal()
    } catch {
      if (!isAppHeaderMountedRef.current) {
        return
      }

      setBusinessOwnerPasswordResetEmailError('We could not send the password reset link. Please try again.')
    } finally {
      if (isAppHeaderMountedRef.current) {
        setIsBusinessOwnerPasswordResetEmailSubmitting(false)
      }
    }
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
    label: 'View Customer Profile',
    onSelect: () => setCustomerMenuPanel('profile'),
  }

  const customerActivityMenuItems: HomeMenuItem[] = [
    { label: 'Ratings & Reviews', path: '/customer/my-activity#reviews' },
    { label: 'Reported Profiles', path: '/customer/my-activity#reports' },
    { label: 'Submitted Corrections', path: '/customer/my-activity#corrections' },
  ]

  const customerCommunityMenuItems: HomeMenuItem[] = [
    { label: 'My Local Impact', path: '/customer/community#impact' },
    { label: 'Support a Business', path: '/customer/community#support' },
    { label: 'Shape the Platform', path: '/customer/community#shape' },
    { label: 'Benefit', path: '/customer/community#benefit' },
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

  const customerMenuRowClass = (isDisabled: boolean | undefined, isLastItem: boolean) =>
    `flex w-full items-center justify-between px-3 py-3 text-left text-sm ${
      isLastItem ? 'border-b-0' : 'border-b border-slate-100/90'
    } ${
      isDisabled
        ? 'cursor-not-allowed text-slate-500'
        : 'text-[#0f172a] transition hover:bg-slate-50 focus:bg-slate-50'
    } focus:outline-none`

  const customerMenuIconClass = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700'
  const renderCustomerMenuRow = (item: CustomerMenuRenderItem, isLastItem: boolean) => (
    <button
      key={item.label}
      type="button"
      role="menuitem"
      disabled={item.disabled}
      onClick={() => {
        if (item.panel) {
          if (item.panel === 'communityBenefit') {
            setSelectedSupporterBenefitId(null)
          }
          if (item.panel === 'customerFaqs') {
            setOpenCustomerFaqQuestion(null)
          }

          setCustomerMenuPanel(item.panel)
          return
        }

        void handleHomeMenuItemClick(item)
      }}
      className={customerMenuRowClass(item.disabled, isLastItem)}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className={customerMenuIconClass}>{item.icon}</span>
        <span className="truncate font-medium">{item.label}</span>
      </span>
      {item.disabled ? (
        <span className="ml-3 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
          Soon
        </span>
      ) : item.showChevron ? (
        <span className="ml-3 shrink-0 text-slate-400" aria-hidden="true">
          <ChevronRightIcon />
        </span>
      ) : null}
    </button>
  )

  const renderCustomerMenuGroup = (title: string | null, items: CustomerMenuRenderItem[]) => (
    <section className="space-y-3">
      {title ? <h2 className="text-sm font-semibold text-[#0f172a]">{title}</h2> : null}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {items.map((item, index) => renderCustomerMenuRow(item, index === items.length - 1))}
      </div>
    </section>
  )

  const renderCustomerPanelHeader = (title: string, backPanel: CustomerMenuPanel = 'main') => (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold text-[#0f172a]">{title}</h2>
      <button
        type="button"
        onClick={() => setCustomerMenuPanel(backPanel)}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
      >
        <span>Back</span>
      </button>
    </div>
  )

  const renderSupporterBenefitDetailSection = (title: string, content: string | string[]) => (
    <section className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
      <h3 className="text-xs font-semibold text-[#0f172a]">{title}</h3>
      {Array.isArray(content) ? (
        <ul className="mt-2 space-y-1.5">
          {content.map((item) => (
            <li key={item} className="flex gap-2 text-xs leading-relaxed text-slate-600">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-slate-400" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-slate-600">{content}</p>
      )}
    </section>
  )

  const renderCustomerBenefitPanel = () => {
    const selectedBenefit = selectedSupporterBenefitId
      ? supporterBenefits.find((benefit) => benefit.id === selectedSupporterBenefitId) ?? null
      : null

    if (selectedBenefit) {
      return (
        <>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="min-w-0 truncate text-sm font-semibold text-[#0f172a]">{selectedBenefit.title}</h2>
            <button
              type="button"
              onClick={() => setSelectedSupporterBenefitId(null)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              <span>Back</span>
            </button>
          </div>

          <div className="space-y-3">
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${supporterBenefitStatusClass(
                selectedBenefit.status
              )}`}
            >
              {selectedBenefit.status}
            </span>
            {renderSupporterBenefitDetailSection('Short value statement', selectedBenefit.value)}
            {renderSupporterBenefitDetailSection('Purpose', selectedBenefit.purpose)}
            {renderSupporterBenefitDetailSection('What supporters may experience', selectedBenefit.experience)}
            {renderSupporterBenefitDetailSection('Eligibility / qualification', selectedBenefit.eligibility)}
            {renderSupporterBenefitDetailSection('Important conditions / safeguards', selectedBenefit.safeguards)}
            {renderSupporterBenefitDetailSection('Future direction', selectedBenefit.future)}
          </div>
        </>
      )
    }

    return (
      <>
        {renderCustomerPanelHeader('Benefit', 'community')}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {supporterBenefits.map((benefit, index) => (
            <button
              key={benefit.id}
              type="button"
              className={customerMenuRowClass(false, index === supporterBenefits.length - 1)}
              onClick={() => setSelectedSupporterBenefitId(benefit.id)}
            >
              <span className="min-w-0 truncate font-medium">{benefit.title}</span>
              <span className="ml-3 flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${supporterBenefitStatusClass(
                    benefit.status
                  )}`}
                >
                  {benefit.status}
                </span>
                <span className="shrink-0 text-slate-400" aria-hidden="true">
                  <ChevronRightIcon />
                </span>
              </span>
            </button>
          ))}
        </section>
      </>
    )
  }

  const renderCustomerAccountHeader = () => (
    <div className="border-b border-slate-100 bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {customerAvatarUrl ? (
            <img
              src={customerAvatarUrl}
              alt={`${customerDisplayName} profile`}
              className="h-12 w-12 shrink-0 rounded-full border border-sky-100 object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-sky-100 bg-sky-50 text-sm font-semibold text-sky-700">
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
        role="menuitem"
        disabled={customerProfileSettingsItem.disabled}
        onClick={() => setCustomerMenuPanel('profile')}
        className={`mt-3 flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-medium shadow-[0_10px_22px_-18px_rgba(15,23,42,0.32)] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 ${
          customerProfileSettingsItem.disabled
            ? 'cursor-not-allowed text-slate-500'
            : 'text-[#0f172a] transition hover:bg-slate-50'
        }`}
      >
        <span>{customerProfileSettingsItem.label}</span>
        {!customerProfileSettingsItem.disabled && (
          <span className="text-slate-400" aria-hidden="true">
            <ChevronRightIcon />
          </span>
        )}
      </button>
    </div>
  )

  const customerPrimaryRenderItems: CustomerMenuRenderItem[] = [
    {
      label: 'Community',
      icon: <FollowersMetricIcon />,
      showChevron: true,
      panel: 'community',
    },
    { label: 'Notifications', icon: <NotificationsIcon />, showChevron: true, panel: 'notifications' },
    { label: 'Saved Businesses', icon: <BookmarkMetricIcon />, showChevron: true, panel: 'saved' },
    {
      label: 'My Activity',
      icon: <MessageActionIcon />,
      showChevron: true,
      panel: 'activity',
    },
  ]
  const customerActivityRenderItems: CustomerMenuRenderItem[] = [
    { label: customerActivityMenuItems[0].label, icon: <MessageActionIcon />, showChevron: true, panel: 'activityReviews' },
    { label: customerActivityMenuItems[1].label, icon: <TrendInsightIcon />, showChevron: true, panel: 'activityReports' },
    { label: customerActivityMenuItems[2].label, icon: <ProfileIcon />, showChevron: true, panel: 'activityCorrections' },
  ]
  const customerCommunityRenderItems: CustomerMenuRenderItem[] = [
    { label: customerCommunityMenuItems[1].label, icon: <ActionMetricIcon />, showChevron: true, panel: 'communitySupport' },
    { label: customerCommunityMenuItems[0].label, icon: <FollowersMetricIcon />, showChevron: true, panel: 'communityImpact' },
    { label: customerCommunityMenuItems[2].label, icon: <SettingsIcon />, showChevron: true, panel: 'communityShape' },
    { label: customerCommunityMenuItems[3].label, icon: <TrendInsightIcon />, showChevron: true, panel: 'communityBenefit' },
  ]
  const customerSettingsRenderItems: CustomerMenuRenderItem[] = [
    { label: 'Help & Suggestions', icon: <MessageActionIcon />, showChevron: true, panel: 'helpSuggestions' },
    { label: 'Security', path: '/customer/profile-settings#security', icon: <SettingsIcon />, showChevron: true },
    { label: 'Log Out', icon: <LogoutIcon />, onSelect: handleLogout },
  ]
  const customerHelpSuggestionsRenderItems: CustomerMenuRenderItem[] = [
    { label: 'Customer Account FAQs', icon: <SettingsIcon />, showChevron: true, panel: 'customerFaqs' },
    { label: 'Support & Feedback', path: '/customer/help-feedback#feedback', icon: <TrendInsightIcon />, showChevron: true },
    { label: 'Contact Us', path: '/customer/help-feedback#contact', icon: <MessageActionIcon />, showChevron: true },
    { label: 'Recent', icon: <NotificationsIcon />, showChevron: true, panel: 'helpSuggestionsRecent' },
  ]
  const customerMenuUserId = user?.id ?? ''
  const isCustomerNotificationsPanelLoading =
    Boolean(customerMenuUserId) &&
    customerMenuPanel === 'notifications' &&
    loadedCustomerNotificationsUserId !== customerMenuUserId &&
    !customerNotificationsError
  const isCustomerProfileLoading =
    Boolean(customerMenuUserId) &&
    customerMenuPanel === 'profile' &&
    loadedCustomerProfileUserId !== customerMenuUserId &&
    !customerProfileError
  const canSaveCustomerProfile = Boolean(user?.id) && !isCustomerProfileLoading && !isCustomerProfileSaving
  const customerProfileInputClass =
    'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-[#0f172a] outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500'
  const customerProfileReadOnlyInputClass =
    'mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-[#0f172a] outline-none'

  const renderCustomerProfilePanel = () => (
    <>
      {renderCustomerPanelHeader('Profile')}
      <div className="space-y-3">
        <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
          <h3 className="text-sm font-semibold text-[#0f172a]">Profile Information</h3>
          <div className="mt-3 space-y-3">
            <label className="block text-xs font-semibold text-slate-600">
              Customer name
              <input
                className={customerProfileInputClass}
                value={customerProfileForm.customerName}
                placeholder={isCustomerProfileLoading ? 'Loading...' : 'Enter your name'}
                disabled={isCustomerProfileLoading || isCustomerProfileSaving}
                onChange={handleCustomerProfileFieldChange('customerName')}
              />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Phone number
              <input
                className={customerProfileInputClass}
                value={customerProfileForm.phoneNumber}
                placeholder={isCustomerProfileLoading ? 'Loading...' : 'Enter your phone number'}
                disabled={isCustomerProfileLoading || isCustomerProfileSaving}
                onChange={handleCustomerProfileFieldChange('phoneNumber')}
              />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Email address
              <input
                className={customerProfileReadOnlyInputClass}
                value={customerEmail}
                placeholder="Not available yet"
                readOnly
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
          <h3 className="text-sm font-semibold text-[#0f172a]">Location Preferences</h3>
          <div className="mt-3 space-y-3">
            <label className="block text-xs font-semibold text-slate-600">
              Preferred city
              <input
                className={customerProfileInputClass}
                value={customerProfileForm.preferredCity}
                placeholder={isCustomerProfileLoading ? 'Loading...' : 'Enter preferred city'}
                disabled={isCustomerProfileLoading || isCustomerProfileSaving}
                onChange={handleCustomerProfileFieldChange('preferredCity')}
              />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Preferred area/locality
              <input
                className={customerProfileInputClass}
                value={customerProfileForm.preferredArea}
                placeholder={isCustomerProfileLoading ? 'Loading...' : 'Enter preferred area or locality'}
                disabled={isCustomerProfileLoading || isCustomerProfileSaving}
                onChange={handleCustomerProfileFieldChange('preferredArea')}
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#0f172a]">Save Changes</p>
              <p className="mt-1 text-xs text-slate-500">
                {isCustomerProfileLoading ? 'Loading your saved profile details.' : 'Save your profile and location preferences.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleCustomerProfileSave()}
              disabled={!canSaveCustomerProfile}
              className="inline-flex items-center justify-center rounded-full bg-[#0f172a] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isCustomerProfileSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
          {(customerProfileSuccess || customerProfileError) && (
            <p
              className={`mt-3 rounded-xl px-3 py-2 text-xs font-medium ${
                customerProfileSuccess ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
              }`}
            >
              {customerProfileSuccess || customerProfileError}
            </p>
          )}
        </section>
      </div>
    </>
  )

  const renderCustomerNotificationsPanel = () => (
    <>
      {renderCustomerPanelHeader('Notifications')}
      {isCustomerNotificationsPanelLoading ? (
        <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
          <p className="text-sm text-[#0f172a]">Loading notifications...</p>
        </section>
      ) : customerNotificationsError ? (
        <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
          <p className="text-sm text-rose-700">{customerNotificationsError}</p>
        </section>
      ) : customerNotifications.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600">
            <NotificationsIcon />
          </div>
          <p className="mt-3 text-sm font-semibold text-[#0f172a]">No notifications yet</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Important updates about your activity, saved businesses, and community contributions will appear here.
          </p>
          <button
            type="button"
            onClick={() => {
              closeHomeMenu()
              navigate('/directory')
            }}
            className="mt-3 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            Explore Businesses
          </button>
        </section>
      ) : (
        <section className="space-y-3">
          {customerNotifications.map((notification) => {
            const isUnread = !notification.is_read

            return (
              <article
                key={notification.id}
                className={`rounded-2xl border p-3 ${
                  isUnread ? 'border-sky-200 bg-sky-50/70' : 'border-slate-200 bg-white'
                }`}
              >
                <button
                  type="button"
                  onClick={() => void handleCustomerNotificationOpen(notification)}
                  disabled={readingCustomerNotificationId === notification.id}
                  className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-wait"
                >
                  <div className="flex gap-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        isUnread ? 'bg-white text-sky-700' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <NotificationsIcon />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            {isUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-sky-600" aria-hidden="true" />}
                            <span className="block text-sm font-semibold text-[#0f172a]">{notification.title}</span>
                          </span>
                          <span className="mt-1 block text-xs leading-relaxed text-slate-600">{notification.message}</span>
                        </span>
                        <span className="shrink-0 text-[11px] font-medium text-slate-500">
                          {formatNotificationDate(notification.created_at)}
                        </span>
                      </span>
                    </span>
                  </div>
                </button>
                {notification.action_label && notification.action_url ? (
                  <button
                    type="button"
                    onClick={() => void handleCustomerNotificationOpen(notification)}
                    disabled={readingCustomerNotificationId === notification.id}
                    className="ml-12 mt-3 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-wait disabled:opacity-70"
                  >
                    {notification.action_label}
                  </button>
                ) : null}
              </article>
            )
          })}
        </section>
      )}
    </>
  )

  const renderCustomerSavedBusinessesPanel = () => (
    <>
      {renderCustomerPanelHeader('Saved Businesses')}
      {customerSavedBusinessesLoadState === 'loading' || customerSavedBusinessesLoadState === 'idle' ? (
        <section className="flex min-h-32 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
          <svg className="h-5 w-5 animate-spin text-sky-500" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="sr-only">Loading saved businesses...</span>
        </section>
      ) : customerSavedBusinessesLoadState === 'error' ? (
        <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-center">
          <p className="text-sm font-medium text-[#0f172a]">Unable to load saved businesses right now.</p>
          <button
            type="button"
            onClick={handleCustomerSavedBusinessesRetry}
            className="mt-3 inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            Try Again
          </button>
        </section>
      ) : customerSavedBusinessesLoadState === 'empty' ? (
        <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-center">
          <p className="text-sm font-semibold text-[#0f172a]">No saved businesses yet.</p>
          <p className="mt-1 text-xs text-slate-500">Save businesses you want to revisit later.</p>
        </section>
      ) : (
        <section className="space-y-3">
          {customerSavedBusinesses.map((favorite) => (
            <article key={favorite.id} className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-start gap-3">
                {favorite.business_profile.logo_url ? (
                  <img
                    src={favorite.business_profile.logo_url}
                    alt={`${favorite.business_profile.business_name} logo`}
                    className="h-11 w-11 shrink-0 rounded-xl border border-slate-100 object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    <ProfileIcon />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#0f172a]">
                    {favorite.business_profile.business_name}
                  </p>
                  {favorite.business_profile.business_category && (
                    <p className="text-xs text-slate-600">{favorite.business_profile.business_category}</p>
                  )}
                  {favorite.business_profile.address && (
                    <p className="mt-0.5 text-xs text-slate-500">{favorite.business_profile.address}</p>
                  )}
                </div>
              </div>
              {favorite.business_profile.about_business && (
                <p className="mt-3 text-xs leading-relaxed text-slate-600">
                  {truncateCustomerSavedBusinessText(
                    favorite.business_profile.about_business,
                    CUSTOMER_SAVED_BUSINESS_ABOUT_TRUNCATE_LENGTH
                  )}
                </p>
              )}
              <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    closeHomeMenu()
                    navigate(`/business/${favorite.business_profile.slug}`)
                  }}
                  className="inline-flex items-center justify-center rounded-full bg-[#0f172a] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                >
                  View Profile
                </button>
                <button
                  type="button"
                  onClick={() => void handleCustomerSavedBusinessRemove(favorite)}
                  disabled={removingCustomerSavedBusinessId === favorite.id}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {removingCustomerSavedBusinessId === favorite.id ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </>
  )

  const customerMenuMainContent = (
    <div className="space-y-3">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[#0f172a]">Customer Account</h2>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {customerPrimaryRenderItems.map((item) => renderCustomerMenuRow(item, false))}
          <button
            type="button"
            role="menuitem"
            disabled={false}
            onClick={() => void handleHomeMenuItemClick(switchToBusinessModeMenuItem)}
            className={customerMenuRowClass(false, false)}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className={customerMenuIconClass}>
                <SwitchIcon />
              </span>
              <span className="truncate font-medium">{switchToBusinessModeMenuItem.label}</span>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => setCustomerMenuPanel('settings')}
            className={customerMenuRowClass(false, true)}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className={customerMenuIconClass}>
                <SettingsIcon />
              </span>
              <span className="truncate font-medium">Settings</span>
            </span>
            <span className="ml-3 shrink-0 text-slate-400" aria-hidden="true">
              <ChevronRightIcon />
            </span>
          </button>
        </div>
      </section>
    </div>
  )

  const renderCustomerMenuContent = () => {
    if (customerMenuPanel === 'profile') {
      return renderCustomerProfilePanel()
    }

    if (customerMenuPanel === 'notifications') {
      return renderCustomerNotificationsPanel()
    }

    if (customerMenuPanel === 'saved') {
      return renderCustomerSavedBusinessesPanel()
    }

    if (customerMenuPanel === 'activity') {
      return (
        <>
          {renderCustomerPanelHeader('My Activity')}
          {renderCustomerMenuGroup(null, customerActivityRenderItems)}
        </>
      )
    }

    if (customerMenuPanel === 'activityReviews') {
      return (
        <>
          {renderCustomerPanelHeader('Ratings & Reviews', 'activity')}
          <CustomerMyActivityPage mode="menu" activeView="reviews" />
        </>
      )
    }

    if (customerMenuPanel === 'activityReports') {
      return (
        <>
          {renderCustomerPanelHeader('Reported Profiles', 'activity')}
          <CustomerMyActivityPage mode="menu" activeView="reports" />
        </>
      )
    }

    if (customerMenuPanel === 'activityCorrections') {
      return (
        <>
          {renderCustomerPanelHeader('Submitted Corrections', 'activity')}
          <CustomerMyActivityPage mode="menu" activeView="corrections" />
        </>
      )
    }

    if (customerMenuPanel === 'community') {
      return (
        <>
          {renderCustomerPanelHeader('Community')}
          {renderCustomerMenuGroup(null, customerCommunityRenderItems)}
        </>
      )
    }

    if (customerMenuPanel === 'communityImpact') {
      return (
        <>
          {isCustomerImpactSummaryView ? renderCustomerPanelHeader('My Local Impact', 'community') : null}
          <CustomerCommunityPage
            mode="menu"
            activeView="impact"
            onImpactSummaryViewChange={setIsCustomerImpactSummaryView}
            onSelectTab={(tab) => {
              if (tab === 'support') {
                setCustomerMenuPanel('communitySupport')
              }
            }}
          />
        </>
      )
    }

    if (customerMenuPanel === 'communitySupport') {
      return (
        <>
          {renderCustomerPanelHeader('Support a Business', 'community')}
          <CustomerCommunityPage mode="menu" activeView="support" />
        </>
      )
    }

    if (customerMenuPanel === 'communityShape') {
      return (
        <>
          {renderCustomerPanelHeader('Shape the Platform', 'community')}
          <CustomerCommunityPage
            mode="menu"
            activeView="shape"
            onSelectTab={(tab) => {
              if (tab === 'support') {
                setCustomerMenuPanel('communitySupport')
              }
            }}
          />
        </>
      )
    }

    if (customerMenuPanel === 'communityBenefit') {
      return renderCustomerBenefitPanel()
    }

    if (customerMenuPanel === 'settings') {
      return (
        <>
          {renderCustomerPanelHeader('Settings')}
          {renderCustomerMenuGroup(null, customerSettingsRenderItems)}
        </>
      )
    }

    if (customerMenuPanel === 'helpSuggestions') {
      return (
        <>
          {renderCustomerPanelHeader('Help & Suggestions', 'settings')}
          {renderCustomerMenuGroup(null, customerHelpSuggestionsRenderItems)}
        </>
      )
    }

    if (customerMenuPanel === 'customerFaqs') {
      return (
        <>
          {renderCustomerPanelHeader('Customer Account FAQs', 'helpSuggestions')}
          <section className="space-y-3">
            <div className="space-y-2">
              {customerFaqItems.map((item) => (
                <button
                  key={item.question}
                  type="button"
                  onClick={() =>
                    setOpenCustomerFaqQuestion((currentQuestion) =>
                      currentQuestion === item.question ? null : item.question
                    )
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-sm font-semibold text-[#0f172a]">{item.question}</span>
                    <span className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true">
                      {openCustomerFaqQuestion === item.question ? (
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
                  {openCustomerFaqQuestion === item.question ? (
                    <span className="mt-2 block border-t border-slate-100 pt-2 text-xs leading-relaxed text-slate-600">
                      {item.answer}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </section>
        </>
      )
    }

    if (customerMenuPanel === 'helpSuggestionsRecent') {
      return (
        <>
          {renderCustomerPanelHeader('Recent', 'helpSuggestions')}
          <section className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
            <p className="text-sm font-semibold text-[#0f172a]">Recent submissions</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Recent customer help and feedback history is not available in this account menu yet.
            </p>
          </section>
        </>
      )
    }

    return customerMenuMainContent
  }

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
    <section className="mx-auto w-full max-w-6xl min-w-0 bg-[#eef4fa]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <button
            type="button"
            aria-label="Back to Business Account menu"
            onClick={() => setBusinessOwnerMenuPanel('main')}
            className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-[0_10px_22px_-18px_rgba(15,23,42,0.42)] transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 6 9 12l6 6" />
            </svg>
          </button>
          <div className="min-w-0">
            <h2 className="text-lg font-bold leading-tight text-[#0f172a]">Analytics</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">Track how customers interact with your profile.</p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Premium analytics badge"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700 shadow-[0_10px_22px_-18px_rgba(180,83,9,0.45)] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        >
          <CrownIcon />
          <span>Premium</span>
        </button>
      </div>

      <div
        className="grid grid-cols-3 gap-1 rounded-full border border-slate-200 bg-white/80 p-1 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.5)]"
        aria-label="Analytics time range"
        onMouseDownCapture={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {businessOwnerAnalyticsRanges.map((range) => {
          const isSelected = businessOwnerAnalyticsRange === range

          return (
            <button
              key={range}
              type="button"
              aria-label={`Show analytics for ${range}`}
              aria-pressed={isSelected}
              onClick={(event) => {
                event.stopPropagation()
                setBusinessOwnerAnalyticsRange(range)
              }}
              className={`rounded-full px-3 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${
                isSelected
                  ? 'bg-sky-100 text-sky-800 shadow-[0_10px_20px_-16px_rgba(2,132,199,0.65)]'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              {range}
            </button>
          )
        })}
      </div>

      <section className="mt-4 grid min-w-0 grid-cols-2 gap-3" aria-label="Analytics metrics">
        {businessOwnerAnalyticsMetrics.map((metric) => (
          <article
            key={metric.label}
            className="min-w-0 rounded-2xl border border-white/80 bg-white p-3 shadow-[0_18px_38px_-30px_rgba(15,23,42,0.55)]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-slate-500">{metric.label}</p>
                <p className="mt-2 text-2xl font-bold leading-none text-[#0f172a]">{metric.value}</p>
              </div>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${metric.accentClassName}`}>
                {metric.icon}
              </span>
            </div>
            <p className="mt-3 text-[11px] font-semibold leading-snug text-emerald-600">{metric.growth}</p>
          </article>
        ))}
      </section>

      <section
        className="mt-4 min-w-0 rounded-2xl border border-white/80 bg-white p-3 shadow-[0_18px_38px_-30px_rgba(15,23,42,0.55)]"
        aria-label={`Customer action metrics for ${businessOwnerAnalyticsRange}`}
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-[#0f172a]">Customer Actions</h3>
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-sky-700 transition hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            <span>View all</span>
            <ChevronRightIcon />
          </button>
        </div>

        <div className="mt-3 grid min-w-0 grid-cols-4 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/60 divide-x divide-slate-100">
          {businessOwnerCustomerActionMetrics.map((metric) => (
            <div key={metric.label} className="min-w-0 px-1.5 py-3 text-center">
              <span className={`mx-auto flex h-8 w-8 items-center justify-center rounded-2xl ${metric.accentClassName}`}>
                {metric.icon}
              </span>
              <p className="mt-2 text-[10px] font-semibold leading-tight text-slate-500">{metric.label}</p>
              <p className="mt-1 text-base font-bold leading-none text-[#0f172a]">{metric.value}</p>
              <p className={`mt-1 text-[10px] font-semibold leading-none ${metric.growthClassName}`}>{metric.growth}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        className="mt-4 min-w-0 rounded-2xl border border-white/80 bg-white p-3 shadow-[0_18px_38px_-30px_rgba(15,23,42,0.55)]"
        aria-label="Profile activity chart"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-[#0f172a]">Profile Activity</h3>
          <div
            onMouseDownCapture={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <label className="sr-only" htmlFor="business-owner-profile-activity-interval">
              Profile activity interval
            </label>
            <select
              id="business-owner-profile-activity-interval"
              value={businessOwnerProfileActivityInterval}
              onChange={(event) => {
                event.stopPropagation()
                setBusinessOwnerProfileActivityInterval(event.target.value as BusinessOwnerProfileActivityInterval)
              }}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-sky-300"
            >
              {businessOwnerProfileActivityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-5 rounded-full bg-sky-500" aria-hidden="true" />
            <span className="text-[11px] font-semibold text-slate-600">Profile Views</span>
          </div>
          {businessOwnerProfileActivityPoints === null ? (
            <div className="flex min-h-[96px] items-center justify-center rounded-xl text-[11px] font-semibold text-slate-500">
              Loading profile views...
            </div>
          ) : hasBusinessOwnerProfileActivityChartPoints ? (
            <svg
              className="h-auto w-full overflow-visible"
              viewBox={`0 0 ${businessOwnerProfileActivityChart.width} ${businessOwnerProfileActivityChart.height}`}
              role="img"
              aria-label={`Profile views activity chart, ${businessOwnerProfileActivityInterval}`}
            >
              <defs>
                <linearGradient id="business-owner-profile-activity-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.24" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {businessOwnerProfileActivityYAxisValues.map((value, index) => {
                const y =
                  businessOwnerProfileActivityChart.top +
                  (index / (businessOwnerProfileActivityYAxisValues.length - 1)) *
                    businessOwnerProfileActivityChartHeight

                return (
                  <g key={value}>
                    <text
                      x={businessOwnerProfileActivityChart.left - 8}
                      y={y + 3}
                      textAnchor="end"
                      className="fill-slate-400 text-[9px] font-semibold"
                    >
                      {value.toLocaleString()}
                    </text>
                    <line
                      x1={businessOwnerProfileActivityChart.left}
                      x2={businessOwnerProfileActivityChart.width - businessOwnerProfileActivityChart.right}
                      y1={y}
                      y2={y}
                      stroke="#cbd5e1"
                      strokeDasharray="4 5"
                      strokeWidth="1"
                      opacity="0.7"
                    />
                  </g>
                )
              })}
              <path d={businessOwnerProfileActivityAreaPath} fill="url(#business-owner-profile-activity-fill)" />
              <path
                d={businessOwnerProfileActivityLinePath}
                fill="none"
                stroke="#0ea5e9"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
              />
              {businessOwnerProfileActivityCoordinates.map((point) => (
                <g key={point.label}>
                  <circle cx={point.x} cy={point.y} r="4" fill="#ffffff" stroke="#0ea5e9" strokeWidth="2.4" />
                  <text
                    x={point.x}
                    y={businessOwnerProfileActivityChart.height - 10}
                    textAnchor="middle"
                    className="fill-slate-400 text-[8px] font-semibold"
                  >
                    {point.label}
                  </text>
                </g>
              ))}
            </svg>
          ) : (
            <div className="flex min-h-[96px] items-center justify-center rounded-xl text-[11px] font-semibold text-slate-500">
              No profile views yet
            </div>
          )}
        </div>
      </section>

      <section
        className="mt-4 min-w-0 rounded-2xl border border-white/80 bg-white p-3 shadow-[0_18px_38px_-30px_rgba(15,23,42,0.55)]"
        aria-label="Business analytics insights"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-[#0f172a]">Insights</h3>
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-sky-700 transition hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            <span>See all insights</span>
            <ChevronRightIcon />
          </button>
        </div>

        {businessOwnerInsights === undefined ? (
          <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/50 px-3 py-4 text-[11px] font-semibold text-slate-500">
            Loading insights...
          </div>
        ) : businessOwnerInsights.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/50 px-3 py-4 text-[11px] font-semibold text-slate-500">
            Insights will appear as customers interact with your profile.
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/50">
            {businessOwnerInsights.map((insight, index) => (
              <button
                key={insight.ariaLabel}
                type="button"
                aria-label={insight.ariaLabel}
                className={`flex w-full min-w-0 items-center gap-3 bg-white/70 px-3 py-3 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-300 ${
                  index === businessOwnerInsights.length - 1 ? '' : 'border-b border-slate-100'
                }`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${insight.accentClassName}`}>
                  {insight.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold leading-snug text-[#0f172a]">{insight.title}</span>
                  <span className="mt-1 block text-[11px] leading-snug text-slate-500">{insight.description}</span>
                </span>
                <span className="shrink-0 text-slate-300" aria-hidden="true">
                  <ChevronRightIcon />
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </section>
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
        {renderBusinessOwnerSubPanelHeader('Business account FAQs', () => setBusinessOwnerSettingsView('help'))}
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
        {renderBusinessOwnerSubPanelHeader('Suggestions', () => setBusinessOwnerSettingsView('help'))}
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
        {renderBusinessOwnerSubPanelHeader('Recent help & suggestions', () => setBusinessOwnerSettingsView('help'))}
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
    ) : businessOwnerSettingsView === 'help' ? (
      <>
        {renderBusinessOwnerSubPanelHeader('Help & Suggestions', () => setBusinessOwnerSettingsView('main'))}
        <section className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {businessOwnerHelpSettingsItems.map((item) => (
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
                      : () => {
                          setOpenBusinessOwnerRecentHelpSuggestionId(null)
                          setBusinessOwnerSettingsView('recent')
                        }
                }
                className={businessOwnerMenuRowClass}
              >
                <span className="font-medium text-[#0f172a]">{item}</span>
                <span className="text-slate-400" aria-hidden="true">&gt;</span>
              </button>
            ))}
          </div>
        </section>
      </>
    ) : businessOwnerSettingsView === 'notifications' ? (
      <>
        {renderBusinessOwnerSubPanelHeader('Notification Settings', () => setBusinessOwnerSettingsView('main'))}
        <section className="space-y-3">
          <div className={businessOwnerPanelCardClass}>
            <div className="flex items-start justify-between gap-3 rounded-xl border border-white/70 bg-white px-3 py-3">
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
        </section>
      </>
    ) : businessOwnerSettingsView === 'security' ? (
      <>
        {renderBusinessOwnerSubPanelHeader('Security', () => setBusinessOwnerSettingsView('main'))}
        <section className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {businessOwnerSecuritySettingsItems.map((item) => (
              item === 'Change password' ? (
                <button
                  key={item}
                  ref={businessOwnerChangePasswordButtonRef}
                  type="button"
                  onClick={() => {
                    setBusinessOwnerCurrentPasswordValue('')
                    setBusinessOwnerNewPasswordValue('')
                    setBusinessOwnerConfirmPasswordValue('')
                    setBusinessOwnerChangePasswordErrors({})
                    setBusinessOwnerChangePasswordSuccess(false)
                    setBusinessOwnerPasswordResetEmailError('')
                    setBusinessOwnerPasswordResetEmailSuccess('')
                    setBusinessOwnerSecuritySuccessMessage('')
                    setIsBusinessOwnerChangePasswordModalOpen(true)
                  }}
                  className={businessOwnerMenuRowClass}
                >
                  <span className="font-medium text-[#0f172a]">{item}</span>
                </button>
              ) : (
                <div
                  key={item}
                  className={`${businessOwnerMenuRowClass} opacity-80`}
                >
                  <span className="font-medium text-[#0f172a]">{item}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                    Coming Soon
                  </span>
                </div>
              )
            ))}
          </div>
          {businessOwnerSecuritySuccessMessage ? (
            <div
              className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-3"
              aria-live="polite"
            >
              <p className="text-sm font-semibold text-emerald-800">
                {businessOwnerSecuritySuccessMessage}
              </p>
            </div>
          ) : null}
          <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-3">
            <div className="overflow-hidden rounded-xl border border-rose-100/80 bg-white/90">
              <div className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm text-rose-700">
                <span className="font-medium">Delete Account</span>
                <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600">
                  Coming Soon
                </span>
              </div>
            </div>
          </div>
        </section>
      </>
    ) : (
      <>
        {renderBusinessOwnerPanelHeader('Settings')}
        <section className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setBusinessOwnerSettingsView('help')}
              className={businessOwnerMenuRowClass}
            >
              <span className="font-medium text-[#0f172a]">Help & Suggestions</span>
              <span className="text-slate-400" aria-hidden="true">&gt;</span>
            </button>
            <button
              type="button"
              onClick={() => setBusinessOwnerSettingsView('notifications')}
              className={businessOwnerMenuRowClass}
            >
              <span className="font-medium text-[#0f172a]">Notification Settings</span>
              <span className="text-slate-400" aria-hidden="true">&gt;</span>
            </button>
            <button
              type="button"
              onClick={() => setBusinessOwnerSettingsView('security')}
              className={`${businessOwnerMenuRowClass} border-b-0`}
            >
              <span className="font-medium text-[#0f172a]">Security</span>
              <span className="text-slate-400" aria-hidden="true">&gt;</span>
            </button>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => void handleBusinessOwnerLogout()}
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
      {isBusinessOwnerChangePasswordModalOpen && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-slate-950/30 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="business-owner-change-password-title"
            className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.5)] sm:p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 id="business-owner-change-password-title" className="text-base font-semibold text-[#0f172a]">
                  Change Password
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close change password dialog"
                onClick={resetBusinessOwnerChangePasswordModal}
                disabled={isBusinessOwnerChangePasswordSubmitting || isBusinessOwnerPasswordResetEmailSubmitting}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18" />
                </svg>
              </button>
            </div>
            <form
              className="mt-4"
              onSubmit={(event) => {
                event.preventDefault()
                void handleBusinessOwnerChangePasswordSubmit()
              }}
            >
              <label htmlFor="business-owner-current-password" className="block text-xs font-semibold text-slate-600">
                Current Password
              </label>
              <input
                ref={businessOwnerCurrentPasswordInputRef}
                id="business-owner-current-password"
                type="password"
                autoComplete="current-password"
                value={businessOwnerCurrentPasswordValue}
                onChange={(event) => {
                  setBusinessOwnerCurrentPasswordValue(event.target.value)
                  setBusinessOwnerChangePasswordErrors((current) => ({
                    ...current,
                    currentPassword: undefined,
                    submit: undefined,
                  }))
                  setBusinessOwnerPasswordResetEmailError('')
                  setBusinessOwnerPasswordResetEmailSuccess('')
                  if (businessOwnerChangePasswordSuccess) {
                    setBusinessOwnerChangePasswordSuccess(false)
                  }
                }}
                disabled={isBusinessOwnerChangePasswordSubmitting || isBusinessOwnerPasswordResetEmailSubmitting}
                aria-invalid={Boolean(businessOwnerChangePasswordErrors.currentPassword)}
                aria-describedby={
                  businessOwnerChangePasswordErrors.currentPassword
                    ? 'business-owner-current-password-error'
                    : undefined
                }
                className={businessOwnerInputClass}
              />
              {businessOwnerChangePasswordErrors.currentPassword ? (
                <p id="business-owner-current-password-error" className="mt-1.5 text-xs text-rose-700" role="alert">
                  {businessOwnerChangePasswordErrors.currentPassword}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => void handleBusinessOwnerForgotCurrentPassword()}
                disabled={isBusinessOwnerChangePasswordSubmitting || isBusinessOwnerPasswordResetEmailSubmitting}
                className="mt-2 inline-flex text-xs font-semibold text-blue-700 transition hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isBusinessOwnerPasswordResetEmailSubmitting ? 'Sending reset link...' : 'Forgot current password?'}
              </button>
              {businessOwnerPasswordResetEmailError ? (
                <p className="mt-2 text-xs text-rose-700" role="alert">
                  {businessOwnerPasswordResetEmailError}
                </p>
              ) : null}
              {businessOwnerPasswordResetEmailSuccess ? (
                <p className="mt-2 text-xs font-semibold text-emerald-700" aria-live="polite">
                  {businessOwnerPasswordResetEmailSuccess}
                </p>
              ) : null}
              <label htmlFor="business-owner-new-password" className="mt-4 block text-xs font-semibold text-slate-600">
                New Password
              </label>
              <input
                id="business-owner-new-password"
                type="password"
                autoComplete="new-password"
                value={businessOwnerNewPasswordValue}
                onChange={(event) => {
                  setBusinessOwnerNewPasswordValue(event.target.value)
                  setBusinessOwnerChangePasswordErrors((current) => ({
                    ...current,
                    newPassword: undefined,
                    submit: undefined,
                  }))
                  setBusinessOwnerPasswordResetEmailError('')
                  setBusinessOwnerPasswordResetEmailSuccess('')
                  if (businessOwnerChangePasswordSuccess) {
                    setBusinessOwnerChangePasswordSuccess(false)
                  }
                }}
                disabled={isBusinessOwnerChangePasswordSubmitting || isBusinessOwnerPasswordResetEmailSubmitting}
                aria-invalid={Boolean(businessOwnerChangePasswordErrors.newPassword)}
                aria-describedby={
                  businessOwnerChangePasswordErrors.newPassword ? 'business-owner-new-password-error' : undefined
                }
                className={businessOwnerInputClass}
              />
              {businessOwnerChangePasswordErrors.newPassword ? (
                <p id="business-owner-new-password-error" className="mt-1.5 text-xs text-rose-700" role="alert">
                  {businessOwnerChangePasswordErrors.newPassword}
                </p>
              ) : null}
              <label htmlFor="business-owner-confirm-password" className="mt-4 block text-xs font-semibold text-slate-600">
                Confirm New Password
              </label>
              <input
                id="business-owner-confirm-password"
                type="password"
                autoComplete="new-password"
                value={businessOwnerConfirmPasswordValue}
                onChange={(event) => {
                  setBusinessOwnerConfirmPasswordValue(event.target.value)
                  setBusinessOwnerChangePasswordErrors((current) => ({
                    ...current,
                    confirmPassword: undefined,
                    submit: undefined,
                  }))
                  setBusinessOwnerPasswordResetEmailError('')
                  setBusinessOwnerPasswordResetEmailSuccess('')
                  if (businessOwnerChangePasswordSuccess) {
                    setBusinessOwnerChangePasswordSuccess(false)
                  }
                }}
                disabled={isBusinessOwnerChangePasswordSubmitting || isBusinessOwnerPasswordResetEmailSubmitting}
                aria-invalid={Boolean(businessOwnerChangePasswordErrors.confirmPassword)}
                aria-describedby={
                  businessOwnerChangePasswordErrors.confirmPassword
                    ? 'business-owner-confirm-password-error'
                    : undefined
                }
                className={businessOwnerInputClass}
              />
              {businessOwnerChangePasswordErrors.confirmPassword ? (
                <p id="business-owner-confirm-password-error" className="mt-1.5 text-xs text-rose-700" role="alert">
                  {businessOwnerChangePasswordErrors.confirmPassword}
                </p>
              ) : null}
              {businessOwnerChangePasswordErrors.submit ? (
                <p className="mt-3 text-xs text-rose-700" role="alert">
                  {businessOwnerChangePasswordErrors.submit}
                </p>
              ) : null}
              {businessOwnerChangePasswordSuccess ? (
                <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-3" aria-live="polite">
                  <p className="text-sm font-semibold text-emerald-800">Password changed successfully.</p>
                </div>
              ) : null}
              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={resetBusinessOwnerChangePasswordModal}
                  disabled={isBusinessOwnerChangePasswordSubmitting || isBusinessOwnerPasswordResetEmailSubmitting}
                  className="inline-flex justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBusinessOwnerChangePasswordSubmitting || isBusinessOwnerPasswordResetEmailSubmitting}
                  className="inline-flex justify-center rounded-full border border-sky-200 bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isBusinessOwnerChangePasswordSubmitting ? 'Changing Password...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      {isBusinessOwnerAnalyticsScreenOpen ? createPortal(
        <div
          role="menu"
          aria-label="Business owner analytics"
          className="fixed inset-0 z-[90] overflow-y-auto overscroll-contain bg-[#eef4fa] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8"
        >
          {renderBusinessOwnerAnalyticsPanel()}
        </div>,
        document.body
      ) : null}
      <header
        className={`sticky top-0 w-full px-3 pt-0 pb-0.5 sm:px-4 sm:pb-1 ${
          hasOpenMenu ? 'z-50' : 'z-30'
        } ${isBusinessOwnerAnalyticsScreenOpen ? 'hidden' : ''}`}
      >
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

                {isHomeMenuOpen && businessOwnerMenuPanel !== 'analytics' && (
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
                  onClick={() => {
                    if (!isHomeMenuOpen) {
                      setCustomerMenuPanel('main')
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
                    className="fixed inset-0 z-[100] overflow-hidden bg-slate-950/20 backdrop-blur-sm"
                    onMouseDown={(event) => {
                      if (event.target === event.currentTarget) {
                        closeHomeMenu()
                      }
                    }}
                  >
                    <div className="flex h-[100dvh] w-full justify-end p-2 sm:p-3">
                      <div
                        role="menu"
                        aria-label="Customer menu"
                        className="flex h-full w-[min(22rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_48px_-28px_rgba(15,23,42,0.45)]"
                      >
                        {customerMenuPanel === 'main' ? renderCustomerAccountHeader() : null}
                        <div className="flex-1 overflow-y-auto overscroll-contain p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
                          {renderCustomerMenuContent()}
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
