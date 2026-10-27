import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { assertCheckoutUrl, isReturnUrl, parseCheckoutReturn, type CheckoutResult } from './result.js'

export { parseCheckoutReturn, WULOPAY_PAGE_HOSTS } from './result.js'
export type { CheckoutResult } from './result.js'

export interface OpenCheckoutOptions {
  /** The session `url` your backend got from WuloPay (never create sessions in the app). */
  url: string
  /**
   * The app link your backend used as the session's returnUrl (and cancelUrl), e.g. `myshop://checkout` or an
   * https App Link / Universal Link. The app must be set up to open it (iOS URL scheme or associated domain,
   * Android intent filter).
   */
  returnUrl: string
  /** Extra payment page hosts to allow (e.g. a staging host). */
  allowedHosts?: string[]
}

/**
 * Opens WuloPay hosted checkout in the in-app browser (SFSafariViewController / Custom Tabs) and resolves when
 * the payment page sends the shopper back to `returnUrl`, or with `dismissed` if the shopper closes the browser.
 */
export async function openCheckout({ url, returnUrl, allowedHosts }: OpenCheckoutOptions): Promise<CheckoutResult> {
  assertCheckoutUrl(url, allowedHosts)
  return new Promise<CheckoutResult>((resolve, reject) => {
    let settled = false
    const handles: Array<{ remove: () => Promise<void> }> = []
    const finish = (result: CheckoutResult, closeBrowser: boolean) => {
      if (settled) return
      settled = true
      for (const h of handles) void h.remove()
      if (closeBrowser) void Browser.close().catch(() => {})
      resolve(result)
    }
    ;(async () => {
      handles.push(await App.addListener('appUrlOpen', (event) => {
        if (isReturnUrl(event.url, returnUrl)) finish(parseCheckoutReturn(event.url), true)
      }))
      handles.push(await Browser.addListener('browserFinished', () => finish({ status: 'dismissed', sessionId: null }, false)))
      await Browser.open({ url, presentationStyle: 'popover' })
    })().catch((e) => {
      if (settled) return
      settled = true
      for (const h of handles) void h.remove()
      reject(e)
    })
  })
}
