import { describe, expect, it, vi } from 'vitest'

import {
  buildPaymentMonitoringAlertEmail,
  classifyPaymentMonitoringProviderStatus,
  escapePaymentMonitoringHtml,
  getPaymentMonitoringEmailConfig,
  isPaymentMonitoringAlertPostRequest,
  isPaymentMonitoringCronRequestAuthorized,
  runPaymentMonitoringAlertDelivery,
  sendPaymentMonitoringAlertEmail,
  type PaymentMonitoringAlertDelivery,
} from '../../../supabase/functions/_shared/paymentMonitoringAlerts.ts'

const fakeConfig = {
  resendApiKey: 'fake_resend_api_key',
  adminEmail: 'owner@example.test',
  fromEmail: 'alerts@example.test',
  cronSecret: 'fake-cron-secret-000000000000000000000000000000',
}

const fakeDelivery: PaymentMonitoringAlertDelivery = {
  delivery_id: '10000000-0000-4000-8000-000000000001',
  claim_token: '20000000-0000-4000-8000-000000000001',
  delivery_key: 'payment-monitoring-email:10000000-0000-4000-8000-000000000001:critical',
  incident_id: '10000000-0000-4000-8000-000000000001',
  incident_type: '<script>alert(1)</script>',
  alert_severity: 'critical',
  diagnostic_code: 'provider_subscription_not_activated',
  source_table: 'business_owner_subscriptions',
  source_record_id: 'subscription_test_example',
  first_detected_at: '2026-07-22T12:00:00Z',
  last_detected_at: '2026-07-22T12:05:00Z',
  detection_count: 2,
  provider_subscription_id: 'sub_test_example',
  provider_event_id: 'event_test_example',
}

describe('payment monitoring alert helpers', () => {
  it('accepts POST and rejects unsupported methods', () => {
    expect(isPaymentMonitoringAlertPostRequest(new Request('https://alerts.example.test', { method: 'POST' }))).toBe(true)
    expect(isPaymentMonitoringAlertPostRequest(new Request('https://alerts.example.test', { method: 'GET' }))).toBe(false)
  })

  it('authorizes only the dedicated header using constant-time comparison', () => {
    const request = new Request('https://alerts.example.test', {
      method: 'POST',
      headers: { 'x-payment-monitoring-cron-secret': fakeConfig.cronSecret },
    })

    expect(isPaymentMonitoringCronRequestAuthorized(request, fakeConfig.cronSecret)).toBe(true)
    expect(isPaymentMonitoringCronRequestAuthorized(request, `${fakeConfig.cronSecret}wrong`)).toBe(false)
    expect(
      isPaymentMonitoringCronRequestAuthorized(
        new Request('https://alerts.example.test?secret=ignored', { method: 'POST' }),
        fakeConfig.cronSecret,
      ),
    ).toBe(false)
  })

  it('fails safely when required server email configuration is missing', () => {
    expect(() => getPaymentMonitoringEmailConfig(() => undefined)).toThrow(
      'Payment-monitoring email configuration is unavailable.',
    )
  })

  it('escapes dynamic HTML and excludes raw provider data from the email', () => {
    const email = buildPaymentMonitoringAlertEmail(fakeDelivery)

    expect(email.subject).toBe('[Smart Business Profile][CRITICAL] Payment monitoring incident')
    expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(email.html).not.toContain('<script>alert(1)</script>')
    expect(email.text).toContain('No automated recovery was performed.')
    expect(email.text).not.toContain('payload')
    expect(escapePaymentMonitoringHtml('a&b <c> "d" \'e\'')).toBe('a&amp;b &lt;c&gt; &quot;d&quot; &#39;e&#39;')
  })

  it('classifies provider and network outcomes without retaining provider response text', () => {
    expect(classifyPaymentMonitoringProviderStatus(429)).toEqual({
      errorCode: 'email_rate_limited',
      retryable: true,
    })
    expect(classifyPaymentMonitoringProviderStatus(409)).toEqual({
      errorCode: 'email_provider_conflict',
      retryable: true,
    })
    expect(classifyPaymentMonitoringProviderStatus(409, 'idempotency_key_conflict')).toEqual({
      errorCode: 'email_idempotency_conflict',
      retryable: false,
    })
    expect(classifyPaymentMonitoringProviderStatus(401)).toEqual({
      errorCode: 'email_authentication_failed',
      retryable: false,
    })
  })

  it('uses the delivery key as the provider idempotency key', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      expect(init?.headers).toMatchObject({
        'Idempotency-Key': fakeDelivery.delivery_key,
      })
      expect(String(init?.body)).toContain('owner@example.test')
      return new Response(JSON.stringify({ id: 'email_test_example' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })

    await expect(sendPaymentMonitoringAlertEmail(fakeDelivery, fakeConfig, fetchMock)).resolves.toEqual({
      ok: true,
      providerMessageId: 'email_test_example',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('classifies a mocked timeout as a retryable sanitized error', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      throw new DOMException('ignored test timeout', 'AbortError')
    })

    await expect(sendPaymentMonitoringAlertEmail(fakeDelivery, fakeConfig, fetchMock)).resolves.toEqual({
      ok: false,
      errorCode: 'email_timeout',
      retryable: true,
    })
  })

  it('continues after one failed delivery and enforces the batch limit', async () => {
    const secondDelivery = { ...fakeDelivery, delivery_id: '10000000-0000-4000-8000-000000000002' }
    const thirdDelivery = { ...fakeDelivery, delivery_id: '10000000-0000-4000-8000-000000000003' }
    const markFailed = vi.fn(async () => undefined)
    const markSent = vi.fn(async () => undefined)
    const send = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, errorCode: 'email_rate_limited', retryable: true } as const)
      .mockResolvedValueOnce({ ok: true, providerMessageId: 'email_test_002' } as const)

    const summary = await runPaymentMonitoringAlertDelivery(
      {
        enqueue: async () => ({ enqueued: 2, suppressed: 1 }),
        claim: async (batchSize) => {
          expect(batchSize).toBe(2)
          return [fakeDelivery, secondDelivery, thirdDelivery]
        },
        send,
        markSent,
        markFailed,
      },
      '2026-07-22T12:10:00Z',
      2,
    )

    expect(summary).toEqual({
      status: 'completed',
      enqueued: 2,
      claimed: 2,
      sent: 1,
      retry_scheduled: 1,
      failed: 0,
      suppressed: 1,
      observed_at: '2026-07-22T12:10:00Z',
    })
    expect(send).toHaveBeenCalledTimes(2)
    expect(markFailed).toHaveBeenCalledTimes(1)
    expect(markSent).toHaveBeenCalledTimes(1)
  })
})
