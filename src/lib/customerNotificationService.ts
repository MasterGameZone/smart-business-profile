import { supabase } from './supabase.ts'
import type { CustomerNotificationRow } from '../types/customerNotification.ts'

export async function listCustomerNotifications(
  customerId: string
): Promise<CustomerNotificationRow[]> {
  const { data, error } = await supabase
    .from('customer_notifications')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []) as CustomerNotificationRow[]
}

export async function markCustomerNotificationRead(
  notificationId: string,
  customerId: string
): Promise<CustomerNotificationRow> {
  const { data, error } = await supabase
    .from('customer_notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('id', notificationId)
    .eq('customer_id', customerId)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data as CustomerNotificationRow
}
