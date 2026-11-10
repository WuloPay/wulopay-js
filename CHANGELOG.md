# Changelog

## @wulopay/node 1.3.0
- `Currency` also accepts `'NAD'`, `'BWP'`, `'LSL'` and `'SZL'` (Namibia, Botswana, Lesotho, eSwatini). The sandbox
  accepts all five; in live, currencies other than ZAR are enabled per merchant on request.
- The other packages are unchanged.

## @wulopay/node 1.2.0
- Invoices (`invoices`: create with idempotency key, list, retrieve, send, cancel) and payment links (`paymentLinks`:
  create, list, retrieve, cancel), for API v1.2.0. WuloPay works out invoice totals from the lines; amounts are rounded
  to cents before sending. Types for `invoice.paid`, `invoice.expired` and `payment_link.paid`, and `invoiceId` /
  `paymentLinkId` on checkout sessions. Tested live against the sandbox.
- The other packages are unchanged (1.0.0).

## @wulopay/node 1.1.0
- Subscriptions: `plans` (create, list, retrieve); sign-up sessions with `mode: 'subscription'`; `subscriptions` (list,
  retrieve, cancel, pause, resume, charge with a required idempotency key, charges, card-update sessions, manage links,
  sandbox `advance`); types for the subscription webhook events.
- The other packages are unchanged (1.0.0): they open sign-up and card-update session URLs like payment sessions.

## 1.0.0
- `@wulopay/node`: checkout sessions (create with idempotency key, retrieve, cancel, refund), token caching and
  refresh, webhook signature verification, typed errors. Node.js 22.12+.
- `@wulopay/react`: `WuloPayButton`, `useWuloPayCheckout`, `getCheckoutReturn`. React 18+.
- `@wulopay/react-native`: `openCheckout` in the system browser sheet (pass Expo's `WebBrowser.openAuthSessionAsync`).
- `@wulopay/capacitor`: `openCheckout` with `@capacitor/browser` and `@capacitor/app` (Capacitor 8).
