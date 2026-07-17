import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { enableBusinessOwnerMode, getAccountMode, setPreferredAccountMode } from '../lib/accountModeService.ts'
import type { AccountModeState, PreferredAccountMode } from '../types/accountMode.ts'

interface AuthContextValue {
  user: User | null
  session: Session | null
  isLoading: boolean
  isLoggingOut: boolean
  accountMode: PreferredAccountMode
  isBusinessOwnerEnabled: boolean
  setPreferredAccountMode: (mode: PreferredAccountMode) => Promise<void>
  enableBusinessOwner: () => Promise<void>
  setLogoutInProgress: (value: boolean) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const defaultAccountMode: AccountModeState = {
  ownerEnabled: false,
  preferredMode: 'customer',
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [accountModeState, setAccountModeState] = useState<AccountModeState>(defaultAccountMode)
  const loadedAccountModeUserIdRef = useRef<string | null>(null)
  const loadingAccountModeRef = useRef<{
    userId: string
    promise: Promise<AccountModeState>
  } | null>(null)
  const currentUserIdRef = useRef<string | null>(null)
  const authRequestIdRef = useRef(0)
  const initialHydrationCompleteRef = useRef(false)

  useEffect(() => {
    let isMounted = true

    const clearSession = () => {
      authRequestIdRef.current += 1
      currentUserIdRef.current = null
      loadedAccountModeUserIdRef.current = null
      loadingAccountModeRef.current = null
      setSession(null)
      setAccountModeState(defaultAccountMode)
      initialHydrationCompleteRef.current = true
      setIsLoading(false)
    }

    const hydrateSession = async (nextSession: Session | null) => {
      if (!isMounted) return

      if (!nextSession) {
        clearSession()
        return
      }

      const userId = nextSession.user.id
      if (loadedAccountModeUserIdRef.current === userId) {
        currentUserIdRef.current = userId
        setSession(nextSession)
        return
      }

      if (loadingAccountModeRef.current?.userId === userId) {
        return
      }

      currentUserIdRef.current = userId
      const requestId = ++authRequestIdRef.current
      const blocksRoute = !initialHydrationCompleteRef.current
      if (blocksRoute) {
        setIsLoading(true)
      }

      const accountModePromise = getAccountMode(userId)
      loadingAccountModeRef.current = {
        userId,
        promise: accountModePromise,
      }

      try {
        const nextAccountMode = await accountModePromise
        if (
          !isMounted ||
          requestId !== authRequestIdRef.current ||
          currentUserIdRef.current !== userId
        ) {
          return
        }

        loadedAccountModeUserIdRef.current = userId
        setSession(nextSession)
        setAccountModeState(nextAccountMode)
      } catch (error) {
        console.error('Failed to restore account mode:', error)
        if (
          !isMounted ||
          requestId !== authRequestIdRef.current ||
          currentUserIdRef.current !== userId
        ) {
          return
        }

        setSession(nextSession)
        setAccountModeState(defaultAccountMode)
      } finally {
        if (loadingAccountModeRef.current?.promise === accountModePromise) {
          loadingAccountModeRef.current = null
        }

        if (isMounted && requestId === authRequestIdRef.current) {
          initialHydrationCompleteRef.current = true
          if (blocksRoute) {
            setIsLoading(false)
          }
        }
      }
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, newSession) => {
      // INITIAL_SESSION is the single source for initial auth hydration.
      setTimeout(() => {
        void hydrateSession(event === 'SIGNED_OUT' ? null : newSession)
      }, 0)
    })

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const persistPreferredAccountMode = async (preferredMode: PreferredAccountMode) => {
    if (!session?.user) {
      throw new Error('You must be signed in to change account mode.')
    }

    const nextAccountMode = await setPreferredAccountMode(session.user.id, preferredMode)
    setAccountModeState(nextAccountMode)
  }

  const enableBusinessOwner = async () => {
    if (!session?.user) {
      throw new Error('You must be signed in to enable Business Owner mode.')
    }

    const nextAccountMode = await enableBusinessOwnerMode(session.user.id)
    setAccountModeState(nextAccountMode)
  }

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        isLoading,
        isLoggingOut,
        accountMode: accountModeState.preferredMode,
        isBusinessOwnerEnabled: accountModeState.ownerEnabled,
        setPreferredAccountMode: persistPreferredAccountMode,
        enableBusinessOwner,
        setLogoutInProgress: setIsLoggingOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
