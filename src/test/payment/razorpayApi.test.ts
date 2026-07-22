import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  RazorpayApiError,
  getRazorpayApiConfig,
  razorpayApiRequest,
} from '../../../supabase/functions/_shared/razorpay.ts'
import { fakeRazorpayApiConfig, fakeRazorpaySecrets } from '../fixtures/razorpay.ts'

type FakeDeno = { env: { get: (name: string) => string | undefined } }

const setFakeEnvironment = () => {
  vi.stubGlobal('Deno', {
    env: {
      get: (name: string) => ({
        RAZORPAY_ENVIRONMENT: fakeRazorpayApiConfig.environment,
        RAZORPAY_KEY_ID: fakeRazorpayApiConfig.keyId,
        RAZORPAY_KEY_SECRET: fakeRazorpaySecrets.apiKeySecret,
        RAZORPAY_PLAN_ID: fakeRazorpayApiConfig.planId,
      })[name],
    },
  } satisfies FakeDeno)
}

const jsonResponse = (body: unknown, status = 200, contentType = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': contentType } })

describe('Razorpay API helper behavior', () => {
  beforeEach(() => {
    setFakeEnvironment()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('passes successful JSON through the supplied runtime parser', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'sub_test_example', value: 7 }))

    await expect(
      razorpayApiRequest('/subscriptions/sub_test_example', { method: 'GET' }, (payload) => {
        if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) throw new Error('invalid')
        return payload.id
      }),
    ).resolves.toBe('sub_test_example')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it.each([
    ['test', 'rzp_live_example'],
    ['live', 'rzp_test_example'],
  ] as const)('rejects an obvious %s-mode Key ID mismatch', (environment, keyId) => {
    vi.stubGlobal('Deno', {
      env: {
        get: (name: string) => ({
          RAZORPAY_ENVIRONMENT: environment,
          RAZORPAY_KEY_ID: keyId,
          RAZORPAY_KEY_SECRET: fakeRazorpaySecrets.apiKeySecret,
          RAZORPAY_PLAN_ID: fakeRazorpayApiConfig.planId,
        })[name],
      },
    } satisfies FakeDeno)

    expect(() => getRazorpayApiConfig()).toThrow(
      'RAZORPAY_KEY_ID does not match RAZORPAY_ENVIRONMENT.',
    )
  })

  it('sanitizes parser rejection as invalid_response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ok: true }))

    await expect(
      razorpayApiRequest('/subscriptions/sub_test_example', { method: 'GET' }, () => {
        throw new Error('provider detail must not escape')
      }),
    ).rejects.toMatchObject({ category: 'invalid_response', retryable: true, outcomeUnknown: false })
  })

  it('rejects non-JSON successful responses and malformed JSON', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } }))
    await expect(razorpayApiRequest('/subscriptions/sub_test_example', { method: 'GET' }, () => null)).rejects.toMatchObject({ category: 'invalid_response' })

    vi.mocked(fetch).mockResolvedValueOnce(new Response('{', { status: 200, headers: { 'content-type': 'application/json' } }))
    await expect(razorpayApiRequest('/subscriptions/sub_test_example', { method: 'GET' }, () => null)).rejects.toMatchObject({ category: 'invalid_response' })
  })

  it('keeps safe provider error codes and discards unsafe values', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: { code: 'BAD_REQUEST_ERROR' } }, 400))
    await expect(razorpayApiRequest('/subscriptions/sub_test_example', { method: 'GET' }, () => null)).rejects.toMatchObject({ providerCode: 'BAD_REQUEST_ERROR' })

    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: { code: 'DROP TABLE subscriptions;' } }, 400))
    await expect(razorpayApiRequest('/subscriptions/sub_test_example', { method: 'GET' }, () => null)).rejects.toMatchObject({ providerCode: null })
  })

  it.each([408, 429, 500, 503])('classifies GET %s as retryable with known outcome', async (status) => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}, status))
    await expect(razorpayApiRequest('/subscriptions/sub_test_example', { method: 'GET' }, () => null)).rejects.toMatchObject({ retryable: true, outcomeUnknown: false })
  })

  it('classifies a GET network failure as retryable with known outcome', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network unavailable'))
    await expect(razorpayApiRequest('/subscriptions', { method: 'GET' }, () => null)).rejects.toMatchObject({
      category: 'network',
      retryable: true,
      outcomeUnknown: false,
    })
  })

  it.each(['POST', 'PATCH'] as const)('classifies mutation network failure as outcome unknown and non-retryable: %s', async (method) => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network unavailable'))
    await expect(razorpayApiRequest('/subscriptions/sub_test_example', { method }, () => null)).rejects.toMatchObject({ category: 'network', retryable: false, outcomeUnknown: true })
  })

  it.each(['POST', 'PATCH'] as const)('classifies mutation 408/429/5xx as outcome unknown: %s', async (method) => {
    for (const status of [408, 429, 500]) {
      vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}, status))
      await expect(razorpayApiRequest('/subscriptions', { method }, () => null)).rejects.toMatchObject({ retryable: false, outcomeUnknown: true })
    }
  })

  it('classifies deterministic mutation 4xx failures as non-retryable with known outcome', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}, 422))
    await expect(razorpayApiRequest('/subscriptions', { method: 'POST' }, () => null)).rejects.toMatchObject({ retryable: false, outcomeUnknown: false })
  })

  it('classifies invalid successful mutation responses as outcome unknown', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ok: true }))
    await expect(razorpayApiRequest('/subscriptions', { method: 'POST' }, () => { throw new Error('invalid') })).rejects.toMatchObject({ category: 'invalid_response', retryable: false, outcomeUnknown: true })
  })

  it.each(['relative', '//evil.example', '/../escape', '/subscriptions\\bad'])('rejects invalid API path before fetch: %s', async (path) => {
    const fetchMock = vi.mocked(fetch)
    await expect(razorpayApiRequest(path, { method: 'GET' }, () => null)).rejects.toBeInstanceOf(RazorpayApiError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
