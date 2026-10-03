import type { Adapter } from "../types";

/**
 * Gateways with no embeddable UI (PayU payment links today; any hosted-page
 * PSP tomorrow). The branded loader + handoff delay before this runs is
 * handled centrally in index.ts#checkout — this only does the navigation.
 */
export const redirectAdapter: Adapter = {
  mode: "redirect",
  run(instruction, { onFailure }) {
    if (!instruction.redirectUrl) {
      onFailure({ message: "Orcopay: no redirect URL returned for this payment." });
      return;
    }
    window.location.assign(instruction.redirectUrl);
  },
};
