import type { Adapter } from "../types";
import { runPayuBolt } from "./gateways/payuBolt";
import { runPhonepeCheckout } from "./gateways/phonepeCheckout";

/**
 * Dispatches to a per-gateway implementation based on instruction.gateway.
 * Each one owns loading that gateway's own script (from its own CDN, never
 * mirrored) and translating its native callbacks into onSuccess / onFailure.
 * Adding a gateway here never changes the merchant-facing checkout() API.
 */
export const sdkModalAdapter: Adapter = {
  mode: "sdk_modal",
  run(instruction, context) {
    switch (instruction.gateway) {
      case "payu":
        runPayuBolt(instruction, context);
        return;
      case "phonepe":
        runPhonepeCheckout(instruction, context);
        return;
      default:
        context.onFailure({
          message: `Orcopay: "${instruction.gateway ?? "this gateway"}" checkout is not yet supported by this SDK version.`,
        });
    }
  },
};
