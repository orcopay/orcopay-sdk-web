import type { AdapterContext, GatewayInstruction } from "../../types";
import { loadScript } from "../loadScript";

const BOLT_SCRIPT_URLS = {
  test: "https://jssdk-uat.payu.in/bolt/bolt.min.js",
  live: "https://jssdk.payu.in/bolt/bolt.min.js",
} as const;

interface BoltWindow extends Window {
  bolt?: {
    launch: (
      params: Record<string, unknown>,
      handlers: {
        responseHandler: (response: unknown) => void;
        catchException: (error: unknown) => void;
      },
    ) => void;
  };
}

export function runPayuBolt(instruction: GatewayInstruction, { overlay, onSuccess, onFailure }: AdapterContext) {
  if (!instruction.sdkParams) {
    onFailure({ message: "Orcopay: missing PayU checkout params." });
    return;
  }

  // Mismatching this with whichever credentials the backend signed the
  // request with (test vs. live) makes Bolt silently fail to render at
  // all — no error, just nothing happens. Defaults to test if the backend
  // didn't say, since that's the safer failure (a visible error) than
  // accidentally hitting live.
  const scriptUrl = BOLT_SCRIPT_URLS[instruction.env === "live" ? "live" : "test"];

  loadScript(scriptUrl)
    .then(() => {
      const bolt = (window as BoltWindow).bolt;
      if (!bolt) {
        onFailure({ message: "Orcopay: PayU checkout script did not initialize." });
        return;
      }

      // The branded loader + how long it holds before this point is owned
      // centrally by index.ts#checkout, identically for every gateway —
      // this only does the mechanical swap: our overlay out, PayU's in.
      overlay.destroy();

      bolt.launch(instruction.sdkParams!, {
        responseHandler: (response: any) => {
          const status = response?.response?.txnStatus;
          if (status === "SUCCESS") {
            onSuccess({ reference: instruction.reference, mode: "sdk_modal" });
          } else {
            onFailure({
              message: `Orcopay: PayU payment ${status ? status.toLowerCase() : "did not complete"}.`,
              cause: response,
            });
          }
        },
        catchException: (error: unknown) => {
          onFailure({ message: "Orcopay: PayU checkout could not be launched.", cause: error });
        },
      });
    })
    .catch(() => {
      onFailure({ message: "Orcopay: could not load PayU's checkout script." });
    });
}
