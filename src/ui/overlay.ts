import type { GatewayMode } from "../types";

let stylesInjected = false;

function injectStylesOnce() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.textContent = `
.orcopay-overlay { position: fixed; inset: 0; z-index: 2147483000; display: flex; align-items: center; justify-content: center; background: rgba(15, 17, 21, 0.55); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; opacity: 0; animation: orcopay-fade-in 0.2s ease forwards; }
.orcopay-overlay--leaving { animation: orcopay-fade-out 0.18s ease forwards; }
.orcopay-card { position: relative; width: min(340px, 90vw); background: #fff; border-radius: 16px; padding: 36px 24px 28px; box-shadow: 0 24px 70px rgba(0,0,0,0.28); display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; opacity: 0; transform: translateY(16px) scale(0.96); animation: orcopay-card-in 0.32s cubic-bezier(0.22, 1, 0.36, 1) 0.05s forwards; }
.orcopay-card--error { background: #fff5f5; }

.orcopay-close { position: absolute; top: 10px; right: 12px; border: none; background: transparent; font-size: 20px; line-height: 1; color: #9ca3af; cursor: pointer; padding: 4px 8px; border-radius: 6px; transition: color 0.15s ease, background 0.15s ease; }
.orcopay-close:hover { color: #111827; background: #f3f4f6; }

.orcopay-orbit { position: relative; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; margin-bottom: 2px; }
.orcopay-ring { position: absolute; inset: 0; border-radius: 50%; border: 2px solid transparent; border-top-color: #6366f1; border-right-color: #6366f1; animation: orcopay-spin 1.1s linear infinite; }
.orcopay-ring--2 { inset: 8px; border-top-color: #a5b4fc; border-right-color: transparent; border-left-color: #a5b4fc; animation: orcopay-spin-reverse 1.6s linear infinite; }
.orcopay-core { position: relative; width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 600; box-shadow: 0 6px 18px rgba(99, 102, 241, 0.35); }
.orcopay-card--error .orcopay-orbit { animation: none; }
.orcopay-card--error .orcopay-ring { display: none; }
.orcopay-card--error .orcopay-core { background: linear-gradient(135deg, #ef4444, #f97316); box-shadow: 0 6px 18px rgba(239, 68, 68, 0.35); }

.orcopay-kicker { margin: 0; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #6366f1; }
.orcopay-card--error .orcopay-kicker { color: #ef4444; }
.orcopay-title { margin: 0; font-size: 17px; font-weight: 650; color: #111827; }
.orcopay-detail { margin: 0; font-size: 13.5px; color: #6b7280; line-height: 1.5; min-height: 1.5em; }

.orcopay-steps { display: flex; gap: 6px; margin-top: 2px; }
.orcopay-steps span { width: 20px; height: 4px; border-radius: 2px; background: #e5e7eb; transition: background 0.25s ease, width 0.25s ease; }
.orcopay-steps span.on { background: #6366f1; width: 26px; }
.orcopay-steps span.done { background: #a5b4fc; }

.orcopay-amount { margin: 6px 0 0; font-size: 20px; font-weight: 700; color: #111827; }

@keyframes orcopay-spin { to { transform: rotate(360deg); } }
@keyframes orcopay-spin-reverse { to { transform: rotate(-360deg); } }
@keyframes orcopay-fade-in { to { opacity: 1; } }
@keyframes orcopay-fade-out { to { opacity: 0; } }
@keyframes orcopay-card-in { to { opacity: 1; transform: translateY(0) scale(1); } }
`;
  document.head.append(style);
}

// Phases are keyed by GatewayMode (plus the initial "connecting" state) so
// every gateway gets identical loader treatment automatically — the copy
// lives here once, centrally, never per-adapter. See checkout() in index.ts
// for where the phase transition + handoff delay is actually driven from.
export type OverlayPhase = "connecting" | GatewayMode;

interface PhaseCopy {
  kicker: string;
  title: string;
  detail: string;
  step: 0 | 1 | 2;
  icon: string;
}

