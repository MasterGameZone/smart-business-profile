export const ACTIVE_MODE_STORAGE_KEY = 'smart-business-profile:active-mode'

export type ActiveMode = 'customer' | 'business'

export function getActiveMode(): ActiveMode {
  if (typeof window === 'undefined') {
    return 'customer'
  }

  return window.localStorage.getItem(ACTIVE_MODE_STORAGE_KEY) === 'business' ? 'business' : 'customer'
}

export function setActiveMode(mode: ActiveMode): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(ACTIVE_MODE_STORAGE_KEY, mode)
}
