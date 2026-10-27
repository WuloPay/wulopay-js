import { beforeEach, describe, expect, it, vi } from 'vitest'

const listeners: Record<string, (e: { url: string }) => void> = {}
const removed: string[] = []
vi.mock('@capacitor/app', () => ({
  App: { addListener: vi.fn(async (name: string, cb: (e: { url: string }) => void) => { listeners['app:' + name] = cb; return { remove: async () => { removed.push(name) } } }) },
}))
vi.mock('@capacitor/browser', () => ({
  Browser: {
    open: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    addListener: vi.fn(async (name: string, cb: () => void) => { listeners['browser:' + name] = cb as never; return { remove: async () => { removed.push(name) } } }),
  },
}))
const { Browser } = await import('@capacitor/browser')
const { openCheckout } = await import('../src/index.js')
const url = 'https://pay.wulopay.com/c/cs_7CRIaOqGBtDY1J7ARiDLS7'
const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => { vi.clearAllMocks(); removed.length = 0 })

describe('@wulopay/capacitor', () => {
  it('opens the browser and resolves from the app link, then closes the browser', async () => {
    const result = openCheckout({ url, returnUrl: 'myshop://checkout' })
    await flush()
    expect(Browser.open).toHaveBeenCalledWith({ url, presentationStyle: 'popover' })
    listeners['app:appUrlOpen']({ url: 'myshop://other?status=paid' })        // not ours: ignored
    listeners['app:appUrlOpen']({ url: 'myshop://checkout?session_id=cs_7CRIaOqGBtDY1J7ARiDLS7&status=paid' })
    expect(await result).toEqual({ status: 'paid', sessionId: 'cs_7CRIaOqGBtDY1J7ARiDLS7' })
    expect(Browser.close).toHaveBeenCalled()
    expect(removed.sort()).toEqual(['appUrlOpen', 'browserFinished'])
  })

  it('reports a closed browser as dismissed', async () => {
    const result = openCheckout({ url, returnUrl: 'myshop://checkout' })
    await flush()
    listeners['browser:browserFinished']({ url: '' })
    expect((await result).status).toBe('dismissed')
  })

  it('refuses to open anything but a WuloPay payment page', async () => {
    await expect(openCheckout({ url: 'http://pay.wulopay.com/c/cs_1', returnUrl: 'myshop://checkout' })).rejects.toThrow()
    expect(Browser.open).not.toHaveBeenCalled()
  })
})
