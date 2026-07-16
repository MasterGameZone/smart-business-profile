import { supabase } from './supabase.ts'
import type {
  BusinessOwnerHelpSuggestionRow,
  CreateBusinessOwnerHelpSuggestionInput,
} from '../types/businessOwnerHelpSuggestion.ts'

const businessOwnerHelpSuggestionSelect =
  'id, owner_id, type, subject, message, status, created_at, updated_at'

export async function createBusinessOwnerHelpSuggestion(
  ownerId: string,
  payload: CreateBusinessOwnerHelpSuggestionInput
): Promise<BusinessOwnerHelpSuggestionRow> {
  const { data, error } = await supabase
    .from('business_owner_help_suggestions')
    .insert({
      owner_id: ownerId,
      type: payload.type,
      subject: payload.subject.trim(),
      message: payload.message.trim(),
      status: 'submitted',
    })
    .select(businessOwnerHelpSuggestionSelect)
    .single()

  if (error) {
    throw error
  }

  return data as BusinessOwnerHelpSuggestionRow
}
