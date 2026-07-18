import {
  markCurrentUserSupportInviteBusinessOwnerSwitched,
  markSupportInviteBusinessOwnerSwitched,
  markSupportInviteBusinessSignedUp,
  markSupportInviteProfilePublished,
} from './customerBusinessSupportService.ts'
import {
  clearStoredSupportInviteToken,
  getStoredSupportInviteToken,
} from './supportInviteStorage.ts'

export async function markStoredSupportInviteBusinessSignedUp(): Promise<void> {
  const invitationToken = getStoredSupportInviteToken()
  if (!invitationToken) return

  await markSupportInviteBusinessSignedUp(invitationToken)
}

export async function markStoredSupportInviteBusinessOwnerSwitched(): Promise<void> {
  const invitationToken = getStoredSupportInviteToken()

  if (invitationToken) {
    const didMarkWithToken = await markSupportInviteBusinessOwnerSwitched(invitationToken)
    if (didMarkWithToken) return

    if (import.meta.env.DEV) {
      console.warn('Support invite token switch tracking returned false. Trying authenticated fallback.')
    }
  } else if (import.meta.env.DEV) {
    console.warn('Support invite token missing during Business Owner switch. Trying authenticated fallback.')
  }

  const didMarkWithFallback = await markCurrentUserSupportInviteBusinessOwnerSwitched()
  if (!didMarkWithFallback && import.meta.env.DEV) {
    console.warn('No eligible claimed support invite was found for Business Owner switch tracking.')
  }
}

export async function linkStoredSupportInviteToPublishedProfile({
  profileId,
  isPublic,
}: {
  profileId: string
  isPublic: boolean | null | undefined
}): Promise<void> {
  if (!isPublic) return

  const invitationToken = getStoredSupportInviteToken()
  if (!invitationToken) return

  try {
    await markSupportInviteProfilePublished(invitationToken, profileId)
    clearStoredSupportInviteToken()
  } catch {
    console.warn('Support invite linking failed after published profile save.')
  }
}
