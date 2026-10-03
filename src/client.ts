import type { CheckoutOptions, GatewayInstruction } from "./types";

const DEFAULT_API_BASE = "https://api.orcopay.com";

export function resolveApiBase(options: CheckoutOptions): string {
  return (options.apiBase ?? DEFAULT_API_BASE).replace(/\/+$/, "");
}

export type PaymentStatus = "success" | "failed" | "pending";

/**
 * Asks Orcopay (which asks the gateway) how an order actually ended. For
 * gateways whose in-page callback can't tell paid from failed — PhonePe's
 * only says the pay page closed — this is what onSuccess/onFailure rest on.
 */
export async function fetchPaymentStatus(
  apiBase: string,
  gateway: string,
  reference: string,
): Promise<PaymentStatus> {
  const url = `${apiBase}/v1/collect/payments/${encodeURIComponent(gateway)}/${encodeURIComponent(reference)}/status/`;
  const response = await fetch(url);
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.status === false) {
    throw new Error(body?.message ?? `Orcopay: status lookup failed (HTTP ${response.status}).`);
  }
  const status = body?.data?.status;
  return status === "success" || status === "failed" ? status : "pending";
}

export async function initiatePayment(options: CheckoutOptions): Promise<GatewayInstruction> {
  const apiBase = resolveApiBase(options);

  let response: Response;
  try {
    // v2 is the real gateway-initiation endpoint (PayU Bolt today, more
    // gateways/modes as orchestration lands) — v1 (payment-link) stays live
    // on the backend for now but the SDK targets v2 going forward.
    response = await fetch(`${apiBase}/v1/collect/payments/v2/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: options.amount,
        currency: options.currency ?? "INR",
        description: options.description,
        customer: options.customer ?? {},
      }),
    });
  } catch (cause) {
    throw new Error(`Orcopay: could not reach ${apiBase}. Check apiBase and your connection.`);
  }

  let body: Record<string, unknown>;
  try {
    body = await response.json();
  } catch {
    throw new Error(`Orcopay: unexpected response from ${apiBase} (HTTP ${response.status}).`);
  }

  if (!response.ok || body?.status === false) {
    const message = typeof body?.message === "string" ? body.message : undefined;
    throw new Error(message ?? `Orcopay: payment initiation failed (HTTP ${response.status}).`);
  }

  return normalizeInitiateResponse((body.data as Record<string, unknown>) ?? {});
}

/**
 * v2 returns a real `{ mode, gateway, sdk_params }` response already. The
 * legacy `{ txn_id, payment_link }` fallback below is kept only in case
 * something still points this SDK at the old v1 endpoint.
 */
function normalizeInitiateResponse(data: Record<string, unknown>): GatewayInstruction {
  if (typeof data.mode === "string") {
    return {
      mode: data.mode as GatewayInstruction["mode"],
      reference: String(data.reference ?? data.txn_id ?? ""),
      redirectUrl: data.redirect_url as string | undefined,
      gateway: data.gateway as string | undefined,
      env: normalizeEnv(data.env),
      sdkParams: data.sdk_params as Record<string, unknown> | undefined,
      intentUrl: data.intent_url as string | undefined,
      qrString: data.qr_string as string | undefined,
    };
  }

  if (typeof data.payment_link === "string") {
    return {
      mode: "redirect",
      reference: String(data.txn_id ?? ""),
      redirectUrl: data.payment_link,
    };
  }

  throw new Error("Orcopay: unrecognized response from payment initiation.");
}

/**
 * Accepts whatever synonym a backend deployment happens to use for
 * production ("live", "prod", "production") — a bare `=== "live"` check
 * here previously caused a real incident: a backend returning "prod"
 * silently fell back to test credentials/scripts with no error at all.
 * Anything not recognized as live defaults to "test", the safer failure.
 */
function normalizeEnv(value: unknown): GatewayInstruction["env"] {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return ["live", "prod", "production"].includes(normalized) ? "live" : "test";
}
