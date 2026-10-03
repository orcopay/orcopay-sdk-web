import type { Adapter } from "../types";

/**
 * TODO: on mobile, trigger `instruction.intentUrl` (the upi://pay deep link
 * the selected gateway returned) via window.location.assign, which hands
 * off to the customer's UPI app. On desktop, render `instruction.qrString`
 * as a QR code inside the overlay card and start polling
 * GET /v1/collect/payments/{reference}/status until it resolves.
 */
export const upiIntentAdapter: Adapter = {
  mode: "upi_intent",
  run(_instruction, { onFailure }) {
    onFailure({ message: "Orcopay: UPI intent checkout is not yet supported by this SDK version." });
  },
};