const PHASE_COPY: Record<OverlayPhase, PhaseCopy> = {
  connecting: {
    kicker: "Orcopay",
    title: "Payment initiated",
    detail: "Connecting to your payment provider…",
    step: 0,
    icon: "₹",
  },
  redirect: {
    kicker: "Almost there",
    title: "Redirecting to gateway",
    detail: "Handing you off to the payment provider…",
    step: 2,
    icon: "↗",
  },
  sdk_modal: {
    kicker: "Almost there",
    title: "Opening secure checkout",
    detail: "Loading the payment screen…",
    step: 2,
    icon: "🔒",
  },
  upi_intent: {
    kicker: "Almost there",
    title: "Opening UPI",
    detail: "Launching your UPI app…",
    step: 2,
    icon: "🔒",
  },
  hosted_fields: {
    kicker: "Almost there",
    title: "Loading payment form",
    detail: "Setting up secure card fields…",
    step: 2,
    icon: "🔒",
  },
};

export interface OverlayOptions {
  amount?: number;
  currency?: string;
}

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * The only UI this SDK renders itself. Every adapter's job past this point
 * is either to hand off to a gateway's own UI (redirect / sdk_modal /
 * upi_intent) or, for hosted_fields, to render inline inside this card.
 */
export class Overlay {
  private root: HTMLDivElement;
  private card: HTMLDivElement;
  private core: HTMLDivElement;
  private kickerEl: HTMLParagraphElement;
  private titleEl: HTMLHeadingElement;
  private detailEl: HTMLParagraphElement;
  private stepEls: HTMLSpanElement[];

  constructor(onClose: () => void, options: OverlayOptions = {}) {
    injectStylesOnce();

    this.root = document.createElement("div");
    this.root.className = "orcopay-overlay";
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-modal", "true");

    this.card = document.createElement("div");
    this.card.className = "orcopay-card";

    const closeBtn = document.createElement("button");
    closeBtn.className = "orcopay-close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", () => {
      onClose();
      this.destroy();
    });

    const orbit = document.createElement("div");
    orbit.className = "orcopay-orbit";
    const ring1 = document.createElement("span");
    ring1.className = "orcopay-ring";
    const ring2 = document.createElement("span");
    ring2.className = "orcopay-ring orcopay-ring--2";
    this.core = document.createElement("div");
    this.core.className = "orcopay-core";
    orbit.append(ring1, ring2, this.core);

    this.kickerEl = document.createElement("p");
    this.kickerEl.className = "orcopay-kicker";

    this.titleEl = document.createElement("h2");
    this.titleEl.className = "orcopay-title";

    this.detailEl = document.createElement("p");
    this.detailEl.className = "orcopay-detail";

    const steps = document.createElement("div");
    steps.className = "orcopay-steps";
    steps.setAttribute("aria-hidden", "true");
    this.stepEls = [0, 1, 2].map(() => {
      const span = document.createElement("span");
      steps.append(span);
      return span;
    });

    this.card.append(closeBtn, orbit, this.kickerEl, this.titleEl, this.detailEl, steps);

    if (typeof options.amount === "number") {
      const amountEl = document.createElement("p");
      amountEl.className = "orcopay-amount";
      amountEl.textContent = formatAmount(options.amount, options.currency ?? "INR");
      this.card.append(amountEl);
    }

    this.root.append(this.card);
    document.body.append(this.root);

    this.setPhase("connecting");
  }

  setPhase(phase: OverlayPhase) {
    const copy = PHASE_COPY[phase];
    this.kickerEl.textContent = copy.kicker;
    this.titleEl.textContent = copy.title;
    this.detailEl.textContent = copy.detail;
    this.core.textContent = copy.icon;
    this.stepEls.forEach((el, i) => {
      el.classList.toggle("on", i === copy.step);
      el.classList.toggle("done", i < copy.step);
    });
  }

  setError(text: string) {
    this.card.classList.add("orcopay-card--error");
    this.kickerEl.textContent = "Couldn’t start";
    this.titleEl.textContent = "Payment failed";
    this.detailEl.textContent = text;
    this.core.textContent = "!";
  }

  destroy() {
    this.root.classList.add("orcopay-overlay--leaving");
    window.setTimeout(() => this.root.remove(), 180);
  }
}
