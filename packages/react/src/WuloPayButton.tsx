import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useWuloPayCheckout, type UseWuloPayCheckoutOptions } from './useWuloPayCheckout.js'

export interface WuloPayButtonProps
  extends UseWuloPayCheckoutOptions, Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'onError' | 'type'> {
  children?: ReactNode
  /** Shown while the session is being created. */
  loadingText?: ReactNode
}

/** A plain button (style it with className/style) that creates a session through your backend and redirects to WuloPay. */
export function WuloPayButton({ createSession, allowedHosts, onError, redirect, children = 'Pay with WuloPay', loadingText = 'Redirecting…', disabled, ...rest }: WuloPayButtonProps) {
  const { startCheckout, loading } = useWuloPayCheckout({ createSession, allowedHosts, onError, redirect })
  return (
    <button type="button" {...rest} disabled={disabled || loading} aria-busy={loading} onClick={() => void startCheckout()}>
      {loading ? loadingText : children}
    </button>
  )
}
