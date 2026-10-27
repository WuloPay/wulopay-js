export type Currency = 'ZAR'
export type SessionStatus = 'open' | 'processing' | 'paid' | 'expired' | 'cancelled'

export interface CreateCheckoutSessionParams {
  /** Currency units with at most 2 decimals, e.g. 149.99. */
  amount: number
  currency: Currency
  /** Your order id (max 64 characters). */
  reference: string
  /** https URL or an app deep link; http://localhost is accepted in sandbox only. */
  returnUrl: string
  cancelUrl?: string
  description?: string
  customer?: { email?: string; name?: string }
  /** Up to 20 string values, returned as given. */
  metadata?: Record<string, string>
  /** 5 to 1440, default 60. */
  expiresInMinutes?: number
}

export interface CheckoutSession {
  id: string
  object: 'checkout.session'
  environment: 'sandbox' | 'live'
  /** WuloPay's payment page; null once paid, expired or cancelled. */
  url: string | null
  status: SessionStatus
  reference: string
  description?: string | null
  amount: number
  currency: string
  customer?: { email?: string | null; name?: string | null } | null
  returnUrl: string
  cancelUrl: string
  metadata: Record<string, string>
  createdAt: string
  expiresAt: string
  paidAt?: string | null
  payment?: { reference: string; amount: number; cardBrand?: string | null; last4?: string | null; paidAt: string } | null
  refundedAmount: number
  lastPaymentError?: string | null
  paymentAttempts: number
}

export interface Refund {
  sessionId: string
  refundedThisTime: number
  totalRefunded: number
  remainingRefundable: number
}

export type WebhookEventType =
  | 'checkout.session.completed'
  | 'checkout.session.expired'
  | 'checkout.session.payment_failed'
  | 'refund.succeeded'
  | 'refund.failed'
  | 'webhook.test'

export interface WebhookEvent<T = unknown> {
  id: string
  type: WebhookEventType
  createdAt: string
  environment: 'sandbox' | 'live'
  data: { object: T }
}

/** Optional shared token cache (e.g. Redis) so separate processes reuse one access token. */
export interface TokenCache {
  get(key: string): Promise<string | null | undefined> | string | null | undefined
  set(key: string, token: string, ttlSeconds: number): Promise<void> | void
  delete(key: string): Promise<void> | void
}
