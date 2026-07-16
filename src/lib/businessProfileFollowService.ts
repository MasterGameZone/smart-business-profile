import type { PostgrestError } from '@supabase/supabase-js'

import { supabase } from './supabase.ts'
import type {
  BusinessProfileFollowerInsert,
  BusinessProfileFollowerRow,
  BusinessProfileFollowSummary,
} from '../types/businessProfileFollow.ts'

function isDuplicateFollowError(error: PostgrestError | null): boolean {
  return error?.code === '23505'
}

export async function getBusinessProfileFollowersCount(profileId: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_business_profile_followers_count', {
    target_profile_id: profileId,
  })

  if (error) {
    throw error
  }

  return typeof data === 'number' ? data : 0
}

export async function getBusinessProfileFollow(
  profileId: string,
  userId: string
): Promise<BusinessProfileFollowerRow | null> {
  const { data, error } = await supabase
    .from('business_profile_followers')
    .select('*')
    .eq('profile_id', profileId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ?? null
}

export async function getBusinessProfileFollowSummary(
  profileId: string,
  userId?: string | null
): Promise<BusinessProfileFollowSummary> {
  const followersCount = await getBusinessProfileFollowersCount(profileId)

  if (!userId) {
    return {
      followersCount,
      isFollowing: false,
    }
  }

  const follow = await getBusinessProfileFollow(profileId, userId)

  return {
    followersCount,
    isFollowing: Boolean(follow),
  }
}

export async function followBusinessProfile(
  profileId: string,
  userId: string
): Promise<BusinessProfileFollowerRow> {
  const payload: BusinessProfileFollowerInsert = {
    profile_id: profileId,
    user_id: userId,
  }

  const { data, error } = await supabase
    .from('business_profile_followers')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    if (isDuplicateFollowError(error)) {
      const existingFollow = await getBusinessProfileFollow(profileId, userId)
      if (existingFollow) {
        return existingFollow
      }
    }

    throw error
  }

  return data
}

export async function unfollowBusinessProfile(profileId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('business_profile_followers')
    .delete()
    .eq('profile_id', profileId)
    .eq('user_id', userId)

  if (error) {
    throw error
  }
}

export async function toggleBusinessProfileFollow(
  profileId: string,
  userId: string,
  currentlyFollowing: boolean
): Promise<BusinessProfileFollowSummary> {
  if (currentlyFollowing) {
    await unfollowBusinessProfile(profileId, userId)
  } else {
    await followBusinessProfile(profileId, userId)
  }

  return getBusinessProfileFollowSummary(profileId, userId)
}
