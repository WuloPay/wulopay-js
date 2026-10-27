# @wulopay/react

A "Pay" button and hook for WuloPay hosted checkout in React 18+. Your **backend** creates the session (with
`@wulopay/node` or any WuloPay library); the button asks it for the session URL and sends the shopper to WuloPay's
secure payment page. No API keys in the browser.

```
npm install @wulopay/react
```

```tsx
import { WuloPayButton } from '@wulopay/react'

<WuloPayButton
  className="btn btn-primary"
  createSession={() => fetch('/api/checkout', { method: 'POST', body: JSON.stringify({ orderId }) }).then((r) => r.json())}
  onError={(e) => toast(e.message)}>
  Pay R 149.99
</WuloPayButton>
```

Or the hook: `const { startCheckout, loading, error } = useWuloPayCheckout({ createSession })`.

For safety the button only redirects to WuloPay's payment pages (`pay.wulopay.com`, `pay-sandbox.wulopay.com`);
add others with `allowedHosts`.

On your return page, `getCheckoutReturn()` reads `?session_id=…&status=…` for display ("Thanks, we're confirming
your payment"). Mark the order paid on your server, from the webhook or by retrieving the session.
