import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from './supabase.ts'
import type {
  FavoriteBusinessInsert,
  FavoriteBusinessRow,
  FavoriteBusinessWithProfileRow,
} from '../types/favoriteBusiness.ts'
import type { PublicBusinessProfileRow } from '../types/businessProfile.ts'

function isDuplicateFavoriteError(error: PostgrestError | null): boolean {
  return error?.code === '23505'
}

export async function getBusinessProfileSavesCount(profileId: string): Promise<number> {
  if (!profileId) {
    return 0
  }

  try {
    const { data, error } = await supabase.rpc('get_business_profile_saves_count', {
      target_profile_id: profileId,
    })

    if (error) {
      console.warn('Failed to load business profile saves count.', error)
      return 0
    }

    const count = typeof data === 'number' ? data : Number(data)
    return Number.isFinite(count) ? count : 0
  } catch (error) {
    console.warn('Failed to load business profile saves count.', error)
    return 0
  }
}

export async function getFavoriteBusiness(
  userId: string,
  businessProfileId: string
): Promise<FavoriteBusinessRow | null> {
  const { data, error } = await supabase
    .from('favorite_businesses')
    .select('*')
    .eq('user_id', userId)
    .eq('business_profile_id', businessProfileId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ?? null
}

export async function saveFavoriteBusiness(
  userId: string,
  businessProfileId: string
): Promise<FavoriteBusinessRow> {
  const existingFavorite = await getFavoriteBusiness(userId, businessProfileId)
  if (existingFavorite) {
    return existingFavorite
  }

  const payload: FavoriteBusinessInsert = {
    user_id: userId,
    business_profile_id: businessProfileId,
  }

  const { data, error } = await supabase
    .from('favorite_businesses')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    if (isDuplicateFavoriteError(error)) {
      const duplicateFavorite = await getFavoriteBusiness(userId, businessProfileId)
      if (duplicateFavorite) {
        return duplicateFavorite
      }
    }

    throw error
  }

  return data
}

export async function removeFavoriteBusiness(
  userId: string,
  businessProfileId: string
): Promise<void> {
  const { error } = await supabase
    .from('favorite_businesses')
    .delete()
    .eq('user_id', userId)
    .eq('business_profile_id', businessProfileId)

  if (error) {
    throw error
  }
}

export async function getFavoriteBusinessesByUser(
  userId: string
): Promise<FavoriteBusinessWithProfileRow[]> {
  const { data, error } = await supabase
    .from('favorite_businesses')
    .select(
      `
        id,
        user_id,
        business_profile_id,
        created_at,
        business_profile:business_profiles!inner(
          id,
          business_name,
          owner_name,
          business_category,
          address,
          about_business,
          logo_url,
          slug,
          owner_id,
          created_at,
          updated_at
        )
      `
    )
    .eq('user_id', userId)
    .eq('business_profile.is_public', true)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  const favorites = (data ?? []) as Array<
    FavoriteBusinessRow & {
      business_profile: PublicBusinessProfileRow | PublicBusinessProfileRow[] | null
    }
  >

  return favorites.flatMap((favorite) => {
    const businessProfile = Array.isArray(favorite.business_profile)
      ? favorite.business_profile[0] ?? null
      : favorite.business_profile

    if (!businessProfile) {
      return []
    }

    return [
      {
        ...favorite,
        business_profile: businessProfile,
      },
    ]
  })
}
