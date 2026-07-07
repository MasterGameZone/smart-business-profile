import type { PublicBusinessProfileRow } from '../types/businessProfile'

function normalizeValue(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase()
}

function getSearchPriority(profile: PublicBusinessProfileRow, normalizedQuery: string): number | null {
  const businessName = normalizeValue(profile.business_name)
  const category = normalizeValue(profile.business_category)
  const address = normalizeValue(profile.address)
  const ownerName = normalizeValue(profile.owner_name)
  const aboutBusiness = normalizeValue(profile.about_business)

  if (businessName === normalizedQuery) return 1
  if (businessName.startsWith(normalizedQuery)) return 2
  if (businessName.includes(normalizedQuery)) return 3
  if (category.startsWith(normalizedQuery)) return 4
  if (category.includes(normalizedQuery)) return 5
  if (address.startsWith(normalizedQuery)) return 6
  if (address.includes(normalizedQuery)) return 7
  if (ownerName.startsWith(normalizedQuery)) return 8
  if (ownerName.includes(normalizedQuery)) return 9
  if (aboutBusiness.includes(normalizedQuery)) return 10

  return null
}

export function getRankedBusinessSearchResults(
  profiles: PublicBusinessProfileRow[],
  query: string
): PublicBusinessProfileRow[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return profiles

  return profiles
    .map((profile, index) => ({
      profile,
      index,
      priority: getSearchPriority(profile, normalizedQuery),
    }))
    .filter(
      (
        item
      ): item is {
        profile: PublicBusinessProfileRow
        index: number
        priority: number
      } => item.priority !== null
    )
    .sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority
      }

      return left.index - right.index
    })
    .map((item) => item.profile)
}
