import { initiatePayment, resolveApiBase } from "./client";
import { Overlay } from "./ui/overlay";
import { getAdapter } from "./adapters";
import type { CheckoutOptions, CheckoutResult, CheckoutError } from "./types";

export type {
  CheckoutOptions,
  CheckoutResult,
  CheckoutError,
  CustomerDetails,
  GatewayMode,
  GatewayInstruction,
} from "./types";

// How long the branded loader holds on its mode-specific message before
// handing off to the gateway. One constant, applied identically regardless
// of which gateway or mode ends up running — adapters never set their own.
const HANDOFF_DELAY_MS = 550;

/**
 * Starts checkout: shows the Orcopay overlay, calls the merchant's Orcopay
 * payment (created via /v1/collect/payments/), then hands off to whichever
 * gateway's UI orchestration selected — a redirect, that gateway's own
 * modal, a UPI intent, or (once wired up) inline hosted card fields. One
 * integration, whichever of the onboarded gateways ends up handling it.
 */
export function checkout(options: CheckoutOptions): void {
  if (!options.amount || options.amount <= 0) {
    throw new Error("Orcopay.checkout: `amount` is required and must be greater than 0.");
  }

  const overlay = new Overlay(
    () => {
      options.onClose?.();
    },
    { amount: options.amount, currency: options.currency },
  );

  initiatePayment(options)
    .then((instruction) => {
      const adapter = getAdapter(instruction.mode);
      const context = {
        overlay,
        apiBase: resolveApiBase(options),
        onSuccess: (result: CheckoutResult) => {
          overlay.destroy();
          options.onSuccess?.(result);
        },
        onFailure: (error: CheckoutError) => {
          overlay.setError(error.message);
          options.onFailure?.(error);
        },
        onClose: () => {
          overlay.destroy();
          options.onClose?.();
        },
      };

      // Same branded beat before every handoff, no matter the gateway.
      overlay.setPhase(instruction.mode);
      window.setTimeout(() => adapter.run(instruction, context), HANDOFF_DELAY_MS);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Orcopay: something went wrong starting checkout.";
      overlay.setError(message);
      options.onFailure?.({ message, cause: error });
    });
}

export const Orcopay = { checkout };
export default Orcopay;
