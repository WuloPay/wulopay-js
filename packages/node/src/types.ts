export type Currency = 'ZAR'
export type SessionStatus = 'open' | 'processing' | 'paid' | 'expired' | 'cancelled'

export interface CreateCheckoutSessionParams {
  /** Currency units with at most 2 decimals, e.g. 149.99. Optional in subscription mode (the plan amount is used). */
  amount?: number
  /** Optional in subscription mode (the plan currency is used). */
  currency?: Currency
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
  /** "subscription" makes this a sign-up: the payment is the first charge (or a free trial) and the card is stored. */
  mode?: 'payment' | 'subscription'
  /** Required in subscription mode. `customer.email` is required too. */
  subscription?: {
    planId: string
    /** "wulopay": WuloPay charges on the plan's schedule. "merchant" (default): your system calls `subscriptions.charge`. */
    billingMode?: BillingMode
    /** Merchant billing: the most one later charge may be (shown to the shopper). Default: the plan amount. */
    maxAmount?: number
    /** Merchant billing: what the shopper pays today when it differs from the plan amount (sign-up fee, part period);
     *  0 checks and stores the card without charging. Not with a plan that has trialDays. */
    firstAmount?: number
  }
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
  mode: 'payment' | 'subscription'
  /** Subscription mode only; `subscriptionId` is set once the sign-up is paid. */
  subscription?: { planId: string; billingMode: BillingMode; maxAmount?: number | null; subscriptionId?: string | null } | null
  /** Set when the session pays an invoice. */
  invoiceId?: string | null
  /** Set when the session pays a payment link. */
  paymentLinkId?: string | null
}

export type BillingMode = 'wulopay' | 'merchant'
export type PlanInterval = 'day' | 'week' | 'month' | 'year'

export interface CreatePlanParams {
  /** Shown to the shopper (max 120). */
  name: string
  amount: number
  currency?: Currency
  interval: PlanInterval
  /** Charge every N intervals (1 to 12, or 1 to 365 for days; default 1). */
  intervalCount?: number
  /** Number of charges including the first; null or left out = until cancelled. */
  cycles?: number | null
  /** Free days before the first charge (0 to 365). The card is checked and stored at sign-up. */
  trialDays?: number
}

export interface Plan {
  id: string
  object: 'plan'
  name: string
  amount: number
  currency: string
  interval: PlanInterval
  intervalCount: number
  cycles: number | null
  trialDays: number
  active: boolean
  createdAt: string
}

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'paused' | 'cancelled' | 'completed'

export interface Subscription {
  id: string
  object: 'subscription'
  status: SubscriptionStatus
  billingMode: BillingMode
  planId: string | null
  planName: string | null
  checkoutSessionId: string
  /** Your reference from the sign-up session. */
  reference: string | null
  amount: number
  maxAmount: number
  currency: string
  interval: PlanInterval
  intervalCount: number
  cycles: number | null
  chargesSucceeded: number
  lastChargeAt: string | null
  nextChargeAt: string | null
  cardBrand: string | null
  last4: string | null
  /** API responses only; never in webhooks. */
  customer?: { email?: string | null; name?: string | null } | null
  /** The exact terms the shopper agreed to. */
  mandate: string | null
  mandateAcceptedAt: string
  cancelAtPeriodEnd: boolean
  cancelledAt: string | null
  cancellationReason: 'requested_by_merchant' | 'requested_by_customer' | 'payment_failed' | null
  trialEndsAt: string | null
  failedAttempts: number
  pastDueSince: string | null
  createdAt: string
}

export interface SubscriptionCharge {
  id: string
  object: 'subscription.charge'
  subscriptionId: string
  cycle: number
  status: 'succeeded' | 'failed' | 'pending'
  amount: number
  currency: string
  /** Safe to show the shopper. */
  failureMessage: string | null
  /** false when the card network says not to retry this card: ask the shopper to update it. */
  retryAllowed: boolean | null
  createdAt: string
  completedAt: string | null
}

/** A payment-page link where the shopper saves a new card (nothing is charged). */
export interface CardUpdateSession {
  id: string
  object: 'checkout.session'
  url: string
  subscriptionId: string
  expiresAt: string
}

/** The shopper's own subscription page (update card, cancel). Only the latest link works. */
export interface ManageLink {
  object: 'subscription.manage_link'
  url: string
  expiresAt: string
}

// ---- invoices and payment links (API v1.2.0)

