import { useCallback, useRef, useState } from 'react'
import { checkoutUrl, WULOPAY_PAGE_HOSTS, type CreateSession } from './checkout.js'

export interface UseWuloPayCheckoutOptions {
  /** Calls YOUR backend, which creates the session with its API key and returns `{ url }`. Never call WuloPay from the browser. */
  createSession: CreateSession
  /** Extra payment page hosts to allow (e.g. a staging host). */
  allowedHosts?: string[]
  onError?: (error: Error) => void
  /** Defaults to `window.location.assign`. */
  redirect?: (url: string) => void
}

export function useWuloPayCheckout({ createSession, allowedHosts, onError, redirect }: UseWuloPayCheckoutOptions) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const inFlight = useRef(false)

  const startCheckout = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setLoading(true)
    setError(null)
    try {
      const url = checkoutUrl(await createSession(), [...WULOPAY_PAGE_HOSTS, ...(allowedHosts ?? [])])
      ;(redirect ?? ((u: string) => window.location.assign(u)))(url)
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      setError(err)
      onError?.(err)
      inFlight.current = false
      setLoading(false)
    }
  }, [createSession, allowedHosts, onError, redirect])

  return { startCheckout, loading, error }
}
