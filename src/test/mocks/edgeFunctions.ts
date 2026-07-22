import { vi } from 'vitest'

export interface MockEdgeFunctionError {
  message: string
}

export type MockEdgeFunctionResult =
  | { data: null; error: MockEdgeFunctionError }
  | { data: unknown; error: null }

export type MockEdgeFunctionHandler = (body: unknown) => MockEdgeFunctionResult | Promise<MockEdgeFunctionResult>

export interface MockEdgeFunctionInvokeOptions {
  body?: unknown
}

export function createMockEdgeFunctionInvoker(handlers: Record<string, MockEdgeFunctionHandler>) {
  const invoke = vi.fn(async (functionName: string, options: MockEdgeFunctionInvokeOptions = {}) => {
    const handler = handlers[functionName]

    if (!handler) {
      return {
        data: null,
        error: { message: `No mock Edge Function handler registered for ${functionName}.` },
      } satisfies MockEdgeFunctionResult
    }

    return handler(options.body)
  })

  return {
    handlers,
    invoke,
  }
}
