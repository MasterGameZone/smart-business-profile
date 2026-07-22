import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { fakeRazorpayCustomer } from './fixtures/razorpay.ts'

function TestFoundationSmoke() {
  return (
    <section aria-label="Payment test foundation">
      <h1>Payment test foundation</h1>
      <p>{fakeRazorpayCustomer.email}</p>
    </section>
  )
}

describe('test foundation', () => {
  it('renders in jsdom with shared jest-dom matchers', () => {
    render(<TestFoundationSmoke />)

    expect(screen.getByRole('heading', { name: 'Payment test foundation' })).toBeInTheDocument()
    expect(screen.getByText(fakeRazorpayCustomer.email)).toBeVisible()
  })
})
