import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { constructEvent, SignatureVerificationError, verifySignature } from '../src/index.js'

const SECRET = 'whsec_test_secret'
const sign = (body: string, t: number, secret = SECRET) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`
const now = () => Math.floor(Date.now() / 1000)

describe('webhooks', () => {
  it("matches the signature WuloPay's backend produces", () => {
    // Produced by WuloPay's webhook signer (backend WebhookSecurity.Sign) for these inputs.
    expect(() => verifySignature('{"id":"evt_1"}', 't=1761580800,v1=4c2ff7297f164f83fa634d9f076ed86ea9641c694f6d2478350198fa6a4dce44', 'whsec_test', 0)).not.toThrow()
  })

  it('returns the event (string or Buffer body)', () => {
    const body = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: { id: 'cs_1', status: 'paid' } } })
    expect(constructEvent<{ id: string }>(body, sign(body, now()), SECRET).data.object.id).toBe('cs_1')
    expect(constructEvent(Buffer.from(body), sign(body, now()), SECRET).id).toBe('evt_1')
  })

  it('accepts any matching v1', () => {
    const body = '{"id":"evt_1","type":"webhook.test"}'
    const t = now()
    const header = `t=${t},v1=${'0'.repeat(64)},${sign(body, t).split(',')[1]}`
    expect(constructEvent(body, header, SECRET).id).toBe('evt_1')
  })

  it.each([
    ['a tampered body', (b: string) => [b.replace('evt_1', 'evt_2'), sign(b, now()), SECRET]],
    ['the wrong secret', (b: string) => [b, sign(b, now(), 'whsec_other'), SECRET]],
    ['a stale timestamp', (b: string) => [b, sign(b, now() - 600), SECRET]],
    ['a missing header', (b: string) => [b, '', SECRET]],
    ['an empty secret', (b: string) => [b, sign(b, now()), '']],
  ])('rejects %s', (_label, make) => {
    const [body, header, secret] = make('{"id":"evt_1","type":"x"}') as [string, string, string]
    expect(() => constructEvent(body, header, secret)).toThrow(SignatureVerificationError)
  })
})
