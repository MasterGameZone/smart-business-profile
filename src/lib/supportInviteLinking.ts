import {
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
