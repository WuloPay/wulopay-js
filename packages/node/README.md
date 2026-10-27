# @wulopay/node

WuloPay server library for Node.js 22.12+: hosted checkout sessions, refunds and signed webhooks. No dependencies.

```
npm install @wulopay/node
```

```ts
import { WuloPay } from '@wulopay/node'

const wulopay = new WuloPay({ keyId: process.env.WULOPAY_KEY_ID!, secret: process.env.WULOPAY_SECRET! })

// POST /checkout on your server
const session = await wulopay.checkoutSessions.create({
  amount: 149.99,
  currency: 'ZAR',
  reference: order.id,
  returnUrl: 'https://shop.example.co.za/checkout/return',   // or an app link, e.g. myshop://checkout
  cancelUrl: 'https://shop.example.co.za/cart',
  metadata: { orderId: order.id },
}, { idempotencyKey: `order-${order.id}` })
res.json({ url: session.url })                                 // the browser or app opens this
```

## Webhooks (Express)

```ts
import express from 'express'
import { constructEvent, SignatureVerificationError } from '@wulopay/node'

app.post('/webhooks/wulopay', express.raw({ type: 'application/json' }), (req, res) => {
  let event
  try {
    event = constructEvent(req.body, req.header('WuloPay-Signature'), process.env.WULOPAY_WEBHOOK_SECRET!)
  } catch (e) {
    if (e instanceof SignatureVerificationError) return res.sendStatus(400)
    throw e
  }
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object   // status "paid"; handle each event.id once
  }
  res.sendStatus(200)
})
```

Use the **raw** body: a parsed and re-serialised JSON body won't match the signature.

## Refunds, cancelling, errors

```ts
await wulopay.checkoutSessions.refund(id)                          // everything still refundable
await wulopay.checkoutSessions.refund(id, { amount: 20, reason: 'Damaged' })
await wulopay.checkoutSessions.cancel(id)
```

Errors extend `WuloPayError` (`.status`, `.message` from the API): `InvalidRequestError`, `AuthenticationError`,
`PermissionError`, `NotFoundError`, `ConflictError`, `RateLimitError` (`.retryAfter`), `ApiConnectionError`
(safe to retry with the same idempotency key).

Tokens are fetched and renewed for you. With several processes, pass `tokenCache` (any `get`/`set`/`delete` store,
e.g. Redis) so they share one token. The client uses the sandbox by default; WuloPay gives you the live URL
(`baseUrl`) when your account goes live.
