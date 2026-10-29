# @wulopay/node

WuloPay server library for Node.js 22.12+: hosted checkout sessions, subscriptions, refunds and signed webhooks. No dependencies.

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

## Subscriptions

Create a plan once, then send each new subscriber to a sign-up session. The shopper sees the terms, agrees, passes the
bank's check and pays the first charge (or nothing, during a free trial). The card is stored on WuloPay's side; you only
ever see a subscription id.

```ts
const plan = await wulopay.plans.create({ name: 'Gold monthly', amount: 49, interval: 'month', trialDays: 14 })

const signup = await wulopay.checkoutSessions.create({
  mode: 'subscription',
  subscription: { planId: plan.id, billingMode: 'wulopay' },   // WuloPay charges every month
  reference: customer.id,
  customer: { email: customer.email, name: customer.name },     // e-mail required: receipts and notices go there
  returnUrl: 'https://shop.example.co.za/account',
})
// webhook subscription.created → event.data.object.id is the subscription id
```

**Two billing modes**

- `wulopay`: WuloPay charges on the plan's schedule, retries failed payments (after 1, 3 and 5 days), e-mails the
  shopper (receipts, failed payment, trial ending) and gives them a page to update the card or cancel. You follow along by
  webhook: `subscription.charge_succeeded`, `subscription.charge_failed`, `subscription.past_due`,
  `subscription.cancelled` and others.
- `merchant` (default): your system decides when to charge (for example a WooCommerce Subscriptions renewal). Pass the
  most a later charge may be as `maxAmount` (shown to the shopper):

```ts
const charge = await wulopay.subscriptions.charge(subscriptionId, { idempotencyKey: `renewal-${order.id}`, amount: 49 })
if (charge.status === 'failed' && charge.retryAllowed === false) {
  // the card network says not to retry this card: ask the shopper for a new one
  const { url } = await wulopay.subscriptions.createCardUpdateSession(subscriptionId, { returnUrl: 'https://shop.example.co.za/account' })
}
```

The same idempotency key never charges twice. Other calls: `subscriptions.list({ status })`, `retrieve`,
`cancel(id, { atPeriodEnd })`, `pause`, `resume`, `charges(id)`, `createManageLink(id)` (a link to the shopper's own
subscription page, e.g. for your "My account" page). In the sandbox, `subscriptions.advance(id)` makes the next scheduled
charge happen now, and a plan of R 60.00 always declines, so you can test failures and retries.

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
