import { fetchPaymentStatus, type PaymentStatus } from "../../client";
import type { AdapterContext, GatewayInstruction } from "../../types";
import { loadScript } from "../loadScript";

const CHECKOUT_SCRIPT_URLS = {
  test: "https://mercury-stg.phonepe.com/web/bundle/checkout.js",
  live: "https://mercury.phonepe.com/web/bundle/checkout.js",
} as const;

// PhonePe's pay page can close a beat before the order reaches a terminal
// state, so give status a few tries before calling it still-pending.
const STATUS_ATTEMPTS = 5;
const STATUS_INTERVAL_MS = 2000;

interface PhonePeWindow extends Window {
  PhonePeCheckout?: {
    transact: (options: {
      tokenUrl: string;
      type: "IFRAME" | "REDIRECT";
      callback: (response: string) => void;
    }) => void;
  };
}

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

async function resolveOutcome(apiBase: string, reference: string): Promise<PaymentStatus> {
  for (let attempt = 0; attempt < STATUS_ATTEMPTS; attempt++) {
    const status = await fetchPaymentStatus(apiBase, "phonepe", reference);
    if (status !== "pending") return status;
    await sleep(STATUS_INTERVAL_MS);
  }
  return "pending";
}

export function runPhonepeCheckout(
  instruction: GatewayInstruction,
  { overlay, apiBase, onSuccess, onFailure, onClose }: AdapterContext,
) {
  const tokenUrl = instruction.sdkParams?.tokenUrl;
  if (typeof tokenUrl !== "string" || !tokenUrl) {
    onFailure({ message: "Orcopay: missing PhonePe checkout URL." });
    return;
  }

  // Unlike PayU's, PhonePe's callback only ever says the pay page closed
  // ("CONCLUDED") or was dismissed ("USER_CANCEL") — never whether money
  // moved. So the outcome comes from asking the gateway via Orcopay.
  const finish = async () => {
    try {
      const status = await resolveOutcome(apiBase, instruction.reference);
      if (status === "success") {
        onSuccess({ reference: instruction.reference, mode: "sdk_modal" });
      } else if (status === "failed") {
        onFailure({ message: "Orcopay: PhonePe payment failed." });
      } else {
        onFailure({
          message: "Orcopay: payment is still processing — confirm its status before retrying.",
        });
      }
    } catch (cause) {
      onFailure({ message: "Orcopay: could not confirm the payment status.", cause });
    }
  };

  loadScript(CHECKOUT_SCRIPT_URLS[instruction.env === "live" ? "live" : "test"])
    .then(() => {
      const phonepe = (window as PhonePeWindow).PhonePeCheckout;
      if (!phonepe) {
        onFailure({ message: "Orcopay: PhonePe checkout script did not initialize." });
        return;
      }

      // PhonePe's own pay page takes over from here — ours has done its job.
      overlay.destroy();

      phonepe.transact({
        tokenUrl,
        type: "IFRAME",
        callback: (response) => {
          if (response === "USER_CANCEL") {
            onClose();
          } else {
            void finish();
          }
        },
      });
    })
    .catch(() => {
      onFailure({ message: "Orcopay: could not load PhonePe's checkout script." });
    });
}
