import { supabase } from './supabase.ts'
import type {
  CreateCustomerBusinessSupportPayload,
  CustomerBusinessSupportInsert,
  CustomerBusinessSupportRow,
} from '../types/customerBusinessSupport.ts'

const BUSINESS_SIGNUP_PATH = '/login'

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

export function buildInvitationLink(
  support: CustomerBusinessSupportRow,
  origin: string
): string {
  const url = new URL(BUSINESS_SIGNUP_PATH, origin)
  url.searchParams.set('supportInvite', support.invitation_token)
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
