import { supabase } from './supabase.ts'
import type {
  CreateCustomerPlatformSuggestionPayload,
  CustomerFeatureOption,
  CustomerFeatureVoteRow,
  CustomerPlatformSuggestionRow,
} from '../types/customerPlatformSuggestion.ts'

export const CUSTOMER_FEATURE_OPTIONS: CustomerFeatureOption[] = [
  {
    key: 'appointment_booking',
    title: 'Appointment Booking',
    description: 'Let customers request or book appointments directly from business profiles.',
  },
  {
    key: 'offers_vouchers',
    title: 'Offers & Vouchers',
    description: 'Help businesses publish offers and let customers save useful deals.',
  },
  {
    key: 'verified_business_badge',
    title: 'Verified Business Badge',
    description: 'Highlight businesses that complete additional verification steps.',
  },
  {
    key: 'advanced_directory_search',
    title: 'Advanced Directory Search',
    description: 'Improve search with more precise filters for service, area, and category.',
  },
  {
    key: 'business_enquiry_forms',
    title: 'Business Enquiry Forms',
    description: 'Let customers send structured enquiries from a business profile.',
  },
]

export async function listCustomerFeatureVotes(
  customerId: string
): Promise<CustomerFeatureVoteRow[]> {
  const { data, error } = await supabase
    .from('customer_feature_votes')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as CustomerFeatureVoteRow[]
}

export async function voteForFeature(
  customerId: string,
  feature: CustomerFeatureOption
): Promise<CustomerFeatureVoteRow> {
  const { data, error } = await supabase
    .from('customer_feature_votes')
    .insert({
      customer_id: customerId,
      feature_key: feature.key,
      feature_title: feature.title,
    })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data as CustomerFeatureVoteRow
}

export async function removeFeatureVote(
  customerId: string,
  featureKey: CustomerFeatureOption['key']
): Promise<void> {
  const { error } = await supabase
    .from('customer_feature_votes')
    .delete()
    .eq('customer_id', customerId)
    .eq('feature_key', featureKey)

  if (error) {
    throw error
  }
}

export async function listCustomerPlatformSuggestions(
  customerId: string
): Promise<CustomerPlatformSuggestionRow[]> {
  const { data, error } = await supabase
    .from('customer_platform_suggestions')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as CustomerPlatformSuggestionRow[]
}

export async function createCustomerPlatformSuggestion({
  customerId,
  suggestionType,
  title,
  message,
}: CreateCustomerPlatformSuggestionPayload): Promise<CustomerPlatformSuggestionRow> {
  const { data, error } = await supabase
    .from('customer_platform_suggestions')
    .insert({
      customer_id: customerId,
      suggestion_type: suggestionType,
      title,
      message,
      status: 'Submitted',
    })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data as CustomerPlatformSuggestionRow
}
