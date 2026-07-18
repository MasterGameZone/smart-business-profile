import { supabase } from './supabase.ts'
import { markStoredSupportInviteBusinessOwnerSwitched } from './supportInviteLinking.ts'
import type { AccountModeState, PreferredAccountMode } from '../types/accountMode.ts'

interface AccountModeRow {
  owner_enabled: boolean
  preferred_account_mode: PreferredAccountMode
}

const defaultAccountMode: AccountModeState = {
  ownerEnabled: false,
  preferredMode: 'customer',
}

function normalizeAccountMode(row: AccountModeRow | null): AccountModeState {
  if (!row) return defaultAccountMode

  const ownerEnabled = row.owner_enabled === true
  const preferredMode = ownerEnabled && row.preferred_account_mode === 'business_owner' ? 'business_owner' : 'customer'

  return { ownerEnabled, preferredMode }
}

export async function getAccountMode(userId: string): Promise<AccountModeState> {
  const { data, error } = await supabase
    .from('user_account_preferences')
    .select('owner_enabled, preferred_account_mode')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return normalizeAccountMode(data as AccountModeRow | null)
}

export async function enableBusinessOwnerMode(userId: string): Promise<AccountModeState> {
  const { data, error } = await supabase
    .from('user_account_preferences')
    .upsert(
      {
        user_id: userId,
        owner_enabled: true,
        preferred_account_mode: 'business_owner',
      },
      { onConflict: 'user_id' }
    )
    .select('owner_enabled, preferred_account_mode')
    .single()

  if (error) throw error
  const nextAccountMode = normalizeAccountMode(data as AccountModeRow)
  if (nextAccountMode.preferredMode === 'business_owner') {
    void markStoredSupportInviteBusinessOwnerSwitched()
  }
  return nextAccountMode
}

export async function setPreferredAccountMode(
  userId: string,
  preferredMode: PreferredAccountMode
): Promise<AccountModeState> {
  if (preferredMode === 'business_owner') {
    return enableBusinessOwnerMode(userId)
  }

  const { data, error } = await supabase
    .from('user_account_preferences')
    .upsert(
      {
        user_id: userId,
        preferred_account_mode: 'customer',
      },
      { onConflict: 'user_id' }
    )
    .select('owner_enabled, preferred_account_mode')
    .single()

  if (error) throw error
  return normalizeAccountMode(data as AccountModeRow)
}
