import { createHmac, timingSafeEqual } from 'node:crypto'
import { SignatureVerificationError } from './errors.js'
import type { WebhookEvent } from './types.js'

export const DEFAULT_TOLERANCE_SECONDS = 300

/**
 * Verifies a webhook from WuloPay and returns the event. Pass the raw request body exactly as received
 * (e.g. `express.raw({ type: 'application/json' })`), the `WuloPay-Signature` header and your endpoint's signing secret.
 */
export function constructEvent<T = unknown>(
  payload: string | Buffer,
  signatureHeader: string | undefined | null,
  secret: string,
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS,
): WebhookEvent<T> {
  const body = typeof payload === 'string' ? payload : payload.toString('utf8')
  verifySignature(body, signatureHeader, secret, toleranceSeconds)
  let event: unknown
  try {
    event = JSON.parse(body)
  } catch {
    throw new SignatureVerificationError('The webhook body is not valid JSON.')
  }
  if (!event || typeof event !== 'object' || !('id' in event) || !('type' in event)) {
    throw new SignatureVerificationError('The webhook body is not a WuloPay event.')
  }
  return event as WebhookEvent<T>
}

export function verifySignature(body: string, signatureHeader: string | undefined | null, secret: string,
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS): void {
  if (!secret) throw new SignatureVerificationError('No webhook signing secret is configured.')
  let timestamp: number | undefined
  const signatures: string[] = []
  for (const part of (signatureHeader ?? '').split(',')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const key = part.slice(0, i).trim()
    const value = part.slice(i + 1).trim()
    if (key === 't' && /^\d+$/.test(value)) timestamp = Number(value)
    else if (key === 'v1') signatures.push(value)
  }
  if (timestamp === undefined || signatures.length === 0) {
    throw new SignatureVerificationError('The WuloPay-Signature header is missing or malformed.')
  }
  if (toleranceSeconds > 0 && Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) {
    throw new SignatureVerificationError('The webhook timestamp is outside the allowed tolerance.')
  }
  const expected = Buffer.from(createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex'), 'utf8')
  const ok = signatures.some((s) => {
    const given = Buffer.from(s, 'utf8')
    return given.length === expected.length && timingSafeEqual(given, expected)
  })
  if (!ok) throw new SignatureVerificationError('The webhook signature does not match.')
}
