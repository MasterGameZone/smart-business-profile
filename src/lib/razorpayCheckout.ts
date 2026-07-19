const RAZORPAY_CHECKOUT_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js'

export interface RazorpayCheckoutSuccessResponse {
  razorpay_payment_id?: unknown
  razorpay_subscription_id?: unknown
  razorpay_signature?: unknown
}

export interface RazorpayPaymentFailureEvent {
  error?: unknown
}

export interface RazorpayCheckoutOptions {
  key: string
  subscription_id: string
  name: string
  description: string
  handler: (response: RazorpayCheckoutSuccessResponse) => void
  modal: {
    ondismiss: () => void
  }
}

export interface RazorpayCheckoutInstance {
  open: () => void
  on?: (event: 'payment.failed', handler: (response: RazorpayPaymentFailureEvent) => void) => void
}

export interface RazorpayConstructor {
  new (options: RazorpayCheckoutOptions): RazorpayCheckoutInstance
}

export interface ValidatedRazorpayCheckoutSuccess {
  paymentId: string
  subscriptionId: string
  signature: string
}

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor
  }
}

let razorpayCheckoutScriptPromise: Promise<RazorpayConstructor> | null = null

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function getLoadedRazorpayConstructor(): RazorpayConstructor | null {
  return typeof window !== 'undefined' && typeof window.Razorpay === 'function' ? window.Razorpay : null
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function validateRazorpayCheckoutSuccess(
  value: unknown,
  expectedSubscriptionId: string
): ValidatedRazorpayCheckoutSuccess | null {
  if (!isRecord(value)) {
    return null
  }

  const paymentId = value.razorpay_payment_id
  const subscriptionId = value.razorpay_subscription_id
  const signature = value.razorpay_signature

  if (
    !isNonBlankString(paymentId) ||
    !paymentId.startsWith('pay_') ||
    !isNonBlankString(subscriptionId) ||
    !subscriptionId.startsWith('sub_') ||
    subscriptionId !== expectedSubscriptionId ||
    typeof signature !== 'string' ||
    !/^[a-fA-F0-9]{64}$/.test(signature)
  ) {
    return null
  }

  return {
    paymentId,
    subscriptionId,
    signature,
  }
}

export function loadRazorpayCheckout(): Promise<RazorpayConstructor> {
  const loadedConstructor = getLoadedRazorpayConstructor()
  if (loadedConstructor) {
    return Promise.resolve(loadedConstructor)
  }

  if (razorpayCheckoutScriptPromise) {
    return razorpayCheckoutScriptPromise
  }

  const nextPromise = new Promise<RazorpayConstructor>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Razorpay Checkout is unavailable.'))
      return
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${RAZORPAY_CHECKOUT_SCRIPT_URL}"]`
    )
    const script = existingScript ?? document.createElement('script')
    let isSettled = false

    const cleanup = () => {
      script.removeEventListener('load', handleLoad)
      script.removeEventListener('error', handleError)
    }

    const handleLoad = () => {
      if (isSettled) {
        return
      }

      const constructor = getLoadedRazorpayConstructor()
      if (!constructor) {
        handleError()
        return
      }

      isSettled = true
      cleanup()
      resolve(constructor)
    }

    const handleError = () => {
      if (isSettled) {
        return
      }

      isSettled = true
      cleanup()
      script.remove()
      reject(new Error('Razorpay Checkout could not be loaded.'))
    }

    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', handleError, { once: true })

    if (!existingScript) {
      script.async = true
      script.src = RAZORPAY_CHECKOUT_SCRIPT_URL
      document.head.appendChild(script)
    } else if (getLoadedRazorpayConstructor()) {
      handleLoad()
    }
  })

  razorpayCheckoutScriptPromise = nextPromise
  void nextPromise.catch(() => {
    if (razorpayCheckoutScriptPromise === nextPromise) {
      razorpayCheckoutScriptPromise = null
    }
  })

  return nextPromise
}
