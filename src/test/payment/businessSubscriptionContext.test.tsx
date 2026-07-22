import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createDeferred,
  fakeActiveProSubscription,
  fakeFreeSubscription,
  fakeRazorpayIdentifiers,
} from '../fixtures/razorpay.ts'
import type { BusinessSubscription } from '../../types/businessSubscription.ts'

const mocks = vi.hoisted(() => ({
  getMyBusinessSubscription: vi.fn(),
  reconcileRazorpaySubscription: vi.fn(),
  useAuth: vi.fn(),
}))

vi.mock('../../context/AuthContext.tsx', () => ({ useAuth: mocks.useAuth }))
vi.mock('../../lib/businessSubscriptionService.ts', () => ({
  getMyBusinessSubscription: mocks.getMyBusinessSubscription,
  reconcileRazorpaySubscription: mocks.reconcileRazorpaySubscription,
}))

const { BusinessSubscriptionProvider, useBusinessSubscription } = await import(
  '../../context/BusinessSubscriptionContext.tsx'
)

const owner = { id: fakeRazorpayIdentifiers.ownerId, email: 'owner@example.test', user_metadata: {} } as User

function setAuth(user: User | null = owner, accountMode: 'business_owner' | 'customer' = 'business_owner', isLoading = false) {
  mocks.useAuth.mockReturnValue({
    user,
    isLoading,
    accountMode,
  })
}

function SubscriptionProbe() {
  const subscriptionContext = useBusinessSubscription()

  return (
    <div>
      <span data-testid="plan">{subscriptionContext.subscription.planId}</span>
      <span data-testid="status">{subscriptionContext.subscription.status}</span>
      <span data-testid="owner-access">{String(subscriptionContext.hasProAccess)}</span>
      <span data-testid="loading">{String(subscriptionContext.isLoading)}</span>
      <span data-testid="refreshing">{String(subscriptionContext.isRefreshing)}</span>
      <span data-testid="reconciling">{String(subscriptionContext.isReconciliationInFlight)}</span>
      <span data-testid="error">{subscriptionContext.error?.message ?? ''}</span>
      <button type="button" onClick={() => void subscriptionContext.refreshBusinessSubscription()}>
        Refresh
      </button>
      <button
        type="button"
        onClick={() => {
          void subscriptionContext.reconcileBusinessSubscription().catch(() => undefined)
        }}
      >
        Reconcile
      </button>
    </div>
  )
}

function renderProvider() {
  return render(
    <BusinessSubscriptionProvider>
      <SubscriptionProbe />
    </BusinessSubscriptionProvider>,
  )
}

