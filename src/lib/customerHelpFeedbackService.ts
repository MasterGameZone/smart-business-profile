import { supabase } from './supabase.ts'
import type {
  CreateCustomerHelpFeedbackRequestPayload,
  CustomerHelpFeedbackRequestInsert,
} from '../types/customerHelpFeedback.ts'

export async function createCustomerHelpFeedbackRequest({
  customerId,
  requestType,
  category,
  title,
  message,
  satisfactionLevel,
}: CreateCustomerHelpFeedbackRequestPayload): Promise<void> {
  const payload: CustomerHelpFeedbackRequestInsert = {
    customer_id: customerId,
    request_type: requestType,
    category,
    title,
    message,
    satisfaction_level: satisfactionLevel,
    status: 'Submitted',
  }

  const { error } = await supabase
    .from('customer_help_feedback_requests')
    .insert(payload)

  if (error) {
    throw error
  }
}
