export type BusinessOwnerNotificationType =
  | 'profile_update_reminder'
  | 'support_help_reply'
  | 'review_report_update'
  | 'subscription_payment_update'

export interface BusinessOwnerNotificationRow {
  id: string
  owner_id: string
  type: BusinessOwnerNotificationType
  title: string
  message: string
  action_label: string | null
  action_url: string | null
  related_entity_type: string | null
  related_entity_id: string | null
  dedupe_key: string | null
  is_read: boolean
  read_at: string | null
  created_at: string
  updated_at: string
}
