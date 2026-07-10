export type PreferredAccountMode = 'customer' | 'business_owner'

export interface AccountModeState {
  ownerEnabled: boolean
  preferredMode: PreferredAccountMode
}
