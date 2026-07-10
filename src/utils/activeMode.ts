/**
 * Legacy compatibility helpers. Account mode is now restored and persisted by AuthContext via Supabase.
 */
export type ActiveMode = 'customer' | 'business'

export function getActiveMode(): ActiveMode {
  return 'customer'
}

export function setActiveMode(_mode: ActiveMode): void {
  void _mode
}
