# Changelog

## 1.0.0
- `@wulopay/node`: checkout sessions (create with idempotency key, retrieve, cancel, refund), token caching and
  refresh, webhook signature verification, typed errors. Node.js 22.12+.
- `@wulopay/react`: `WuloPayButton`, `useWuloPayCheckout`, `getCheckoutReturn`. React 18+.
- `@wulopay/react-native`: `openCheckout` in the system browser sheet (pass Expo's `WebBrowser.openAuthSessionAsync`).
- `@wulopay/capacitor`: `openCheckout` with `@capacitor/browser` and `@capacitor/app` (Capacitor 8).
