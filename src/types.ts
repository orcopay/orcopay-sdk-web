import type { Overlay } from "./ui/overlay";

export interface CustomerDetails {
  email?: string;
  phone?: string;
}

export interface CheckoutOptions {
  /** Base URL of the Orcopay API. Defaults to the production API. */
  apiBase?: string;
  amount: number;
  currency?: string;
  description?: string;
  customer?: CustomerDetails;
  onSuccess?: (result: CheckoutResult) => void;
  onFailure?: (error: CheckoutError) => void;
  onClose?: () => void;
}

export interface CheckoutResult {
  reference: string;
  mode: GatewayMode;
}

export interface CheckoutError {
  message: string;
  cause?: unknown;
}

/**
 * How the selected gateway's UI gets shown to the customer. Every gateway
 * Orcopay onboards maps to one of these, regardless of which underlying
 * PSP it is — that mapping is what lets a merchant integrate this one SDK
 * and support every gateway behind it.
 */
export type GatewayMode = "redirect" | "sdk_modal" | "upi_intent" | "hosted_fields";

/**
 * The normalized instruction every adapter consumes, regardless of what
 * shape the backend literally returned. See client.ts#normalizeInitiateResponse
 * for the one place backend-response quirks are absorbed.
 */
export interface GatewayInstruction {
  mode: GatewayMode;
  reference: string;
  redirectUrl?: string;
  gateway?: string;
  /** "test" or "live" — which of that gateway's environments this instruction's credentials belong to. */
  env?: "test" | "live";
  sdkParams?: Record<string, unknown>;
  intentUrl?: string;
  qrString?: string;
}

export interface AdapterContext {
  overlay: Overlay;
  /** Resolved Orcopay API base, for adapters that must confirm an outcome server-side. */
  apiBase: string;
  onSuccess: (result: CheckoutResult) => void;
  onFailure: (error: CheckoutError) => void;
  /** The customer backed out of the gateway's UI without paying. */
  onClose: () => void;
}

export interface Adapter {
  mode: GatewayMode;
  run(instruction: GatewayInstruction, context: AdapterContext): void;
}
