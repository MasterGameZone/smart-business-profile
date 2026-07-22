import { MemoryRouter } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createDeferred,
  fakeActiveProSubscription,
  fakeCanceledProSubscription,
  fakeFreeSubscription,
  fakeIncompleteSubscription,
  fakePastDueSubscription,
  fakeRazorpayCheckoutSuccess,
  fakeRazorpayIdentifiers,
} from '../fixtures/razorpay.ts'
import { installMockRazorpayCheckout } from '../mocks/razorpayCheckout.ts'
import type { BusinessSubscription } from '../../types/businessSubscription.ts'

const mocks = vi.hoisted(() => {
  const safeMessages: Record<string, string> = {
    business_owner_not_eligible: 'Create a business profile before subscribing.',
    creation_in_progress: 'A subscription request is already being processed.',
    subscription_already_authorized: 'Payment authorization was received. Subscription activation is being confirmed.',
    subscription_reconciliation_required: 'We are checking a previous subscription request. Please wait before trying again.',
    subscription_outcome_unknown: 'We are checking a previous subscription request. Please wait before trying again.',
    provider_temporarily_unavailable: 'Razorpay is temporarily unavailable. Please try again later.',
    invalid_checkout_signature: 'Payment verification failed. No subscription access was granted.',
    existing_subscription: 'A subscription already exists for this account.',
    existing_subscription_payment_issue: 'Your existing subscription has a payment issue. Please check its payment status before trying again.',
    provider_request_failed: 'Razorpay could not process the subscription request. Please try again later.',
    invalid_checkout_response: 'The Checkout response was invalid. No subscription access was granted.',
    subscription_not_ready: 'The subscription is not ready for verification yet. Please wait and try again.',
    reconciliation_rejected: 'The subscription status could not be reconciled.',
    provider_state_not_found: 'The provider subscription could not be reconciled.',
    reconciliation_failed: 'The subscription status could not be refreshed. Please try again later.',
    server_configuration_error: 'Payments are temporarily unavailable. Please try again later.',
    unknown_error: 'The subscription request could not be completed.',
  }

  class MockBusinessSubscriptionFlowError extends Error {
    readonly code: string

    constructor(code: string) {
      super(safeMessages[code] ?? safeMessages.unknown_error)
      this.name = 'BusinessSubscriptionFlowError'
      this.code = code
    }
  }

  return {
    FlowError: MockBusinessSubscriptionFlowError,
    createRazorpaySubscription: vi.fn(),
    loadRazorpayCheckout: vi.fn(),
    reconcileBusinessSubscription: vi.fn(),
    refreshBusinessSubscription: vi.fn(),
    useAuth: vi.fn(),
    useBusinessSubscription: vi.fn(),
    useProfile: vi.fn(),
    verifyRazorpaySubscriptionCheckout: vi.fn(),
  }
})

vi.mock('../../context/AuthContext.tsx', () => ({ useAuth: mocks.useAuth }))
vi.mock('../../context/BusinessSubscriptionContext.tsx', () => ({
  useBusinessSubscription: mocks.useBusinessSubscription,
}))
vi.mock('../../context/ProfileContext.tsx', () => ({ useProfile: mocks.useProfile }))
vi.mock('../../lib/businessSubscriptionService.ts', () => ({
  BusinessSubscriptionFlowError: mocks.FlowError,
  createRazorpaySubscription: mocks.createRazorpaySubscription,
  reconcileRazorpaySubscription: vi.fn(),
  verifyRazorpaySubscriptionCheckout: mocks.verifyRazorpaySubscriptionCheckout,
}))
vi.mock('../../lib/razorpayCheckout.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/razorpayCheckout.ts')>()
  return { ...actual, loadRazorpayCheckout: mocks.loadRazorpayCheckout }
})

const AppHeader = (await import('../../components/AppHeader.tsx')).default

type SubscriptionContextState = {
  subscription: BusinessSubscription
  hasProAccess: boolean
  isLoading: boolean
  isRefreshing: boolean
  isReconciliationInFlight: boolean
  error: Error | null
  refreshBusinessSubscription: () => Promise<void>
  reconcileBusinessSubscription: () => Promise<{
    result: 'reconciled' | 'already_reconciled' | 'payment_not_confirmed' | 'provider_state_not_entitled' | 'no_provider_subscription' | 'manual_review_required'
    status: BusinessSubscription['status']
    hasPaidPeriod: boolean
  }>
}

