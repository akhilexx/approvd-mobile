/**
 * Hybrid inference wrapper for #BuildHybridAI.
 * - Prefer on-device Gemini Nano (Chrome Prompt API via Firebase AI Logic)
 * - Fall back to cloud Gemini
 * - Offline mock planner when VITE_AI_MODE=mock or Firebase is not configured
 *
 * Firebase AI Logic is imported and called at runtime when configured
 * (required by the hackathon — not just named in the README).
 */

import { hasFirebaseConfig, initFirebaseAI } from "./firebase.js";
import { policySummary } from "./policy.js";

/** @typedef {"on-device" | "cloud" | "mock"} InferenceSource */

let firebaseBundle = null;
let deviceReady = false;

export async function warmHybrid() {
  if (import.meta.env.VITE_AI_MODE === "mock" || !hasFirebaseConfig()) {
    return { mode: "mock", deviceReady: false };
  }
  firebaseBundle = await initFirebaseAI();
  if (!firebaseBundle) return { mode: "mock", deviceReady: false };
  try {
    if (typeof firebaseBundle.model.initializeDeviceModel === "function") {
      await firebaseBundle.model.initializeDeviceModel((p) => {
        console.info("on-device model progress", p);
      });
      deviceReady = true;
    }
  } catch (err) {
    console.warn("initializeDeviceModel failed; cloud fallback still available", err?.message || err);
  }
  return { mode: "firebase", deviceReady };
}

/**
 * Deterministic offline planner — maps a few demo phrases to tool proposals.
 * Used when Firebase is unset, or as a safety net.
 */
export function mockPlan(userText, policy) {
  const t = userText.toLowerCase();
  let call = null;
  if (/refund/.test(t) && /dispute|disputed/.test(t)) {
    call = { name: "create_refund", args: { amount: 12, captureId: "CAP-1001" } };
  } else if (/refund/.test(t)) {
    const m = t.match(/\$?\s*(\d+(?:\.\d+)?)/);
    call = { name: "create_refund", args: { amount: m ? Number(m[1]) : 12, captureId: "CAP-1002" } };
  } else if (/pay|payout|send/.test(t)) {
    const m = t.match(/\$?\s*(\d+(?:\.\d+)?)/);
    const email = (t.match(/[\w.+-]+@[\w.-]+/) || [])[0] || "asha@example.com";
    call = { name: "create_payout", args: { amount: m ? Number(m[1]) : 20, receiver: email } };
  } else if (/policy|limit|threshold/.test(t)) {
    return {
      source: /** @type {InferenceSource} */ ("mock"),
      explanation: policySummary(policy),
      call: null,
    };
  } else {
    return {
      source: /** @type {InferenceSource} */ ("mock"),
      explanation:
        "I can propose payouts and refunds. Try: “Pay asha@example.com $20”, “Refund $12 on CAP-1002”, or “Refund $12 on the disputed capture”.",
      call: null,
    };
  }

  const explanation = `Proposed ${call.name} for $${call.args.amount}. Policy will decide allow / needs_approval / deny — the model cannot override limits.`;
  return { source: /** @type {InferenceSource} */ ("mock"), explanation, call };
}

/**
 * Ask the hybrid model to explain a proposed action in plain English.
 * On-device path is single-turn text (Nano); cloud can be richer.
 */
export async function explainAndPropose(userText, policy) {
  if (import.meta.env.VITE_AI_MODE === "mock" || !firebaseBundle) {
    return mockPlan(userText, policy);
  }

  const prompt = [
    "You are Approvd, a spend-policy assistant for small merchants.",
    "Reply with JSON only: {\"explanation\": string, \"call\": null | {\"name\": \"create_payout\"|\"create_refund\"|\"capture_order\", \"args\": object}}.",
    "Never claim you can bypass policy. Do not invent capture ids.",
    `Current policy: ${policySummary(policy)}`,
    `User: ${userText}`,
  ].join("\n");

  try {
    const result = await firebaseBundle.model.generateContent(prompt);
    const text = result?.response?.text?.() ?? result?.response?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const source =
      result?.inferenceSource === "on-device" || result?.response?.inferenceSource === "on-device"
        ? "on-device"
        : "cloud";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { source, explanation: text.slice(0, 800) || "No structured proposal.", call: null };
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      source,
      explanation: String(parsed.explanation || text).slice(0, 1200),
      call: parsed.call || null,
    };
  } catch (err) {
    console.warn("Firebase generateContent failed; using mock planner", err?.message || err);
    const fallback = mockPlan(userText, policy);
    fallback.explanation = `(cloud/on-device error → mock) ${fallback.explanation}`;
    return fallback;
  }
}

export function sourceLabel(source) {
  if (source === "on-device") return "AI: on-device (Gemini Nano)";
  if (source === "cloud") return "AI: cloud (Firebase AI Logic)";
  return "AI: offline mock planner";
}