describe('BusinessSubscriptionProvider frontend contract', () => {
  beforeEach(() => {
    setAuth()
    mocks.getMyBusinessSubscription.mockReset()
    mocks.reconcileRazorpaySubscription.mockReset()
    mocks.reconcileRazorpaySubscription.mockResolvedValue({
      result: 'reconciled',
      status: 'active',
      hasPaidPeriod: true,
    })
  })

  it('loads the current business-owner subscription and derives access from it', async () => {
    mocks.getMyBusinessSubscription.mockResolvedValueOnce(fakeActiveProSubscription)
    renderProvider()

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('active'))
    expect(screen.getByTestId('plan')).toHaveTextContent('pro_analytics')
    expect(screen.getByTestId('owner-access')).toHaveTextContent('true')
    expect(screen.getByTestId('loading')).toHaveTextContent('false')
  })

  it('starts and remains fail closed while the initial owner load is pending', async () => {
    const deferred = createDeferred<BusinessSubscription>()
    mocks.getMyBusinessSubscription.mockReturnValueOnce(deferred.promise)
    renderProvider()

    expect(screen.getByTestId('owner-access')).toHaveTextContent('false')
    expect(screen.getByTestId('plan')).toHaveTextContent('free')
    expect(screen.getByTestId('loading')).toHaveTextContent('true')

    await act(async () => {
      deferred.resolve(fakeActiveProSubscription)
      await deferred.promise
    })
    await waitFor(() => expect(screen.getByTestId('owner-access')).toHaveTextContent('true'))
  })

  it('returns Free without loading a subscription when no business owner is active', async () => {
    setAuth(null)
    renderProvider()

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    expect(screen.getByTestId('plan')).toHaveTextContent('free')
    expect(screen.getByTestId('owner-access')).toHaveTextContent('false')
    expect(mocks.getMyBusinessSubscription).not.toHaveBeenCalled()
  })

  it('fails closed and stores a safe error when initial loading fails', async () => {
    mocks.getMyBusinessSubscription.mockRejectedValueOnce(new Error('safe subscription failure'))
    renderProvider()

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    expect(screen.getByTestId('plan')).toHaveTextContent('free')
    expect(screen.getByTestId('owner-access')).toHaveTextContent('false')
    expect(screen.getByTestId('error')).toHaveTextContent('safe subscription failure')
  })

  it('resets visible access before a refresh and applies the refreshed owner state', async () => {
    mocks.getMyBusinessSubscription
      .mockResolvedValueOnce(fakeActiveProSubscription)
      .mockResolvedValueOnce(fakeFreeSubscription)
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('owner-access')).toHaveTextContent('true'))

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(screen.getByTestId('owner-access')).toHaveTextContent('false')
    expect(screen.getByTestId('refreshing')).toHaveTextContent('true')
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('free'))
    expect(screen.getByTestId('owner-access')).toHaveTextContent('false')
  })

  it('returns Free after a failed refresh instead of retaining stale Pro access', async () => {
    mocks.getMyBusinessSubscription
      .mockResolvedValueOnce(fakeActiveProSubscription)
      .mockRejectedValueOnce(new Error('refresh failed safely'))
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('owner-access')).toHaveTextContent('true'))

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(screen.getByTestId('refreshing')).toHaveTextContent('false'))
    expect(screen.getByTestId('owner-access')).toHaveTextContent('false')
    expect(screen.getByTestId('error')).toHaveTextContent('refresh failed safely')
  })

  it('ignores a late response belonging to a previous owner', async () => {
    const firstOwnerLoad = createDeferred<BusinessSubscription>()
    const secondOwnerLoad = createDeferred<BusinessSubscription>()
    const secondOwner = { ...owner, id: '55555555-5555-4555-8555-555555555555' } as User
    mocks.getMyBusinessSubscription
      .mockReturnValueOnce(firstOwnerLoad.promise)
      .mockReturnValueOnce(secondOwnerLoad.promise)
    const view = renderProvider()

    await waitFor(() => expect(mocks.getMyBusinessSubscription).toHaveBeenCalledTimes(1))
    setAuth(secondOwner)
    view.rerender(
      <BusinessSubscriptionProvider>
        <SubscriptionProbe />
      </BusinessSubscriptionProvider>,
    )
    await waitFor(() => expect(mocks.getMyBusinessSubscription).toHaveBeenCalledTimes(2))

    expect(screen.getByTestId('plan')).toHaveTextContent('free')
    await act(async () => {
      secondOwnerLoad.resolve(fakeActiveProSubscription)
      await secondOwnerLoad.promise
    })
    await waitFor(() => expect(screen.getByTestId('owner-access')).toHaveTextContent('true'))

    await act(async () => {
      firstOwnerLoad.resolve(fakeActiveProSubscription)
      await firstOwnerLoad.promise
    })
    expect(screen.getByTestId('owner-access')).toHaveTextContent('true')
    expect(screen.getByTestId('status')).toHaveTextContent('active')
  })

  it('shares concurrent reconciliation calls and refreshes after one result', async () => {
    const reconciliation = createDeferred<{
      result: 'reconciled'
      status: 'active'
      hasPaidPeriod: boolean
    }>()
    mocks.getMyBusinessSubscription
      .mockResolvedValueOnce(fakeFreeSubscription)
      .mockResolvedValueOnce(fakeActiveProSubscription)
    mocks.reconcileRazorpaySubscription.mockReturnValueOnce(reconciliation.promise)
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))

    fireEvent.click(screen.getByRole('button', { name: 'Reconcile' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reconcile' }))
    expect(mocks.reconcileRazorpaySubscription).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('reconciling')).toHaveTextContent('true')

    await act(async () => {
      reconciliation.resolve({ result: 'reconciled', status: 'active', hasPaidPeriod: true })
      await reconciliation.promise
    })
    await waitFor(() => expect(screen.getByTestId('owner-access')).toHaveTextContent('true'))
    expect(screen.getByTestId('reconciling')).toHaveTextContent('false')
    expect(mocks.getMyBusinessSubscription).toHaveBeenCalledTimes(2)
  })

  it('clears reconciliation state after a failed reconciliation', async () => {
    mocks.getMyBusinessSubscription.mockResolvedValueOnce(fakeFreeSubscription)
    mocks.reconcileRazorpaySubscription.mockRejectedValueOnce(new Error('reconciliation failed safely'))
    renderProvider()
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))

    await expect(
      act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Reconcile' }))
        await waitFor(() => expect(screen.getByTestId('reconciling')).toHaveTextContent('false'))
      }),
    ).resolves.toBeUndefined()
    expect(screen.getByTestId('owner-access')).toHaveTextContent('false')
    expect(mocks.getMyBusinessSubscription).toHaveBeenCalledTimes(1)
  })

  it('resets entitlement when logout or customer mode becomes visible', async () => {
    mocks.getMyBusinessSubscription.mockResolvedValueOnce(fakeActiveProSubscription)
    const view = renderProvider()
    await waitFor(() => expect(screen.getByTestId('owner-access')).toHaveTextContent('true'))

    setAuth(null, 'customer')
    view.rerender(
      <BusinessSubscriptionProvider>
        <SubscriptionProbe />
      </BusinessSubscriptionProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('owner-access')).toHaveTextContent('false'))
    expect(screen.getByTestId('plan')).toHaveTextContent('free')
  })
})
