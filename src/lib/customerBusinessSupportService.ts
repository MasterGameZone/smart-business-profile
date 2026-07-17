import { supabase } from './supabase.ts'
import type {
  CreateCustomerBusinessSupportPayload,
  CustomerImpactProgress,
  CustomerImpactSummary,
  CustomerBusinessSupportInsert,
  CustomerBusinessSupportRow,
  CustomerSupportInvitePreview,
} from '../types/customerBusinessSupport.ts'

const BUSINESS_INVITE_PATH = '/invite'
const RECENT_IMPACT_LIMIT = 5

type SupportInvitePreviewRpcRow = {
  customer_name: string | null
}

function normalizeOptionalMessage(value: string | null): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

export async function listCustomerBusinessSupports(
  customerId: string
): Promise<CustomerBusinessSupportRow[]> {
  const { data, error } = await supabase
    .from('customer_business_supports')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as CustomerBusinessSupportRow[]
}

export function calculateSupporterLevel(businessesSupported: number): {
  badge: string
  level: string
} {
  if (businessesSupported >= 6) {
    return {
      badge: 'Local Champion',
      level: 'Local Champion',
    }
  }

  if (businessesSupported >= 3) {
    return {
      badge: 'Community Builder',
      level: 'Community Builder',
    }
  }

  if (businessesSupported >= 1) {
    return {
      badge: 'Local Supporter',
      level: 'Local Supporter',
    }
  }

  return {
    badge: 'Getting Started',
    level: 'Starter',
  }
}

export function calculateProgressToNextLevel(businessesSupported: number): CustomerImpactProgress {
  if (businessesSupported >= 6) {
    return {
      percent: 100,
      text: 'You reached the top MVP supporter level.',
    }
  }

  const nextThreshold = businessesSupported >= 3 ? 6 : businessesSupported >= 1 ? 3 : 1
  const nextLevel = businessesSupported >= 3
    ? 'Local Champion'
    : businessesSupported >= 1
      ? 'Community Builder'
      : 'Local Supporter'

  return {
    percent: Math.round((businessesSupported / nextThreshold) * 100),
    text: `${businessesSupported} / ${nextThreshold} businesses supported to reach ${nextLevel}`,
  }
}

export function calculateCustomerImpactSummary(
  supports: CustomerBusinessSupportRow[]
): CustomerImpactSummary {
  const businessesSupported = supports.length
  const invitationsShared = supports.filter(
    (support) => support.status === 'Invitation Shared' || support.status === 'Profile Published'
  ).length
  const linksOpened = supports.filter((support) => Boolean(support.invitation_opened_at)).length
  const profilesPublished = supports.filter((support) => support.status === 'Profile Published').length
  const supporterLevel = calculateSupporterLevel(businessesSupported)
  const progress = calculateProgressToNextLevel(businessesSupported)
  const recentSupports = supports.slice(0, RECENT_IMPACT_LIMIT)

  return {
    ...supporterLevel,
    businessesSupported,
    invitationsShared,
    linksOpened,
    profilesPublished,
    progress,
    recentSupports,
  }
}

export async function getCustomerImpactSummary(customerId: string): Promise<CustomerImpactSummary> {
  const supports = await listCustomerBusinessSupports(customerId)
  return calculateCustomerImpactSummary(supports)
}

export async function createCustomerBusinessSupport({
  customerId,
  businessName,
  businessCategory,
  businessLocation,
  customMessage,
}: CreateCustomerBusinessSupportPayload): Promise<CustomerBusinessSupportRow> {
  const payload: CustomerBusinessSupportInsert = {
    customer_id: customerId,
    business_name: businessName,
    business_category: businessCategory,
    business_location: businessLocation,
    custom_message: normalizeOptionalMessage(customMessage),
    status: 'Nominated',
  }

  const { data, error } = await supabase
    .from('customer_business_supports')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data as CustomerBusinessSupportRow
}

export async function markBusinessSupportShared(
  supportId: string,
  customerId: string
): Promise<CustomerBusinessSupportRow> {
  const { data, error } = await supabase
    .from('customer_business_supports')
    .update({
      status: 'Invitation Shared',
      invitation_shared_at: new Date().toISOString(),
    })
    .eq('id', supportId)
    .eq('customer_id', customerId)
    .neq('status', 'Profile Published')
    .select('*')
    .maybeSingle()

  if (error) {
    throw error
  }

  if (data) {
    return data as CustomerBusinessSupportRow
  }

  const existingSupports = await listCustomerBusinessSupports(customerId)
  const existingSupport = existingSupports.find((support) => support.id === supportId)

  if (!existingSupport) {
    throw new Error('Supported business not found.')
  }

  return existingSupport
}

export async function markSupportInviteProfilePublished(
  invitationToken: string,
  profileId: string
): Promise<void> {
  const { error } = await supabase.rpc('mark_support_invite_profile_published', {
    p_invitation_token: invitationToken,
    p_profile_id: profileId,
  })

  if (error) {
    throw error
  }
}

export async function markSupportInviteOpened(invitationToken: string): Promise<void> {
  const trimmedToken = invitationToken.trim()
  if (!trimmedToken) return

  try {
    const { error } = await supabase.rpc('mark_support_invite_opened', {
      invite_token: trimmedToken,
    })

    if (error) {
      console.warn('Support invite open tracking failed.')
    }
  } catch {
    console.warn('Support invite open tracking failed.')
  }
}

export async function getSupportInvitePreview(invitationToken: string): Promise<CustomerSupportInvitePreview | null> {
  const trimmedToken = invitationToken.trim()
  if (!trimmedToken) return null

  try {
    const { data, error } = await supabase
      .rpc('get_support_invite_preview', {
        invite_token: trimmedToken,
      })
      .maybeSingle()

    if (error) {
      console.warn('Support invite preview failed.')
      return null
    }

    const preview = data as SupportInvitePreviewRpcRow | null
    const customerName = typeof preview?.customer_name === 'string' ? preview.customer_name.trim() : ''

    return {
      customerName: customerName || null,
    }
  } catch {
    console.warn('Support invite preview failed.')
    return null
  }
}

export function buildInvitationLink(
  support: CustomerBusinessSupportRow,
  origin: string
): string {
  const url = new URL(`${BUSINESS_INVITE_PATH}/${support.invitation_token}`, origin)
  return url.toString()
}

export function buildInvitationMessage(
  support: CustomerBusinessSupportRow,
  invitationLink: string
): string {
  const customMessage = normalizeOptionalMessage(support.custom_message)

  if (customMessage) {
    return [
      'Hi, I thought your business should be listed on Smart Business Profile.',
      '',
      customMessage,
      '',
      'It helps local businesses create a professional digital profile where customers can discover, save, and contact them easily.',
      '',
      'Create your profile here:',
      invitationLink,
    ].join('\n')
  }

  return [
    'Hi, I thought your business should be listed on Smart Business Profile.',
    '',
    'It helps local businesses create a professional digital profile where customers can discover, save, and contact them easily.',
    '',
    'I am sharing this because I trust your business and think more people should be able to find you online.',
    '',
    'Create your profile here:',
    invitationLink,
  ].join('\n')
}
