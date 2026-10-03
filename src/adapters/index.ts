import type { Adapter, GatewayMode } from "../types";
import { redirectAdapter } from "./redirect";
import { sdkModalAdapter } from "./sdkModal";
import { upiIntentAdapter } from "./upiIntent";
import { hostedFieldsAdapter } from "./hostedFields";

const adapters: Record<GatewayMode, Adapter> = {
  redirect: redirectAdapter,
  sdk_modal: sdkModalAdapter,
  upi_intent: upiIntentAdapter,
  hosted_fields: hostedFieldsAdapter,
};

export function getAdapter(mode: GatewayMode): Adapter {
  const adapter = adapters[mode];
  if (!adapter) {
    throw new Error(`Orcopay: unknown checkout mode "${mode}".`);
  }
  return adapter;
}
