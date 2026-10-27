import { describe, expect, it } from 'vitest'
import {
  AuthenticationError, ConflictError, InvalidRequestError, NotFoundError, PermissionError, RateLimitError, WuloPay,
  type TokenCache,
} from '../src/index.js'

type Call = { url: string; init: RequestInit }
function fakeFetch(responses: Array<[number, unknown, Record<string, string>?]>) {
  const calls: Call[] = []
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    const next = responses.shift()
    if (!next) throw new Error('no response queued for ' + url)
    const [status, body, headers] = next
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers })
  }) as unknown as typeof fetch
  return { fn, calls }
}
const token = (t = 'tok1'): [number, unknown] => [200, { authToken: t, expiresIn: 3600, refreshToken: null }]
const json = (c: Call) => JSON.parse(String(c.init.body))
const header = (c: Call, name: string) => (c.init.headers as Record<string, string>)[name]

describe('WuloPay client', () => {
  it('creates a session with a token and an idempotency key', async () => {
    const f = fakeFetch([token(), [201, { id: 'cs_1', status: 'open', url: 'https://pay-sandbox.wulopay.com/c/cs_1' }]])
    const wulopay = new WuloPay({ keyId: 'wk_test', secret: 's', fetch: f.fn })
    const s = await wulopay.checkoutSessions.create({ amount: 149.999, currency: 'ZAR', reference: '1042', returnUrl: 'https://shop.example/r' }, { idempotencyKey: 'order-1042' })
    expect(s.id).toBe('cs_1')
    expect(f.calls[0].url).toBe('https://sandbox.wulopay.com/api/v1/Authorization/Token/ApiToken')
    expect(json(f.calls[0])).toEqual({ key: 'wk_test', secret: 's' })
    expect(f.calls[1].url).toBe('https://sandbox.wulopay.com/api/v1/Checkout/Sessions')
    expect(header(f.calls[1], 'Authorization')).toBe('Bearer tok1')
    expect(header(f.calls[1], 'Idempotency-Key')).toBe('order-1042')
    expect(json(f.calls[1]).amount).toBe(150)
    expect(f.calls[1].init.redirect).toBe('error')
  })

  it('reuses the token, and gets one token for concurrent first calls', async () => {
    const f = fakeFetch([token(), [200, { id: 'a' }], [200, { id: 'b' }], [200, { id: 'c' }]])
    const wulopay = new WuloPay({ keyId: 'k', secret: 's', fetch: f.fn })
    await Promise.all([wulopay.checkoutSessions.retrieve('a'), wulopay.checkoutSessions.retrieve('b')])
    await wulopay.checkoutSessions.retrieve('c')
    expect(f.calls.filter((c) => c.url.endsWith('/ApiToken'))).toHaveLength(1)
  })

  it('refreshes a refused token once', async () => {
    const f = fakeFetch([token('old'), [401, { error: 'expired' }], token('new'), [200, { id: 'cs_1', status: 'paid' }]])
    const s = await new WuloPay({ keyId: 'k', secret: 's', fetch: f.fn }).checkoutSessions.retrieve('cs_1')
    expect(s.status).toBe('paid')
    expect(header(f.calls[3], 'Authorization')).toBe('Bearer new')
  })

  it('shares tokens through a token cache', async () => {
    const items = new Map<string, string>()
    const cache: TokenCache = { get: (k) => items.get(k), set: (k, t) => void items.set(k, t), delete: (k) => void items.delete(k) }
    const f = fakeFetch([token('shared'), [200, { id: 'x' }], [200, { id: 'x' }]])
    await new WuloPay({ keyId: 'k', secret: 's', fetch: f.fn, tokenCache: cache }).checkoutSessions.retrieve('x')
    await new WuloPay({ keyId: 'k', secret: 's', fetch: f.fn, tokenCache: cache }).checkoutSessions.retrieve('x')
    expect(f.calls).toHaveLength(3)
    expect([...items.values()]).toEqual(['shared'])
  })

  it('sends {} for a full refund and the amount for a partial one', async () => {
    const f = fakeFetch([token(), [200, { sessionId: 'cs_1' }], [200, { sessionId: 'cs_1' }]])
    const wulopay = new WuloPay({ keyId: 'k', secret: 's', fetch: f.fn })
    await wulopay.checkoutSessions.refund('cs_1')
    await wulopay.checkoutSessions.refund('cs_1', { amount: 20, reason: 'Damaged' })
    expect(f.calls[1].init.body).toBe('{}')
    expect(json(f.calls[2])).toEqual({ amount: 20, reason: 'Damaged' })
  })

  it('encodes session ids in paths', async () => {
    const f = fakeFetch([token(), [200, { id: 'x' }]])
    await new WuloPay({ keyId: 'k', secret: 's', fetch: f.fn }).checkoutSessions.cancel('cs_1/../x')
    expect(f.calls[1].url).toBe('https://sandbox.wulopay.com/api/v1/Checkout/Sessions/cs_1%2F..%2Fx/Cancel')
  })

  it.each([
    [400, InvalidRequestError], [403, PermissionError], [404, NotFoundError], [409, ConflictError], [429, RateLimitError],
  ])('maps HTTP %i to its error', async (status, type) => {
    const f = fakeFetch([token(), [status, { error: 'Something specific.' }, { 'retry-after': '30' }]])
    const err = await new WuloPay({ keyId: 'k', secret: 's', fetch: f.fn }).checkoutSessions.retrieve('x').catch((e) => e)
    expect(err).toBeInstanceOf(type)
    expect(err.message).toBe('Something specific.')
    if (err instanceof RateLimitError) expect(err.retryAfter).toBe(30)
  })

  it('reads validation problem messages', async () => {
    const f = fakeFetch([token(), [400, { title: 'One or more validation errors occurred.', errors: { amount: ['The amount field is required.'] } }]])
    const err = await new WuloPay({ keyId: 'k', secret: 's', fetch: f.fn }).checkoutSessions.retrieve('x').catch((e) => e)
    expect(err.message).toBe('The amount field is required.')
  })

  it('raises AuthenticationError for a wrong key', async () => {
    const f = fakeFetch([[401, { error: 'Invalid API key and/or secret.' }]])
    await expect(new WuloPay({ keyId: 'k', secret: 'bad', fetch: f.fn }).checkoutSessions.retrieve('x')).rejects.toBeInstanceOf(AuthenticationError)
  })

  it('refuses a plain http base URL', () => {
    expect(() => new WuloPay({ keyId: 'k', secret: 's', baseUrl: 'http://example.com' })).toThrow(TypeError)
  })
})
