import { vi } from 'vitest'

import type {
  RazorpayCheckoutInstance,
  RazorpayCheckoutOptions,
  RazorpayCheckoutSuccessResponse,
  RazorpayPaymentFailureEvent,
} from '../../lib/razorpayCheckout.ts'
import { fakeRazorpayCheckoutSuccess } from '../fixtures/razorpay.ts'

interface InstallMockRazorpayCheckoutOptions {
  autoDismiss?: boolean
  autoSucceed?: boolean
  successResponse?: RazorpayCheckoutSuccessResponse
}

export function installMockRazorpayCheckout(options: InstallMockRazorpayCheckoutOptions = {}) {
  const checkoutOptions: RazorpayCheckoutOptions[] = []
  const instances: RazorpayCheckoutInstance[] = []
  const paymentFailedHandlers: Array<(response: RazorpayPaymentFailureEvent) => void> = []
  const {
    autoDismiss = false,
    autoSucceed = false,
    successResponse = fakeRazorpayCheckoutSuccess,
  } = options

  const constructorMock = vi.fn((checkoutOption: RazorpayCheckoutOptions): RazorpayCheckoutInstance => {
    const instance: RazorpayCheckoutInstance = {
      on: vi.fn((event, handler) => {
        if (event === 'payment.failed') {
          paymentFailedHandlers.push(handler)
        }
      }),
      open: vi.fn(() => {
        if (autoSucceed) {
          checkoutOption.handler(successResponse)
          return
        }

        if (autoDismiss) {
          checkoutOption.modal.ondismiss()
        }
      }),
    }

    checkoutOptions.push(checkoutOption)
    instances.push(instance)
    return instance
  })

  window.Razorpay = constructorMock

  return {
    checkoutOptions,
    constructorMock,
    emitPaymentFailed: (response: RazorpayPaymentFailureEvent) => {
      paymentFailedHandlers.forEach((handler) => handler(response))
    },
    instances,
    uninstall: () => {
      delete window.Razorpay
    },
  }
}
