/** WuloPay's payment page hosts. A session URL from anywhere else is refused unless you allow its host. */
export const WULOPAY_PAGE_HOSTS = ['pay.wulopay.com', 'pay-sandbox.wulopay.com']

export interface CheckoutResult {
  /**
   * What the payment page reported when it sent the shopper back: `paid`, `cancelled` or `expired`;
   * `dismissed` when the shopper closed the browser sheet; `unknown` otherwise.
   * Display only: ask YOUR backend for the session's real status before treating an order as paid.
   */
  status: 'paid' | 'cancelled' | 'expired' | 'dismissed' | 'unknown'
  sessionId: string | null
}

export function assertCheckoutUrl(url: string, allowedHosts: string[] = []): void {
  let u: URL
  try { u = new URL(url) } catch { throw new Error('Not a checkout URL.') }
  if (u.protocol !== 'https:' || ![...WULOPAY_PAGE_HOSTS, ...allowedHosts].includes(u.hostname)) {
    throw new Error(`Refusing to open ${u.origin}: not a WuloPay payment page.`)
  }
}

/** Reads the deep link WuloPay opened (your returnUrl or cancelUrl plus ?session_id=…&status=…). */
export function parseCheckoutReturn(url: string): CheckoutResult {
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1).split('#')[0] : ''
  const params = new URLSearchParams(query)
  const id = params.get('session_id')
  const status = params.get('status')
  return {
    sessionId: id && /^cs_[0-9A-Za-z]{10,40}$/.test(id) ? id : null,
    status: status === 'paid' || status === 'cancelled' || status === 'expired' ? status : 'unknown',
  }
}

/** True when `url` is the app link the checkout should come back to (same scheme, host and path prefix). */
export function isReturnUrl(url: string, returnUrl: string): boolean {
  const base = returnUrl.split('?')[0].replace(/\/+$/, '').toLowerCase()
  const candidate = url.split('?')[0].replace(/\/+$/, '').toLowerCase()
  return candidate === base || candidate.startsWith(base + '/')
}
