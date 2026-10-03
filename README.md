# @orcopay/sdk

One checkout integration for merchants. Whichever gateway Orcopay's orchestration
picks for a given transaction, this SDK renders the right UI for it — the
merchant never integrates against PayU, Razorpay, etc. directly.

## Usage

```html
<script src="https://cdn.orcopay.com/orcopay.global.js"></script>
<script>
  Orcopay.checkout({
    apiBase: "https://api.orcopay.com", // or your local backend while developing
    amount: 499,
    customer: { email: "customer@example.com", phone: "9999999999" },
    onSuccess(result) {
      // result.reference, result.mode
    },
    onFailure(error) {
      // error.message
    },
    onClose() {
      // customer dismissed the overlay before completing payment
    },
  });
</script>
```

Or as a module:

```ts
import { checkout } from "@orcopay/sdk";

checkout({ amount: 499, customer: { email, phone } });
```

## How it works

`checkout()` shows a small overlay, calls
`POST {apiBase}/v1/collect/payments/` to create the payment, then dispatches
to one of the adapters in `src/adapters/` based on the normalized `mode` the
backend returns:

| mode            | what the customer sees                                            | status        |
| ---------------- | ------------------------------------------------------------------- | ------------- |
| `redirect`       | full-page navigation to the gateway's own hosted page (PayU today)  | implemented   |
| `sdk_modal`      | the gateway's own native checkout script, loaded from its own CDN   | stub — TODO |
| `upi_intent`     | UPI deep link on mobile, QR code on desktop                         | stub — TODO |
| `hosted_fields`  | tokenization-vault card fields, styled inline, no gateway UI at all | stub — TODO |

Adding a new gateway means adding a case inside the relevant adapter (e.g. a
new `sdkModal.<gateway>.ts` dispatched on `instruction.gateway`), never
touching the merchant-facing `checkout()` API.

## Backend contract

Today's live backend (`collect/views.py`) only returns the legacy PayU
payment-link shape `{ txn_id, payment_link }`, which `client.ts` normalizes
into `{ mode: "redirect", ... }`. Once orchestration returns a real `mode`
per transaction, only `normalizeInitiateResponse` in `src/client.ts` needs
to change — nothing else in this SDK assumes PayU or a single gateway.

## Rules this SDK follows

- Never collects or transmits raw card data itself (see `hostedFields.ts`) —
  keeps Orcopay out of full PCI-DSS scope. Card fields, when implemented,
  belong to a PCI-certified vault, not this codebase.
- Always loads a gateway's own script from that gateway's own CDN, never a
  mirrored/self-hosted copy.
- One normalized `GatewayInstruction` shape into every adapter, so gateway
  differences stay inside `src/adapters/`, never leak into `checkout()`.

## Build

```bash
npm install
npm run build   # dist/orcopay.esm.js, orcopay.cjs, orcopay.global.js, orcopay.d.ts
```
