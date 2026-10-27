# @wulopay/react-native

Open WuloPay hosted checkout from a React Native or Expo app in the system browser sheet (ASWebAuthenticationSession
on iOS, Custom Tabs on Android) and get the result back by deep link. Card details are typed in a trusted browser,
never in a WebView inside your app.

```
npx expo install expo-web-browser
npm install @wulopay/react-native
```

```ts
import * as WebBrowser from 'expo-web-browser'
import { openCheckout } from '@wulopay/react-native'

// Your backend creates the session with returnUrl and cancelUrl set to your app link, e.g. "myshop://checkout"
const { url } = await api.post('/checkout', { orderId })
const result = await openCheckout({ url, returnUrl: 'myshop://checkout', openAuthSession: WebBrowser.openAuthSessionAsync })
// result.status: 'paid' | 'cancelled' | 'expired' | 'dismissed' | 'unknown'
await api.get(`/orders/${orderId}`)   // the real status comes from your backend (webhook / retrieve)
```

Register the app link scheme (Expo: `scheme` in app.json). Without Expo, pass any function with the same shape as
`openAuthSessionAsync(url, redirectUrl)`.
