import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext.tsx'
import { getMyBusinessSubscription } from '../lib/businessSubscriptionService.ts'
import { canUseFeature } from '../lib/businessEntitlements.ts'
import {
  FREE_BUSINESS_SUBSCRIPTION,
  type BusinessSubscription,
} from '../types/businessSubscription.ts'

interface BusinessSubscriptionContextValue {
  subscription: BusinessSubscription
  hasProAccess: boolean
  isLoading: boolean
  isRefreshing: boolean
  error: Error | null
  refreshBusinessSubscription: () => Promise<void>
}

const BusinessSubscriptionContext = createContext<BusinessSubscriptionContextValue | null>(null)

export function BusinessSubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isAuthLoading, accountMode } = useAuth()
  const [subscription, setSubscription] = useState<BusinessSubscription>(FREE_BUSINESS_SUBSCRIPTION)
  const [subscriptionOwnerId, setSubscriptionOwnerId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const requestIdRef = useRef(0)
  const activeOwnerIdRef = useRef<string | null>(null)

  const businessOwnerId = !isAuthLoading && user && accountMode === 'business_owner' ? user.id : null

  useEffect(() => {
    const requestId = ++requestIdRef.current
    let isActive = true

    if (isAuthLoading) {
      activeOwnerIdRef.current = null
      setSubscription(FREE_BUSINESS_SUBSCRIPTION)
      setSubscriptionOwnerId(null)
      setError(null)
      setIsLoading(true)
      setIsRefreshing(false)
      return () => {
        isActive = false
      }
    }

    if (!businessOwnerId) {
      activeOwnerIdRef.current = null
      setSubscription(FREE_BUSINESS_SUBSCRIPTION)
      setSubscriptionOwnerId(null)
      setError(null)
      setIsLoading(false)
      setIsRefreshing(false)
      return () => {
        isActive = false
      }
    }

    activeOwnerIdRef.current = businessOwnerId
    setSubscription(FREE_BUSINESS_SUBSCRIPTION)
    setSubscriptionOwnerId(null)
    setError(null)
    setIsLoading(true)
    setIsRefreshing(false)

    void (async () => {
      try {
        const nextSubscription = await getMyBusinessSubscription()
        if (!isActive || requestId !== requestIdRef.current || activeOwnerIdRef.current !== businessOwnerId) {
          return
        }

        setSubscription(nextSubscription)
        setSubscriptionOwnerId(businessOwnerId)
      } catch (nextError) {
        if (!isActive || requestId !== requestIdRef.current || activeOwnerIdRef.current !== businessOwnerId) {
          return
        }

        console.warn('Unable to load business subscription access.')
        setSubscription(FREE_BUSINESS_SUBSCRIPTION)
        setSubscriptionOwnerId(businessOwnerId)
        setError(nextError instanceof Error ? nextError : new Error('Unable to load subscription access.'))
      } finally {
        if (isActive && requestId === requestIdRef.current && activeOwnerIdRef.current === businessOwnerId) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      isActive = false
    }
  }, [businessOwnerId, isAuthLoading])

  const refreshBusinessSubscription = useCallback(async () => {
    const requestId = ++requestIdRef.current
    const ownerId = businessOwnerId

    if (!ownerId) {
      activeOwnerIdRef.current = null
      setSubscription(FREE_BUSINESS_SUBSCRIPTION)
      setSubscriptionOwnerId(null)
      setError(null)
      setIsLoading(isAuthLoading)
      setIsRefreshing(false)
      return
    }

    activeOwnerIdRef.current = ownerId
    setSubscription(FREE_BUSINESS_SUBSCRIPTION)
    setSubscriptionOwnerId(null)
    setError(null)
    setIsLoading(true)
    setIsRefreshing(true)

    try {
      const nextSubscription = await getMyBusinessSubscription()
      if (requestId !== requestIdRef.current || activeOwnerIdRef.current !== ownerId) {
        return
      }

      setSubscription(nextSubscription)
      setSubscriptionOwnerId(ownerId)
    } catch (nextError) {
      if (requestId !== requestIdRef.current || activeOwnerIdRef.current !== ownerId) {
        return
      }

      console.warn('Unable to refresh business subscription access.')
      setSubscription(FREE_BUSINESS_SUBSCRIPTION)
      setSubscriptionOwnerId(ownerId)
      setError(nextError instanceof Error ? nextError : new Error('Unable to refresh subscription access.'))
    } finally {
      if (requestId === requestIdRef.current && activeOwnerIdRef.current === ownerId) {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    }
  }, [businessOwnerId, isAuthLoading])

  const isCurrentOwnerSubscription = Boolean(businessOwnerId && subscriptionOwnerId === businessOwnerId)
  const visibleSubscription = isCurrentOwnerSubscription ? subscription : FREE_BUSINESS_SUBSCRIPTION
  const subscriptionIsLoading = isAuthLoading || Boolean(businessOwnerId && (!isCurrentOwnerSubscription || isLoading))
  const hasProAccess = !subscriptionIsLoading && canUseFeature(visibleSubscription, 'full_analytics')

  const value = useMemo<BusinessSubscriptionContextValue>(
    () => ({
      subscription: visibleSubscription,
      hasProAccess,
      isLoading: subscriptionIsLoading,
      isRefreshing,
      error,
      refreshBusinessSubscription,
    }),
    [error, hasProAccess, isRefreshing, refreshBusinessSubscription, subscriptionIsLoading, visibleSubscription]
  )

  return <BusinessSubscriptionContext.Provider value={value}>{children}</BusinessSubscriptionContext.Provider>
}

export function useBusinessSubscription(): BusinessSubscriptionContextValue {
  const context = useContext(BusinessSubscriptionContext)
  if (!context) {
    throw new Error('useBusinessSubscription must be used within a BusinessSubscriptionProvider')
  }

  return context
}
