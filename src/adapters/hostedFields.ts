import type { Adapter } from "../types";

/**
 * TODO: renders a tokenization vault's card fields (see SDK README —
 * "hosted fields" design note) inline inside context.overlay's card, styled
 * to match the merchant's page. Only reachable once a vault provider is
 * wired up server-side; card data must never pass through this SDK's own
 * fetch/client.ts.
 */
export const hostedFieldsAdapter: Adapter = {
  mode: "hosted_fields",
  run(_instruction, { onFailure }) {
    onFailure({ message: "Orcopay: card checkout is not yet supported by this SDK version." });
  },
};
