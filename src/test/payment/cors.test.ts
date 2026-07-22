import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getAllowedOrigins,
  getRequestOrigin,
  handleCorsPreflight,
  HttpError,
  internalServerError,
  jsonError,
  jsonSuccess,
  methodNotAllowed,
} from '../../../supabase/functions/_shared/http.ts'

type FakeEnvironment = Record<string, string | undefined>

const approvedOrigin = 'https://business.example.test'
const secondApprovedOrigin = 'https://business-preview.example.test:8443'

function setCorsEnvironment(values: FakeEnvironment): void {
  vi.stubGlobal('Deno', {
    env: {
      get: (name: string) => values[name],
    },
  })
}

function browserRequest(origin: string, method = 'POST'): Request {
  return new Request('https://functions.example.test/payment', {
    method,
    headers: { origin },
  })
}

describe('shared Edge Function CORS policy', () => {
  beforeEach(() => {
    setCorsEnvironment({
      RAZORPAY_ENVIRONMENT: 'live',
      SBP_ALLOWED_ORIGINS: approvedOrigin,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('normalizes an exact comma-separated origin list without allowing a wildcard', () => {
    setCorsEnvironment({
      RAZORPAY_ENVIRONMENT: 'live',
      SBP_ALLOWED_ORIGINS: ` ${approvedOrigin},${secondApprovedOrigin},${approvedOrigin} `,
    })

    expect(getAllowedOrigins()).toEqual([approvedOrigin, secondApprovedOrigin])
    expect(getRequestOrigin(browserRequest(approvedOrigin))).toBe(approvedOrigin)
    expect(getRequestOrigin(browserRequest(`${approvedOrigin}.evil`))).toBe(`${approvedOrigin}.evil`)
  })

  it('keeps the localhost fallback only in Test Mode', () => {
    setCorsEnvironment({ RAZORPAY_ENVIRONMENT: 'test' })
    expect(getAllowedOrigins()).toEqual(['http://localhost:5000'])

    setCorsEnvironment({ RAZORPAY_ENVIRONMENT: 'live' })
    expect(() => getAllowedOrigins()).toThrowError(
      new HttpError(500, 'server_configuration_error', 'Server configuration is invalid.'),
    )
  })

  it.each([
    '*',
    `${approvedOrigin}/callback`,
    `${approvedOrigin}?mode=test`,
    `${approvedOrigin}#section`,
    'https://user:password@business.example.test',
    'not-an-origin',
  ])('rejects unsafe configured origin %s', (invalidOrigin) => {
    setCorsEnvironment({ RAZORPAY_ENVIRONMENT: 'live', SBP_ALLOWED_ORIGINS: invalidOrigin })
    expect(() => getAllowedOrigins()).toThrowError('Server configuration is invalid.')
  })

  it('returns an approved preflight with exact CORS headers', () => {
    const response = handleCorsPreflight(browserRequest(approvedOrigin, 'OPTIONS'))

    expect(response?.status).toBe(204)
    expect(response?.headers.get('access-control-allow-origin')).toBe(approvedOrigin)
    expect(response?.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS')
    expect(response?.headers.get('access-control-allow-headers')).toContain('authorization')
    expect(response?.headers.get('vary')).toBe('Origin')
  })

  it('rejects an unknown browser origin without returning an allow-origin header', async () => {
    const response = handleCorsPreflight(browserRequest('https://unknown.example.test', 'OPTIONS'))

    expect(response?.status).toBe(403)
    expect(response?.headers.has('access-control-allow-origin')).toBe(false)
    await expect(response?.json()).resolves.toMatchObject({
      ok: false,
      error: { code: 'origin_not_allowed' },
    })
  })

  it('fails closed with a sanitized configuration error for a browser request in Live Mode', async () => {
    setCorsEnvironment({ RAZORPAY_ENVIRONMENT: 'live' })

    const preflight = handleCorsPreflight(browserRequest(approvedOrigin, 'OPTIONS'))
    expect(preflight?.status).toBe(500)
    expect(preflight?.headers.has('access-control-allow-origin')).toBe(false)
    await expect(preflight?.json()).resolves.toEqual({
      ok: false,
      error: { code: 'server_configuration_error', message: 'Server configuration is invalid.' },
    })

    const response = jsonSuccess({ ready: true }, { request: browserRequest(approvedOrigin) })
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: { code: 'server_configuration_error', message: 'Server configuration is invalid.' },
    })
  })

  it('preserves approved-origin CORS headers on success and expected errors', async () => {
    const request = browserRequest(approvedOrigin)
    const responses = [
      jsonSuccess({ ready: true }, { request }),
      jsonError('invalid_request', 'The request is invalid.', { request, status: 400 }),
      methodNotAllowed(['POST'], request),
      internalServerError(request),
    ]

    for (const response of responses) {
      expect(response.headers.get('access-control-allow-origin')).toBe(approvedOrigin)
      expect(response.headers.get('vary')).toBe('Origin')
    }
    await expect(responses[0].json()).resolves.toMatchObject({ ok: true })
  })

  it('keeps legitimate no-Origin server-to-server calls working without CORS headers', async () => {
    setCorsEnvironment({ RAZORPAY_ENVIRONMENT: 'live' })
    const request = new Request('https://functions.example.test/internal', { method: 'POST' })

    const response = jsonSuccess({ received: true }, { request })

    expect(response.status).toBe(200)
    expect(response.headers.has('access-control-allow-origin')).toBe(false)
    expect(response.headers.has('vary')).toBe(false)
    await expect(response.json()).resolves.toMatchObject({ ok: true, data: { received: true } })
  })
})