/** A line on an invoice or payment link. WuloPay works out its tax and total. */
export interface LineItemParams {
  name: string
  sku?: string
  description?: string
  /** Default 1. */
  quantity?: number
  /** One unit, excluding tax unless `pricesIncludeTax`. */
  unitPrice: number
  /** Percent, e.g. 15 for VAT. Ignored when `taxAmount` is given. */
  taxRate?: number
  /** The line's tax as an amount, instead of a rate. */
  taxAmount?: number
  /** An amount off this line. */
  discount?: number
}

export interface LineItem {
  name: string
  sku?: string | null
  description?: string | null
  quantity: number
  unitPrice: number
  discount: number
  taxRate?: number | null
  tax: number
  /** What the line adds to the total, tax included. */
  total: number
}

/** A payment made through an invoice or link: its checkout session (refund with `checkoutSessions.refund`). */
export interface LinkPayment {
  sessionId: string
  amount: number
  cardBrand?: string | null
  last4?: string | null
  paidAt?: string | null
  amountRefunded: number
}

export interface CreateInvoiceParams {
  /** Your invoice number; default INV-yyMMdd-XXXXXX. */
  reference?: string
  description?: string
  currency?: Currency
  customer: { name: string; email: string; id?: string; company?: string }
  /** Recommended: WuloPay works out the tax and total from the lines. */
  lineItems?: LineItemParams[]
  pricesIncludeTax?: boolean
  shipping?: { amount: number; taxRate?: number }
  /** An amount off the invoice total. */
  discount?: number
  /** Optional with lineItems (checked against WuloPay's total); required without them. */
  amount?: number
  /** yyyy-MM-dd, shown to the customer. */
  dueDate?: string
  /** yyyy-MM-dd: payable until the end of this day (South African time). Default 30 days after dueDate or today. */
  expiresOn?: string
  /** E-mail the invoice to the customer now (default true). */
  send?: boolean
  metadata?: Record<string, string>
}

export type InvoiceStatus = 'open' | 'paid' | 'cancelled' | 'expired'

export interface Invoice {
  id: string
  object: 'invoice'
  environment: 'sandbox' | 'live'
  /** The customer's payment page. */
  url: string
  status: InvoiceStatus
  reference: string
  description?: string | null
  currency: string
  customer: { name: string; email: string; id?: string | null; company?: string | null }
  lineItems: LineItem[]
  subtotal?: number | null
  tax?: number | null
  shipping?: number | null
  discount?: number | null
  /** Amount due. */
  amount: number
  amountPaid: number
  dueDate?: string | null
  expiresAt?: string | null
  sentAt?: string | null
  paidAt?: string | null
  cancelledAt?: string | null
  payment?: LinkPayment | null
  metadata: Record<string, string>
  createdAt: string
}

export interface CreatePaymentLinkParams {
  /** Your reference; default LINK-yyMMdd-XXXXXX. */
  reference?: string
  description?: string
  currency?: Currency
  /** The price; or give lineItems and WuloPay adds them up (both: they must agree). */
  amount?: number
  lineItems?: LineItemParams[]
  pricesIncludeTax?: boolean
  /** ISO 8601 date-time. */
  expiresAt?: string
  /** Stop after this many payments (1 = single use). */
  maxPayments?: number
  metadata?: Record<string, string>
}

export type PaymentLinkStatus = 'active' | 'completed' | 'cancelled' | 'expired'

export interface PaymentLink {
  id: string
  object: 'payment_link'
  environment: 'sandbox' | 'live'
  url: string
  /** completed = maxPayments reached. */
  status: PaymentLinkStatus
  reference: string
  description?: string | null
  currency: string
  amount: number
  lineItems: LineItem[]
  maxPayments?: number | null
  timesPaid: number
  amountCollected: number
  lastPaidAt?: string | null
  expiresAt?: string | null
  cancelledAt?: string | null
  /** Only in the payment_link.paid webhook: the payment that triggered it. */
  payment?: LinkPayment | null
  metadata: Record<string, string>
  createdAt: string
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
  | 'subscription.created'
  | 'subscription.charge_succeeded'
  | 'subscription.charge_failed'
  | 'subscription.past_due'
  | 'subscription.trial_ending'
  | 'subscription.card_updated'
  | 'subscription.paused'
  | 'subscription.resumed'
  | 'subscription.cancel_scheduled'
  | 'subscription.cancelled'
  | 'subscription.completed'
  | 'invoice.paid'
  | 'invoice.expired'
  | 'payment_link.paid'
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
