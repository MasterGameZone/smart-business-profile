import type { PublicBusinessProfileRow } from './businessProfile.ts'

export interface FavoriteBusinessRow {
  id: string
  user_id: string
  business_profile_id: string
  created_at: string
}

export interface FavoriteBusinessInsert {
  id?: string
  user_id: string
  business_profile_id: string
  created_at?: string
}

export interface FavoriteBusinessWithProfileRow extends FavoriteBusinessRow {
  business_profile: PublicBusinessProfileRow
}
