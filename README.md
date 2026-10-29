# WuloPay JavaScript packages

Take card payments on WuloPay's secure payment page from Node.js, React, React Native and Capacitor apps.

| Package | npm | Install | Use it in |
|---|---|---|---|
| [`@wulopay/node`](packages/node) | [![npm](https://img.shields.io/npm/v/@wulopay/node)](https://www.npmjs.com/package/@wulopay/node) | `npm install @wulopay/node` | Your server (Node.js 22.12+): sessions, subscriptions, refunds, webhooks |
| [`@wulopay/react`](packages/react) | [![npm](https://img.shields.io/npm/v/@wulopay/react)](https://www.npmjs.com/package/@wulopay/react) | `npm install @wulopay/react` | React web apps (18+): a "Pay" button / hook |
| [`@wulopay/react-native`](packages/react-native) | [![npm](https://img.shields.io/npm/v/@wulopay/react-native)](https://www.npmjs.com/package/@wulopay/react-native) | `npm install @wulopay/react-native` | React Native / Expo apps |
| [`@wulopay/capacitor`](packages/capacitor) | [![npm](https://img.shields.io/npm/v/@wulopay/capacitor)](https://www.npmjs.com/package/@wulopay/capacitor) | `npm install @wulopay/capacitor` | Capacitor 8 / Ionic apps |

All packages are published with [npm provenance](https://docs.npmjs.com/generating-provenance-statements): check with
`npm audit signatures`.

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

**Subscriptions** work with the same front-end packages: your server creates a sign-up session (`mode: 'subscription'`)
or a card-update session with `@wulopay/node`, and the React, React Native and Capacitor packages open its `url` exactly
like a payment session. See [packages/node](packages/node#subscriptions).

## Develop

```
npm ci
npm run typecheck && npm test && npm run build
```

MIT licensed. Security problems: see [SECURITY.md](SECURITY.md).
