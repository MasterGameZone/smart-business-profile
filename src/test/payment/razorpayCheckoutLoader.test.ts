import { beforeEach, describe, expect, it, vi } from 'vitest'

const checkoutScriptSelector = 'script[src="https://checkout.razorpay.com/v1/checkout.js"]'

async function getLoader() {
  const module = await import('../../lib/razorpayCheckout.ts')
  return module.loadRazorpayCheckout
}

describe('Razorpay Checkout script loader', () => {
  beforeEach(() => {
    vi.resetModules()
    document.querySelectorAll(checkoutScriptSelector).forEach((script) => script.remove())
    delete window.Razorpay
  })

  it('returns an already-loaded constructor without adding a script', async () => {
    const loadRazorpayCheckout = await getLoader()
    const constructor = vi.fn()
    window.Razorpay = constructor as never

    await expect(loadRazorpayCheckout()).resolves.toBe(constructor)
    expect(document.querySelectorAll('script')).toHaveLength(0)
  })

  it('adds one script and shares the in-flight promise for concurrent loads', async () => {
    const loadRazorpayCheckout = await getLoader()
    const firstLoad = loadRazorpayCheckout()
    const secondLoad = loadRazorpayCheckout()
    const scripts = document.querySelectorAll<HTMLScriptElement>(checkoutScriptSelector)
    const constructor = vi.fn()

    expect(firstLoad).toBe(secondLoad)
    expect(scripts).toHaveLength(1)
    window.Razorpay = constructor as never
    scripts[0].dispatchEvent(new Event('load'))

    await expect(firstLoad).resolves.toBe(constructor)
    await expect(secondLoad).resolves.toBe(constructor)
  })

  it('resolves after the script loads and exposes the constructor', async () => {
    const loadRazorpayCheckout = await getLoader()
    const load = loadRazorpayCheckout()
    const script = document.querySelector<HTMLScriptElement>(checkoutScriptSelector)
    const constructor = vi.fn()

    expect(script).not.toBeNull()
    window.Razorpay = constructor as never
    script?.dispatchEvent(new Event('load'))

    await expect(load).resolves.toBe(constructor)
  })

  it('rejects safely and removes a script that loads without a constructor', async () => {
    const loadRazorpayCheckout = await getLoader()
    const load = loadRazorpayCheckout()
    const script = document.querySelector<HTMLScriptElement>(checkoutScriptSelector)

    script?.dispatchEvent(new Event('load'))

    await expect(load).rejects.toThrow('Razorpay Checkout could not be loaded.')
    expect(document.querySelector(checkoutScriptSelector)).toBeNull()
  })

  it('rejects safely on script error and clears the failed promise for retry', async () => {
    const loadRazorpayCheckout = await getLoader()
    const failedLoad = loadRazorpayCheckout()
    const failedScript = document.querySelector<HTMLScriptElement>(checkoutScriptSelector)

    failedScript?.dispatchEvent(new Event('error'))
    await expect(failedLoad).rejects.toThrow('Razorpay Checkout could not be loaded.')
    expect(document.querySelector(checkoutScriptSelector)).toBeNull()

    const retryLoad = loadRazorpayCheckout()
    const retryScript = document.querySelector<HTMLScriptElement>(checkoutScriptSelector)
    const constructor = vi.fn()

    expect(retryScript).not.toBeNull()
    window.Razorpay = constructor as never
    retryScript?.dispatchEvent(new Event('load'))
    await expect(retryLoad).resolves.toBe(constructor)
  })

  it('does not create an external request in jsdom', async () => {
    const loadRazorpayCheckout = await getLoader()
    const appendChild = vi.spyOn(document.head, 'appendChild')
    const load = loadRazorpayCheckout()
    const script = document.querySelector<HTMLScriptElement>(checkoutScriptSelector)

    expect(appendChild).toHaveBeenCalledTimes(1)
    expect(script?.src).toBe('https://checkout.razorpay.com/v1/checkout.js')
    script?.dispatchEvent(new Event('error'))
    await expect(load).rejects.toThrow()
  })
})
