# @wulopay/capacitor

Open WuloPay hosted checkout from a Capacitor 8 / Ionic app in the in-app browser (SFSafariViewController / Custom
Tabs) and get the result back by deep link.

```
npm install @wulopay/capacitor @capacitor/browser @capacitor/app
npx cap sync
```

```ts
import { openCheckout } from '@wulopay/capacitor'

// Your backend creates the session with returnUrl and cancelUrl set to your app link, e.g. "myshop://checkout"
const { url } = await api.post('/checkout', { orderId })
const result = await openCheckout({ url, returnUrl: 'myshop://checkout' })
// result.status: 'paid' | 'cancelled' | 'expired' | 'dismissed' | 'unknown'
await api.get(`/orders/${orderId}`)   // the real status comes from your backend (webhook / retrieve)
```

The app must open the link: an iOS URL scheme (or Universal Link) and an Android intent filter for it.
