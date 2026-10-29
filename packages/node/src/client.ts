import { createHash } from 'node:crypto'
import {
  ApiConnectionError, AuthenticationError, ConflictError, InvalidRequestError, NotFoundError,
  PermissionError, RateLimitError, WuloPayError,
} from './errors.js'
import type {
  CardUpdateSession, CheckoutSession, CreateCheckoutSessionParams, CreatePlanParams, ManageLink, Plan, Refund, Subscription,
  SubscriptionCharge, SubscriptionStatus, TokenCache,
} from './types.js'

export const VERSION = '1.1.0'
export const SANDBOX_BASE_URL = 'https://sandbox.wulopay.com/api/v1'

export interface WuloPayOptions {
  /** API key id ("wk_…"). Server-side only. */
  keyId: string
  secret: string
  /** Defaults to the sandbox; WuloPay gives you the live URL when your account goes live. */
  baseUrl?: string
  timeoutMs?: number
  /** Share tokens between processes (the token endpoint is rate limited). */
  tokenCache?: TokenCache
  /** Custom fetch (tests, proxies). Defaults to the global fetch. */
  fetch?: typeof fetch
}

interface RawResponse { status: number; headers: Headers; body: string }

/**
 * WuloPay API client. Use it on your server only: the key and secret must never reach a browser or a mobile app.
 *
 *   const wulopay = new WuloPay({ keyId: process.env.WULOPAY_KEY_ID!, secret: process.env.WULOPAY_SECRET! })
 *   const session = await wulopay.checkoutSessions.create({ ... }, { idempotencyKey: `order-${order.id}` })
 */
export class WuloPay {
  readonly checkoutSessions: CheckoutSessions
  readonly plans: Plans
  readonly subscriptions: Subscriptions
  private readonly keyId: string
  private readonly secret: string
  private readonly baseUrl: string
  private readonly timeoutMs: number
  private readonly tokenCache?: TokenCache
  private readonly fetchImpl: typeof fetch
  private token: string | null = null
  private tokenExpiresAt = 0
  private pendingToken: Promise<string> | null = null

  constructor(options: WuloPayOptions) {
    if (!options?.keyId || !options?.secret) throw new TypeError('Both keyId and secret are required.')
    const baseUrl = (options.baseUrl ?? SANDBOX_BASE_URL).replace(/\/+$/, '')
    if (!baseUrl.startsWith('https://')) throw new TypeError('baseUrl must start with https://')
    this.keyId = options.keyId
    this.secret = options.secret
    this.baseUrl = baseUrl
    this.timeoutMs = options.timeoutMs ?? 30_000
    this.tokenCache = options.tokenCache
    this.fetchImpl = options.fetch ?? globalThis.fetch
    if (typeof this.fetchImpl !== 'function') throw new TypeError('No fetch implementation available (Node.js 22+ has one).')
    this.checkoutSessions = new CheckoutSessions(this)
    this.plans = new Plans(this)
    this.subscriptions = new Subscriptions(this)
  }

