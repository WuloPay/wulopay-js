# WuloPay JavaScript packages

Take card payments on WuloPay's secure payment page from Node.js, React, React Native and Capacitor apps.

| Package | Use it in | What it does |
|---|---|---|
| [`@wulopay/node`](packages/node) | Your server (Node.js 22.12+) | Create checkout sessions, refunds, verify webhooks |
| [`@wulopay/react`](packages/react) | React web apps (18+) | A "Pay" button / hook that asks your server for a session and redirects |
| [`@wulopay/react-native`](packages/react-native) | React Native / Expo apps | Open checkout in the system browser sheet, get the result by deep link |
| [`@wulopay/capacitor`](packages/capacitor) | Capacitor 8 / Ionic apps | The same, with the Capacitor Browser and App plugins |

## How it fits together

```
React / mobile app            Your server (@wulopay/node)                WuloPay
"Pay" ------------------>    POST /checkout -> checkoutSessions.create -> { url }
open url (browser/sheet)  <-  { url }
shopper pays on WuloPay's page (card fields + 3-D Secure)
back to returnUrl (web page or app deep link) with ?session_id=…&status=…
                              webhook checkout.session.completed  <-      signed POST
                              mark the order paid
```

- The API key and secret stay on your server. The browser and mobile packages only open the URL your server gives them.
- The redirect back is never proof of payment: mark orders paid from the webhook or `checkoutSessions.retrieve()`.
- Card details are typed on WuloPay's page, in a real browser (never a WebView inside your app).

Sandbox base URL `https://sandbox.wulopay.com/api/v1`; test cards and the full API are in
[wulopay-openapi](https://github.com/WuloPay/wulopay-openapi). Developer sandbox keys: email api@wulopay.com.

## Develop

```
npm ci
npm run typecheck && npm test && npm run build
```

MIT licensed. Security problems: see [SECURITY.md](SECURITY.md).
