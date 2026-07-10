import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { enableBusinessOwnerMode, getAccountMode, setPreferredAccountMode } from '../lib/accountModeService.ts'
import type { AccountModeState, PreferredAccountMode } from '../types/accountMode.ts'

interface AuthContextValue {
  user: User | null
  session: Session | null
  isLoading: boolean
  accountMode: PreferredAccountMode
  isBusinessOwnerEnabled: boolean
  setPreferredAccountMode: (mode: PreferredAccountMode) => Promise<void>
  enableBusinessOwner: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const defaultAccountMode: AccountModeState = {
  ownerEnabled: false,
  preferredMode: 'customer',
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [accountModeState, setAccountModeState] = useState<AccountModeState>(defaultAccountMode)

  useEffect(() => {
    let isMounted = true
    let hydrationRequest = 0

    const hydrateSession = async (nextSession: Session | null) => {
      const requestId = ++hydrationRequest
      if (!isMounted) return

      setSession(nextSession)

      if (!nextSession) {
        setAccountModeState(defaultAccountMode)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const nextAccountMode = await getAccountMode(nextSession.user.id)
        if (!isMounted || requestId !== hydrationRequest) return
        setAccountModeState(nextAccountMode)
      } catch (error) {
        console.error('Failed to restore account mode:', error)
        if (!isMounted || requestId !== hydrationRequest) return
        setAccountModeState(defaultAccountMode)
      } finally {
        if (isMounted && requestId === hydrationRequest) {
          setIsLoading(false)
        }
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      void hydrateSession(data.session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      // Defer the database read until the auth callback has returned.
      setTimeout(() => {
        void hydrateSession(newSession)
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
        accountMode: accountModeState.preferredMode,
        isBusinessOwnerEnabled: accountModeState.ownerEnabled,
        setPreferredAccountMode: persistPreferredAccountMode,
        enableBusinessOwner,
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
