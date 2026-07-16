import { supabase } from './supabase.ts'

export interface BusinessProfileInsight {
  insight_type: string
  title: string
  description: string
  highlight: string | null
  trend: string
  value: number
  percentage: number
}

interface BusinessProfileInsightRpcRow {
  insight_type?: unknown
  title?: unknown
  description?: unknown
  highlight?: unknown
  trend?: unknown
  value?: unknown
  percentage?: unknown
}

function toFiniteNumber(value: unknown): number {
  const numberValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numberValue) ? numberValue : 0
}

export async function getBusinessProfileInsights(profileId: string): Promise<BusinessProfileInsight[]> {
  if (!profileId) return []

  try {
    const { data, error } = await supabase.rpc('get_business_profile_insights', {
      target_profile_id: profileId,
    })

    if (error) {
      console.warn('Failed to load business profile insights.', error)
      return []
    }

    if (!Array.isArray(data)) {
      return []
    }

    return data.map((row: BusinessProfileInsightRpcRow) => ({
      insight_type: String(row.insight_type ?? ''),
      title: String(row.title ?? ''),
      description: String(row.description ?? ''),
      highlight: typeof row.highlight === 'string' ? row.highlight : null,
      trend: String(row.trend ?? 'neutral'),
      value: toFiniteNumber(row.value),
      percentage: toFiniteNumber(row.percentage),
    }))
  } catch (error) {
    console.warn('Failed to load business profile insights.', error)
    return []
  }
}