const authState = {
  user: { id: fakeRazorpayIdentifiers.ownerId, email: 'owner@example.test', user_metadata: {} },
  isLoading: false,
  accountMode: 'business_owner' as const,
  isBusinessOwnerEnabled: true,
  setPreferredAccountMode: vi.fn(async () => undefined),
  setLogoutInProgress: vi.fn(),
}

let currentSubscriptionContext: SubscriptionContextState
const forceHeaderUpdateRef: { current: (() => void) | null } = { current: null }

function makeSubscriptionContext(
  subscription: BusinessSubscription = fakeFreeSubscription,
  overrides: Partial<SubscriptionContextState> = {},
): SubscriptionContextState {
  return {
    subscription,
    hasProAccess: subscription.hasProAccess,
    isLoading: false,
    isRefreshing: false,
    isReconciliationInFlight: false,
    error: null,
    refreshBusinessSubscription: mocks.refreshBusinessSubscription,
    reconcileBusinessSubscription: mocks.reconcileBusinessSubscription,
    ...overrides,
  }
}

function setSubscriptionContext(next: SubscriptionContextState) {
  currentSubscriptionContext = next
  act(() => {
    forceHeaderUpdateRef.current?.()
  })
}

function AnalyticsHarness() {
  const [, setVersion] = useState(0)

  useEffect(() => {
    forceHeaderUpdateRef.current = () => setVersion((version) => version + 1)
    return () => {
      forceHeaderUpdateRef.current = null
    }
  }, [])

  return (
    <MemoryRouter initialEntries={['/business-home']}>
      <AppHeader
        businessOwnerAnalyticsOpenRequest={1}
        businessOwnerMenuState={{
          hasBusinessProfile: true,
          businessName: 'Example Business',
          ownerEmail: 'owner@example.test',
          businessProfile: null,
        }}
      />
    </MemoryRouter>
  )
}

function renderAnalytics(context: SubscriptionContextState = makeSubscriptionContext()) {
  currentSubscriptionContext = context
  return render(<AnalyticsHarness />)
}

function upgradeButton() {
  return screen.getByRole('button', { name: 'Upgrade' })
}

async function openAnalyticsPanel() {
  if (!screen.queryByRole('menu', { name: 'Business owner analytics' })) {
    if (!vi.isFakeTimers()) {
      await act(async () => {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
      })
    }

    if (!screen.queryByRole('menu', { name: 'Business owner analytics' })) {
      fireEvent.click(screen.getByRole('button', { name: 'Open account menu' }))
      fireEvent.click(screen.getByRole('menuitem', { name: 'Analytics' }))
    }
  }
}

async function openCheckout() {
  const checkout = installMockRazorpayCheckout()
  await openAnalyticsPanel()
  fireEvent.click(await screen.findByRole('button', { name: 'Upgrade' }))
  await waitFor(() => expect(mocks.createRazorpaySubscription).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(checkout.constructorMock).toHaveBeenCalledTimes(1))
  return checkout
}

