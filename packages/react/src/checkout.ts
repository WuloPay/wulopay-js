/** WuloPay's payment page hosts. A session URL from anywhere else is refused unless you allow its host. */
export const WULOPAY_PAGE_HOSTS = ['pay.wulopay.com', 'pay-sandbox.wulopay.com']

export type CreateSession = () => Promise<{ url: string } | string>

/** Checks a session URL before sending the shopper to it. */
export function checkoutUrl(value: { url: string } | string, allowedHosts: string[] = WULOPAY_PAGE_HOSTS): string {
  const raw = typeof value === 'string' ? value : value?.url
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('createSession did not return a checkout URL.')
  }
  if (url.protocol !== 'https:' || !allowedHosts.includes(url.hostname)) {
    throw new Error(`Refusing to redirect to ${url.origin}: not a WuloPay payment page.`)
  }
  return url.toString()
}

export type ReturnStatus = 'paid' | 'cancelled' | 'expired'

export interface CheckoutReturn {
  sessionId: string | null
  /** What the shopper's browser was told. Display only: confirm the payment on your server. */
  status: ReturnStatus | null
}

/** Reads `?session_id=…&status=…` that WuloPay adds to your return and cancel URLs. */
export function getCheckoutReturn(search: string = typeof window !== 'undefined' ? window.location.search : ''): CheckoutReturn {
  const params = new URLSearchParams(search)
  const sessionId = params.get('session_id')
  const status = params.get('status')
  return {
    sessionId: sessionId && /^cs_[0-9A-Za-z]{10,40}$/.test(sessionId) ? sessionId : null,
    status: status === 'paid' || status === 'cancelled' || status === 'expired' ? status : null,
  }
}
