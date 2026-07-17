import { markSupportInviteOpened } from './customerBusinessSupportService.ts'

const SUPPORT_INVITE_TOKEN_STORAGE_KEY = 'smart-business-profile:support-invite-token'
const SUPPORT_INVITE_OPEN_TRACKED_STORAGE_PREFIX = 'smart-business-profile:support-invite-open-tracked:'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidSupportInviteToken(value: string | null | undefined): value is string {
  return Boolean(value && UUID_PATTERN.test(value))
}

export function storeSupportInviteToken(token: string): void {
  if (!isValidSupportInviteToken(token) || typeof window === 'undefined') return
  window.localStorage.setItem(SUPPORT_INVITE_TOKEN_STORAGE_KEY, token)
}

export function trackSupportInviteOpen(token: string): void {
  if (!isValidSupportInviteToken(token)) return

  if (typeof window !== 'undefined') {
    const trackedStorageKey = `${SUPPORT_INVITE_OPEN_TRACKED_STORAGE_PREFIX}${token}`
    try {
      if (window.sessionStorage.getItem(trackedStorageKey) === 'true') return
      window.sessionStorage.setItem(trackedStorageKey, 'true')
    } catch {
      // Continue without dedupe if session storage is unavailable.
    }
  }

  void markSupportInviteOpened(token)
}

export function getStoredSupportInviteToken(): string | null {
  if (typeof window === 'undefined') return null

  const token = window.localStorage.getItem(SUPPORT_INVITE_TOKEN_STORAGE_KEY)
  if (!isValidSupportInviteToken(token)) {
    window.localStorage.removeItem(SUPPORT_INVITE_TOKEN_STORAGE_KEY)
    return null
  }

  return token
}

export function clearStoredSupportInviteToken(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(SUPPORT_INVITE_TOKEN_STORAGE_KEY)
}

export function captureSupportInviteTokenFromSearch(search: string): string | null {
  const token = new URLSearchParams(search).get('supportInvite')
  if (!isValidSupportInviteToken(token)) return null

  storeSupportInviteToken(token)
  trackSupportInviteOpen(token)
  return token
}
