import { supabase } from './supabase.ts'
import type {
  BusinessProfileReportInsert,
  BusinessProfileReportReason,
  BusinessProfileReportRow,
} from '../types/businessProfileReport.ts'

function normalizeDetails(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function getOwnReportForBusiness(
  reporterUserId: string,
  businessProfileId: string
): Promise<BusinessProfileReportRow | null> {
  const { data, error } = await supabase
    .from('business_profile_reports')
    .select('*')
    .eq('reporter_user_id', reporterUserId)
    .eq('business_profile_id', businessProfileId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data ?? null) as BusinessProfileReportRow | null
}

export async function checkIfProfileReportedByUser(
  reporterUserId: string,
  businessProfileId: string
): Promise<boolean> {
  const report = await getOwnReportForBusiness(reporterUserId, businessProfileId)
  return Boolean(report)
}

export async function submitBusinessProfileReport({
  reporterUserId,
  businessProfileId,
  reason,
  details,
}: {
  reporterUserId: string
  businessProfileId: string
  reason: BusinessProfileReportReason
  details: string
}): Promise<BusinessProfileReportRow> {
  const payload: BusinessProfileReportInsert = {
    reporter_user_id: reporterUserId,
    business_profile_id: businessProfileId,
    reason,
    details: normalizeDetails(details),
    status: 'pending',
  }

  const { data, error } = await supabase
    .from('business_profile_reports')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data as BusinessProfileReportRow
}
