export type CustomerNotificationType =
  | 'supported_business_profile_published'
  | 'supporter_level_unlocked'
  | 'support_invite_opened'
  | 'support_invite_business_signed_up'
  | 'support_invite_business_owner_switched'
  | 'feature_vote_recorded'
  | 'feature_suggestion_submitted'
  | 'report_status_updated'
  | 'saved_business_updated'

export interface CustomerNotificationRow {
  id: string
  customer_id: string
  type: CustomerNotificationType
  title: string
  message: string
  action_label: string | null
  action_url: string | null
  related_entity_type: string | null
  related_entity_id: string | null
  is_read: boolean
  read_at: string | null
  created_at: string
}