  /** @internal Calls the API with a bearer token, refreshing it once if the API refuses it. */
  async request<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
    let res = await this.send(method, path, body, { ...headers, Authorization: `Bearer ${await this.accessToken()}` })
    if (res.status === 401) {
      await this.forgetToken()
      res = await this.send(method, path, body, { ...headers, Authorization: `Bearer ${await this.accessToken()}` })
    }
    return decode<T>(res)
  }

  private async accessToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token
    if (this.pendingToken) return this.pendingToken
    this.pendingToken = (async () => {
      try {
        const key = this.cacheKey()
        const cached = this.tokenCache ? await this.tokenCache.get(key) : null
        if (cached) {
          this.token = cached
          this.tokenExpiresAt = Date.now() + 60_000   // re-check the shared cache at least every minute
          return cached
        }
        const data = decode<{ authToken?: string; expiresIn?: number }>(
          await this.send('POST', '/Authorization/Token/ApiToken', { key: this.keyId, secret: this.secret }, {}))
        if (!data.authToken) throw new AuthenticationError('WuloPay did not return an access token.', 401)
        const ttl = Math.max(60, (data.expiresIn ?? 3600) - 120)   // renew 2 minutes early
        this.token = data.authToken
        this.tokenExpiresAt = Date.now() + ttl * 1000
        if (this.tokenCache) await this.tokenCache.set(key, data.authToken, ttl)
        return data.authToken
      } finally {
        this.pendingToken = null
      }
    })()
    return this.pendingToken
  }

  private async forgetToken(): Promise<void> {
    this.token = null
    this.tokenExpiresAt = 0
    if (this.tokenCache) await this.tokenCache.delete(this.cacheKey())
  }

  private cacheKey(): string {
    return 'wulopay_token_' + createHash('sha256').update(`${this.baseUrl}|${this.keyId}`).digest('hex').slice(0, 24)
  }

  private async send(method: string, path: string, body: unknown, headers: Record<string, string>): Promise<RawResponse> {
    const init: RequestInit = {
      method,
      headers: { Accept: 'application/json', 'User-Agent': `wulopay-node/${VERSION} node/${process.versions.node}`, ...headers },
      redirect: 'error',
      signal: AbortSignal.timeout(this.timeoutMs),
    }
    if (body !== undefined) {
      init.body = JSON.stringify(body)
      ;(init.headers as Record<string, string>)['Content-Type'] = 'application/json'
    }
    try {
      const res = await this.fetchImpl(this.baseUrl + path, init)
      return { status: res.status, headers: res.headers, body: await res.text() }
    } catch (e) {
      throw new ApiConnectionError(`Could not reach WuloPay: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
}

function errorMessage(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined
  const d = data as { error?: unknown; errors?: Record<string, unknown>; title?: unknown }
  if (typeof d.error === 'string') return d.error
  for (const messages of Object.values(d.errors ?? {})) {
    if (Array.isArray(messages) && typeof messages[0] === 'string') return messages[0]
  }
  return typeof d.title === 'string' ? d.title : undefined
}

function decode<T>(res: RawResponse): T {
  let data: unknown = {}
  if (res.body) {
    try { data = JSON.parse(res.body) } catch { data = undefined }
  }
  if (res.status >= 200 && res.status < 300) {
    if (!data || typeof data !== 'object') throw new WuloPayError('WuloPay returned an unexpected response.', res.status)
    return data as T
  }
  const message = errorMessage(data) ?? `WuloPay request failed with HTTP ${res.status}.`
  switch (res.status) {
    case 400: throw new InvalidRequestError(message, 400)
    case 401: throw new AuthenticationError(message, 401)
    case 403: throw new PermissionError(message, 403)
    case 404: throw new NotFoundError(message, 404)
    case 409: throw new ConflictError(message, 409)
    case 429: {
      const retry = res.headers.get('retry-after')
      throw new RateLimitError(message, retry ? Number(retry) : undefined)
    }
    default: throw new WuloPayError(message, res.status)
  }
}

/** Checkout sessions: one per order; send the shopper to `url`. */
export class CheckoutSessions {
  constructor(private readonly client: WuloPay) {}

  /** Reuse the same idempotency key when retrying the same order, so only one session is created. */
  create(params: CreateCheckoutSessionParams, options: { idempotencyKey?: string } = {}): Promise<CheckoutSession> {
    const body = params.amount === undefined ? { ...params } : { ...params, amount: Math.round(Number(params.amount) * 100) / 100 }
    const headers: Record<string, string> = options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}
    return this.client.request<CheckoutSession>('POST', '/Checkout/Sessions', body, headers)
  }

  retrieve(id: string): Promise<CheckoutSession> {
    return this.client.request<CheckoutSession>('GET', `/Checkout/Sessions/${encodeURIComponent(id)}`)
  }

  cancel(id: string): Promise<CheckoutSession> {
    return this.client.request<CheckoutSession>('POST', `/Checkout/Sessions/${encodeURIComponent(id)}/Cancel`)
  }

  /** Refunds a paid session: everything still refundable when `amount` is left out. */
  refund(id: string, options: { amount?: number; reason?: string } = {}): Promise<Refund> {
    const body: Record<string, unknown> = {}
    if (options.amount !== undefined) body.amount = Math.round(options.amount * 100) / 100
    if (options.reason) body.reason = options.reason
    return this.client.request<Refund>('POST', `/Checkout/Sessions/${encodeURIComponent(id)}/Refunds`, body)
  }
}

/** Plans: what a subscription charges and how often. */
export class Plans {
  constructor(private readonly client: WuloPay) {}

  create(params: CreatePlanParams): Promise<Plan> {
    return this.client.request<Plan>('POST', '/Billing/Plans', { ...params, amount: Math.round(Number(params.amount) * 100) / 100 })
  }

  list(): Promise<Plan[]> {
    return this.client.request<Plan[]>('GET', '/Billing/Plans')
  }

  retrieve(id: string): Promise<Plan> {
    return this.client.request<Plan>('GET', `/Billing/Plans/${encodeURIComponent(id)}`)
  }
}

/**
 * Subscriptions, created when a sign-up session (mode "subscription") is paid. In merchant billing your system calls
 * `charge` when a renewal is due; in WuloPay billing WuloPay charges on schedule and you follow along by webhook.
 */
export class Subscriptions {
  constructor(private readonly client: WuloPay) {}

  list(options: { status?: SubscriptionStatus; limit?: number } = {}): Promise<{ object: 'list'; data: Subscription[] }> {
    const q = new URLSearchParams()
    if (options.status) q.set('status', options.status)
    if (options.limit) q.set('limit', String(options.limit))
    const qs = q.toString()
    return this.client.request('GET', `/Billing/Subscriptions${qs ? `?${qs}` : ''}`)
  }

  retrieve(id: string): Promise<Subscription> {
    return this.client.request<Subscription>('GET', `/Billing/Subscriptions/${encodeURIComponent(id)}`)
  }

  /** Now, or (WuloPay billing) at the end of the paid period. */
  cancel(id: string, options: { atPeriodEnd?: boolean } = {}): Promise<Subscription> {
    return this.client.request<Subscription>('POST', `/Billing/Subscriptions/${encodeURIComponent(id)}/Cancel`, { atPeriodEnd: options.atPeriodEnd === true })
  }

  /** WuloPay billing: stop charging until resumed (missed periods are skipped). */
  pause(id: string): Promise<Subscription> {
    return this.client.request<Subscription>('POST', `/Billing/Subscriptions/${encodeURIComponent(id)}/Pause`, {})
  }

  resume(id: string): Promise<Subscription> {
    return this.client.request<Subscription>('POST', `/Billing/Subscriptions/${encodeURIComponent(id)}/Resume`, {})
  }

  /**
   * Merchant billing: charge the stored card now. `idempotencyKey` is required (e.g. your renewal order id): a retry with
   * the same key returns the same charge and never charges twice. A declined charge resolves with `status: "failed"`.
   */
  charge(id: string, options: { idempotencyKey: string; amount?: number }): Promise<SubscriptionCharge> {
    if (!options?.idempotencyKey) throw new TypeError('idempotencyKey is required (e.g. your renewal order id).')
    const body = options.amount === undefined ? {} : { amount: Math.round(options.amount * 100) / 100 }
    return this.client.request<SubscriptionCharge>('POST', `/Billing/Subscriptions/${encodeURIComponent(id)}/Charges`, body,
      { 'Idempotency-Key': options.idempotencyKey })
  }

  /** Charge history, newest first (cycle 1 is the sign-up payment). */
  charges(id: string): Promise<SubscriptionCharge[]> {
    return this.client.request<SubscriptionCharge[]>('GET', `/Billing/Subscriptions/${encodeURIComponent(id)}/Charges`)
  }

  /** A payment-page link where the shopper replaces the card (3-D Secure; nothing is charged). */
  createCardUpdateSession(id: string, options: { returnUrl: string }): Promise<CardUpdateSession> {
    return this.client.request<CardUpdateSession>('POST', `/Billing/Subscriptions/${encodeURIComponent(id)}/CardUpdateSession`, { returnUrl: options.returnUrl })
  }

  /** A fresh link to the shopper's own subscription page. The previous link stops working. */
  createManageLink(id: string): Promise<ManageLink> {
    return this.client.request<ManageLink>('POST', `/Billing/Subscriptions/${encodeURIComponent(id)}/ManageLink`, {})
  }

  /** Sandbox only: make the next scheduled charge (or the end of the trial) due now and run it. */
  advance(id: string): Promise<Subscription> {
    return this.client.request<Subscription>('POST', `/Billing/Subscriptions/${encodeURIComponent(id)}/Advance`, {})
  }
}
