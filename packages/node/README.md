# @wulopay/node

WuloPay server library for Node.js 22.12+: hosted checkout sessions, subscriptions, invoices, payment links, refunds and signed webhooks. No dependencies.

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

## Invoices and payment links

```ts
// WuloPay works out the tax and total from the lines (here R1,250 + 15% VAT = R1,437.50) and e-mails the customer.
const invoice = await wulopay.invoices.create({
  reference: 'INV-2026-0042',
  customer: { name: 'Jane Doe', email: 'jane@example.com' },
  lineItems: [{ name: 'Website design', unitPrice: 1250, taxRate: 15 }],
  dueDate: '2026-11-30',
}, { idempotencyKey: 'INV-2026-0042' })
// invoice.amount === 1437.5, invoice.url is the customer's payment page; listen for the invoice.paid webhook.

// A link you share yourself; maxPayments: 1 makes it single use.
const link = await wulopay.paymentLinks.create({ description: 'Workshop ticket', amount: 150, maxPayments: 40 })
```

Prices exclude tax unless `pricesIncludeTax: true`; `shipping` and `discount` are optional. Other calls:
`invoices.list({ status })`, `retrieve`, `send` (resend the e-mail), `cancel`; `paymentLinks.list`, `retrieve`
(`timesPaid`, `amountCollected`), `cancel`. Webhooks: `invoice.paid`, `invoice.expired`, `payment_link.paid`.
Scopes: `invoices.create` for invoices, `links.purchase.create` for links.

## Saved cards

Name each shopper with your own `customerReference`. Cards are saved on WuloPay's page, so card numbers never reach
your server. Keys need `wallet.read` and `wallet.write` (and `checkout.sessions.create` to pay).

```ts
// 1. Save a card: the bank checks it, nothing is charged. Send the shopper to session.url.
const save = await wulopay.checkoutSessions.create({
  mode: 'save_card', customerReference: 'customer-1042', reference: 'save-1042',
  returnUrl: 'https://shop.example.co.za/account/cards',
})
// Or let the shopper save the card while paying: add saveCard: true and customerReference to a payment session.

// 2. Show their cards (card.saved tells you when one is added).
const cards = await wulopay.wallet.listCards('customer-1042')
await wulopay.wallet.updateCard('customer-1042', cards[0].id, { nickname: 'Personal', isDefault: true })

// 3. Pay with a saved card: open payment.url for the shopper, who confirms with 3-D Secure.
const payment = await wulopay.wallet.pay('customer-1042', cards[0].id,
  { amount: 149.99, reference: '1043', returnUrl: 'https://shop.example.co.za/checkout/return' },
  { idempotencyKey: 'order-1043' })
// Then confirm from checkout.session.completed, or wulopay.checkoutSessions.retrieve(payment.sessionId).

// Remove a card, or a shopper with all their cards.
await wulopay.wallet.removeCard('customer-1042', cards[0].id)
await wulopay.wallet.deleteCustomer('customer-1042')
```

`card.expiring` arrives 30 days before a card expires and `card.expired` after. Saving the same card again replaces
the old one (`card.saved` lists it in `replaces`).

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
