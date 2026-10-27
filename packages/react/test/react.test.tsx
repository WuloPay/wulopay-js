import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { checkoutUrl, getCheckoutReturn, WuloPayButton } from '../src/index.js'

afterEach(cleanup)

describe('WuloPayButton', () => {
  it('creates the session through the backend and redirects to the payment page', async () => {
    const redirect = vi.fn()
    const createSession = vi.fn().mockResolvedValue({ url: 'https://pay-sandbox.wulopay.com/c/cs_abc123def456' })
    render(<WuloPayButton createSession={createSession} redirect={redirect}>Pay R 149.99</WuloPayButton>)
    await userEvent.click(screen.getByRole('button', { name: 'Pay R 149.99' }))
    await waitFor(() => expect(redirect).toHaveBeenCalledWith('https://pay-sandbox.wulopay.com/c/cs_abc123def456'))
    expect(createSession).toHaveBeenCalledTimes(1)
  })

  it('refuses to redirect anywhere but a WuloPay payment page', async () => {
    const redirect = vi.fn(); const onError = vi.fn()
    render(<WuloPayButton createSession={async () => 'https://evil.example/c/cs_1'} redirect={redirect} onError={onError} />)
    await userEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(onError).toHaveBeenCalled())
    expect(redirect).not.toHaveBeenCalled()
    expect(screen.getByRole('button')).not.toBeDisabled()
  })

  it('shows the loading text and ignores double clicks', async () => {
    let resolve!: (v: { url: string }) => void
    const createSession = vi.fn(() => new Promise<{ url: string }>((r) => { resolve = r }))
    const redirect = vi.fn()
    render(<WuloPayButton createSession={createSession} redirect={redirect} loadingText="Wait…" />)
    const button = screen.getByRole('button')
    await userEvent.click(button)
    await userEvent.click(button)
    expect(button).toHaveTextContent('Wait…')
    expect(createSession).toHaveBeenCalledTimes(1)
    resolve({ url: 'https://pay.wulopay.com/c/cs_abc123def456' })
    await waitFor(() => expect(redirect).toHaveBeenCalledTimes(1))
  })
})

describe('helpers', () => {
  it('accepts only https WuloPay hosts (plus explicitly allowed ones)', () => {
    expect(checkoutUrl('https://pay.wulopay.com/c/cs_1')).toBe('https://pay.wulopay.com/c/cs_1')
    expect(() => checkoutUrl('http://pay.wulopay.com/c/cs_1')).toThrow()
    expect(() => checkoutUrl('https://pay.wulopay.com.evil.example/c/cs_1')).toThrow()
    expect(checkoutUrl({ url: 'https://pay.staging.example/c/cs_1' }, ['pay.staging.example'])).toContain('staging')
  })

  it('reads the return parameters', () => {
    expect(getCheckoutReturn('?session_id=cs_7CRIaOqGBtDY1J7ARiDLS7&status=paid')).toEqual({ sessionId: 'cs_7CRIaOqGBtDY1J7ARiDLS7', status: 'paid' })
    expect(getCheckoutReturn('?session_id=<script>&status=hacked')).toEqual({ sessionId: null, status: null })
  })
})