describe('Business Owner Analytics payment interactions', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    vi.useRealTimers()
    forceHeaderUpdateRef.current = null
    currentSubscriptionContext = makeSubscriptionContext()
    mocks.createRazorpaySubscription.mockReset()
    mocks.loadRazorpayCheckout.mockReset()
    mocks.reconcileBusinessSubscription.mockReset()
    mocks.refreshBusinessSubscription.mockReset()
    mocks.verifyRazorpaySubscriptionCheckout.mockReset()
    mocks.useAuth.mockReturnValue(authState)
    mocks.useProfile.mockReturnValue({
      profileData: { id: '', businessName: '', existingLogoUrl: null, slug: '' },
      setProfileData: vi.fn(),
    })
    mocks.useBusinessSubscription.mockImplementation(() => currentSubscriptionContext)
    mocks.createRazorpaySubscription.mockResolvedValue({
      provider: 'razorpay',
      environment: 'test',
      keyId: 'rzp_test_example',
      subscriptionId: fakeRazorpayIdentifiers.subscriptionId,
      checkoutName: 'Smart Business Profile',
      checkoutDescription: 'Pro Analytics - Rs 45/month',
      amountMinorUnits: 4500,
      currency: 'INR',
      reused: false,
    })
    mocks.loadRazorpayCheckout.mockImplementation(async () => window.Razorpay)
    mocks.refreshBusinessSubscription.mockResolvedValue(undefined)
    mocks.reconcileBusinessSubscription.mockResolvedValue({
      result: 'reconciled',
      status: 'active',
      hasPaidPeriod: true,
    })
    mocks.verifyRazorpaySubscriptionCheckout.mockResolvedValue({ verified: true, message: 'Verified.' })
  })

  it('keeps locked, loading, incomplete, and backend-false states fail closed', async () => {
    const view = renderAnalytics()
    await openAnalyticsPanel()
    expect(screen.getByText('Unlock full Analytics with Pro Analytics')).toBeInTheDocument()
    expect(upgradeButton()).toBeEnabled()

    setSubscriptionContext(makeSubscriptionContext(fakeIncompleteSubscription))
    expect(screen.queryByRole('button', { name: 'Upgrade' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh subscription status' })).toBeInTheDocument()

    setSubscriptionContext(makeSubscriptionContext(fakeActiveProSubscription, { isLoading: true }))
    expect(screen.getByText('Checking Analytics access')).toBeInTheDocument()
    expect(screen.queryByText('Customer Actions')).not.toBeInTheDocument()

    setSubscriptionContext(makeSubscriptionContext(fakePastDueSubscription))
    expect(screen.getByText('Unlock full Analytics with Pro Analytics')).toBeInTheDocument()

    view.unmount()
  })

  it('uses backend hasProAccess for active and canceled subscriptions', async () => {
    const view = renderAnalytics(makeSubscriptionContext(fakeActiveProSubscription))
    await openAnalyticsPanel()
    expect(screen.getByText('Customer Actions')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Upgrade' })).not.toBeInTheDocument()

    setSubscriptionContext(makeSubscriptionContext(fakeCanceledProSubscription))
    expect(screen.getByText('Customer Actions')).toBeInTheDocument()
    expect(screen.getByText(/Renewal is cancelled/)).toBeInTheDocument()
    view.unmount()
  })

  it('does not start Checkout while opening Analytics or rendering the page', async () => {
    renderAnalytics()
    await openAnalyticsPanel()
    expect(mocks.createRazorpaySubscription).not.toHaveBeenCalled()
    expect(mocks.loadRazorpayCheckout).not.toHaveBeenCalled()
  })

  it('creates one subscription with the empty request and lazy-loads Checkout after Upgrade', async () => {
    renderAnalytics()
    await openAnalyticsPanel()
    const checkout = installMockRazorpayCheckout()

    await userEvent.setup().click(upgradeButton())
    await waitFor(() => expect(mocks.createRazorpaySubscription).toHaveBeenCalledTimes(1))
    expect(mocks.createRazorpaySubscription).toHaveBeenCalledWith()
    expect(mocks.loadRazorpayCheckout).toHaveBeenCalledTimes(1)
    expect(checkout.checkoutOptions[0]).toMatchObject({
      key: 'rzp_test_example',
      subscription_id: fakeRazorpayIdentifiers.subscriptionId,
      name: 'Smart Business Profile',
      description: 'Pro Analytics - Rs 45/month',
    })
    expect(Object.keys(checkout.checkoutOptions[0]).sort()).toEqual(
      ['description', 'handler', 'key', 'modal', 'name', 'subscription_id'].sort(),
    )
    expect(checkout.checkoutOptions[0]).not.toHaveProperty('amount')
    expect(checkout.checkoutOptions[0]).not.toHaveProperty('currency')
  })

  it('guards repeated clicks while subscription creation is pending', async () => {
    const creation = createDeferred<unknown>()
    mocks.createRazorpaySubscription.mockReturnValueOnce(creation.promise)
    renderAnalytics()
    await openAnalyticsPanel()
    const user = userEvent.setup()

    await user.click(upgradeButton())
    await user.click(screen.getByRole('button', { name: 'Preparing...' }))
    expect(mocks.createRazorpaySubscription).toHaveBeenCalledTimes(1)

    creation.resolve({})
  })

  it('validates success against the exact created subscription and never grants access directly', async () => {
    renderAnalytics()
    const checkout = await openCheckout()

    await act(async () => {
      checkout.checkoutOptions[0].handler(fakeRazorpayCheckoutSuccess)
      checkout.checkoutOptions[0].handler(fakeRazorpayCheckoutSuccess)
      await waitFor(() => expect(mocks.verifyRazorpaySubscriptionCheckout).toHaveBeenCalledTimes(1))
    })
    expect(mocks.verifyRazorpaySubscriptionCheckout).toHaveBeenCalledWith(
      fakeRazorpayIdentifiers.paymentId,
      fakeRazorpayIdentifiers.subscriptionId,
      'a'.repeat(64),
    )
    expect(mocks.refreshBusinessSubscription).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Unlock full Analytics with Pro Analytics')).toBeInTheDocument()
    expect(screen.queryByText('Customer Actions')).not.toBeInTheDocument()
  })

  it.each([
    ['mismatched subscription', { ...fakeRazorpayCheckoutSuccess, razorpay_subscription_id: 'sub_other_example' }],
    ['malformed payment', { ...fakeRazorpayCheckoutSuccess, razorpay_payment_id: 'pay' }],
    ['malformed subscription', { ...fakeRazorpayCheckoutSuccess, razorpay_subscription_id: 'subscription' }],
    ['missing signature', { ...fakeRazorpayCheckoutSuccess, razorpay_signature: undefined }],
    ['malformed signature', { ...fakeRazorpayCheckoutSuccess, razorpay_signature: 'not-a-signature' }],
    ['missing fields', {}],
  ])('rejects %s Checkout responses without verification or access', async (_name, response) => {
    renderAnalytics()
    const checkout = await openCheckout()

    await act(async () => {
      checkout.checkoutOptions[0].handler(response)
    })
    await waitFor(() => expect(screen.getByText('Payment verification failed. No subscription access was granted.')).toBeInTheDocument())
    expect(mocks.verifyRazorpaySubscriptionCheckout).not.toHaveBeenCalled()
    expect(screen.queryByText('Customer Actions')).not.toBeInTheDocument()
  })

  it('polls at the current cadence, stops on backend Pro access, and exposes Check activation after timeout', async () => {
    vi.useFakeTimers()
    try {
      renderAnalytics()
      await vi.runAllTimersAsync()
      await openAnalyticsPanel()
      const checkout = installMockRazorpayCheckout()
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Upgrade' }))
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(checkout.constructorMock).toHaveBeenCalledTimes(1)
      checkout.checkoutOptions[0].handler(fakeRazorpayCheckoutSuccess)
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(mocks.refreshBusinessSubscription).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(2500)
      expect(mocks.refreshBusinessSubscription).toHaveBeenCalledTimes(2)

      setSubscriptionContext(makeSubscriptionContext(fakeActiveProSubscription))
      expect(screen.getByText('Customer Actions')).toBeInTheDocument()
      const refreshCountAfterActivation = mocks.refreshBusinessSubscription.mock.calls.length
      await vi.advanceTimersByTimeAsync(5000)
      expect(mocks.refreshBusinessSubscription).toHaveBeenCalledTimes(refreshCountAfterActivation)
      expect(mocks.createRazorpaySubscription).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops polling at the current timeout and keeps Analytics locked', async () => {
    vi.useFakeTimers()
    try {
      renderAnalytics()
      await vi.runAllTimersAsync()
      await openAnalyticsPanel()
      const checkout = installMockRazorpayCheckout()
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Upgrade' }))
        await Promise.resolve()
        await Promise.resolve()
      })
      checkout.checkoutOptions[0].handler(fakeRazorpayCheckoutSuccess)
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(mocks.refreshBusinessSubscription).toHaveBeenCalledTimes(1)

      vi.setSystemTime(Date.now() + 31_000)
      await vi.runOnlyPendingTimersAsync()
      await act(async () => {
        await Promise.resolve()
      })
      expect(screen.getByRole('button', { name: 'Check activation' })).toBeInTheDocument()
      const refreshCountAtTimeout = mocks.refreshBusinessSubscription.mock.calls.length
      fireEvent.click(screen.getByRole('button', { name: 'Check activation' }))
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(mocks.refreshBusinessSubscription).toHaveBeenCalledTimes(refreshCountAtTimeout + 1)
      expect(mocks.createRazorpaySubscription).toHaveBeenCalledTimes(1)
      expect(screen.queryByText('Customer Actions')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('reconciles manually without opening Checkout or creating another subscription', async () => {
    renderAnalytics(makeSubscriptionContext(fakeIncompleteSubscription))
    await openAnalyticsPanel()
    const user = userEvent.setup()
    const reconcile = createDeferred<{
      result: 'payment_not_confirmed'
      status: 'incomplete'
      hasPaidPeriod: false
    }>()
    mocks.reconcileBusinessSubscription.mockReturnValueOnce(reconcile.promise)

    const activationButton = await screen.findByRole('button', { name: 'Refresh subscription status' })
    await user.click(activationButton)
    setSubscriptionContext(makeSubscriptionContext(fakeIncompleteSubscription, { isReconciliationInFlight: true }))
    await user.click(screen.getByRole('button', { name: 'Checking payment status...' }))
    expect(mocks.reconcileBusinessSubscription).toHaveBeenCalledTimes(1)
    expect(mocks.createRazorpaySubscription).not.toHaveBeenCalled()

    reconcile.resolve({ result: 'payment_not_confirmed', status: 'incomplete', hasPaidPeriod: false })
    await waitFor(() => expect(screen.getByText('Payment could not be confirmed. Analytics remains locked.')).toBeInTheDocument())
    expect(screen.queryByText('Customer Actions')).not.toBeInTheDocument()
  })

  it('keeps payment failure and dismissal safe and recoverable', async () => {
    renderAnalytics()
    const checkout = await openCheckout()
    checkout.emitPaymentFailed({ error: { description: 'fake provider detail' } })
    await waitFor(() => expect(screen.getByText('Payment authorization was not completed.')).toBeInTheDocument())
    expect(screen.queryByText('fake provider detail')).not.toBeInTheDocument()
    expect(mocks.verifyRazorpaySubscriptionCheckout).not.toHaveBeenCalled()

    await userEvent.setup().click(upgradeButton())
    await waitFor(() => expect(mocks.createRazorpaySubscription).toHaveBeenCalledTimes(2))
    const secondCheckout = document.querySelector('[role="menu"]')
    expect(secondCheckout).not.toBeNull()
  })

  it('ends the active Checkout state on dismissal without verification or access changes', async () => {
    renderAnalytics()
    const checkout = await openCheckout()

    checkout.checkoutOptions[0].modal.ondismiss()
    await waitFor(() => expect(screen.getByText('Checkout was closed. No access changes were made.')).toBeInTheDocument())
    expect(mocks.verifyRazorpaySubscriptionCheckout).not.toHaveBeenCalled()
    expect(mocks.reconcileBusinessSubscription).not.toHaveBeenCalled()
    expect(screen.queryByText('Customer Actions')).not.toBeInTheDocument()
  })

  it.each([
    ['provider_state_not_entitled', 'Your provider subscription does not currently include paid Analytics access.'],
    ['manual_review_required', 'Payment status requires manual review. Analytics remains locked.'],
    ['no_provider_subscription', 'No existing subscription needs refreshing.'],
  ] as const)('keeps reconciliation result %s locked', async (result, message) => {
    renderAnalytics(makeSubscriptionContext(fakeIncompleteSubscription))
    await openAnalyticsPanel()
    mocks.reconcileBusinessSubscription.mockResolvedValueOnce({
      result,
      status: 'incomplete',
      hasPaidPeriod: false,
    })

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Refresh subscription status' }))
    await waitFor(() => expect(screen.getByText(message)).toBeInTheDocument())
    expect(screen.queryByText('Customer Actions')).not.toBeInTheDocument()
    expect(mocks.createRazorpaySubscription).not.toHaveBeenCalled()
  })

  it.each([
    ['provider_temporarily_unavailable', 'Razorpay is temporarily unavailable. Please try again later.'],
    ['existing_subscription', 'A subscription already exists for this account.'],
    ['existing_subscription_payment_issue', 'Your existing subscription has a payment issue. Please check its payment status before trying again.'],
    ['provider_request_failed', 'Razorpay could not process the subscription request. Please try again later.'],
    ['subscription_not_ready', 'The subscription is not ready for verification yet. Please wait and try again.'],
    ['server_configuration_error', 'Payments are temporarily unavailable. Please try again later.'],
    ['unknown_error', 'The subscription request could not be completed.'],
  ] as const)('maps %s to a safe message without granting access', async (code, message) => {
    mocks.createRazorpaySubscription.mockRejectedValueOnce(new mocks.FlowError(code))
    renderAnalytics()

    await openAnalyticsPanel()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Upgrade' }))
    await waitFor(() => expect(screen.getByText(message)).toBeInTheDocument())
    expect(screen.queryByText(code)).not.toBeInTheDocument()
    expect(screen.queryByText('Customer Actions')).not.toBeInTheDocument()
  })
})
