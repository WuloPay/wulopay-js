import { describe, expect, it, vi } from 'vitest'
import { openCheckout, parseCheckoutReturn } from '../src/index.js'

const url = 'https://pay-sandbox.wulopay.com/c/cs_7CRIaOqGBtDY1J7ARiDLS7'

describe('@wulopay/react-native', () => {
  it('opens the auth session with the return URL and reads the result', async () => {
    const open = vi.fn().mockResolvedValue({ type: 'success', url: 'myshop://checkout?session_id=cs_7CRIaOqGBtDY1J7ARiDLS7&status=paid' })
    expect(await openCheckout({ url, returnUrl: 'myshop://checkout', openAuthSession: open })).toEqual({ status: 'paid', sessionId: 'cs_7CRIaOqGBtDY1J7ARiDLS7' })
    expect(open).toHaveBeenCalledWith(url, 'myshop://checkout')
  })

  it('reports a closed sheet as dismissed', async () => {
    const open = vi.fn().mockResolvedValue({ type: 'cancel' })
    expect((await openCheckout({ url, returnUrl: 'myshop://checkout', openAuthSession: open })).status).toBe('dismissed')
  })

  it('refuses to open anything but a WuloPay payment page', async () => {
    const open = vi.fn()
    await expect(openCheckout({ url: 'https://evil.example/c/cs_1', returnUrl: 'myshop://checkout', openAuthSession: open })).rejects.toThrow()
    expect(open).not.toHaveBeenCalled()
  })

  it('treats unexpected statuses as unknown', () => {
    expect(parseCheckoutReturn('myshop://checkout?status=paid&session_id=bad')).toEqual({ status: 'paid', sessionId: null })
    expect(parseCheckoutReturn('myshop://checkout?status=hacked').status).toBe('unknown')
  })
})
