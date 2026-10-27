import { assertCheckoutUrl, parseCheckoutReturn, type CheckoutResult } from './result.js'

export { parseCheckoutReturn, WULOPAY_PAGE_HOSTS } from './result.js'
export type { CheckoutResult } from './result.js'

/** Same shape as Expo's `WebBrowser.openAuthSessionAsync` (and compatible auth-session helpers). */
export type OpenAuthSession = (url: string, redirectUrl: string) => Promise<{ type: string; url?: string }>

export interface OpenCheckoutOptions {
  /** The session `url` your backend got from WuloPay (never create sessions in the app). */
  url: string
  /** The app deep link your backend used as the session's returnUrl, e.g. `myshop://checkout`. */
  returnUrl: string
  /**
   * Opens the URL in the system browser sheet and resolves when the app link is reached. With Expo:
   * `import * as WebBrowser from 'expo-web-browser'` and pass `WebBrowser.openAuthSessionAsync`.
   */
  openAuthSession: OpenAuthSession
  /** Extra payment page hosts to allow (e.g. a staging host). */
  allowedHosts?: string[]
}

/**
 * Opens WuloPay hosted checkout in the system browser sheet (ASWebAuthenticationSession on iOS, Custom Tabs on
 * Android), so card entry happens in a trusted browser, never in a WebView inside your app.
 */
export async function openCheckout({ url, returnUrl, openAuthSession, allowedHosts }: OpenCheckoutOptions): Promise<CheckoutResult> {
  assertCheckoutUrl(url, allowedHosts)
  const result = await openAuthSession(url, returnUrl)
  if (result.type === 'success' && result.url) return parseCheckoutReturn(result.url)
  if (result.type === 'cancel' || result.type === 'dismiss') return { status: 'dismissed', sessionId: null }
  return { status: 'unknown', sessionId: null }
}
