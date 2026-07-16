export interface BusinessProfileFollowerRow {
  id: string
  profile_id: string
  user_id: string
  created_at: string
}

export interface BusinessProfileFollowerInsert {
  id?: string
  profile_id: string
  user_id: string
  created_at?: string
}

export interface BusinessProfileFollowSummary {
  followersCount: number
  isFollowing: boolean
}
