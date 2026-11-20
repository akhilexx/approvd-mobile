import { DEFAULT_POLICY, evaluate } from "./policy.js";

const KEY = "approvd-mobile-v2";

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return null;
}

function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function actionTitle(call, amount) {
  if (call.name === "create_payout") return `Payout $${amount} → ${call.args?.receiver ?? "unknown payee"}`;
  if (call.name === "create_refund") return `Refund $${amount} on ${call.args?.captureId ?? "capture"}`;
  return `${call.name} $${amount}`;
}

export function createStore() {
  const seed = load() || {
    policy: { ...DEFAULT_POLICY, payeeAllowlist: [...DEFAULT_POLICY.payeeAllowlist] },
    messages: [
      {
        id: "sys-0",
        role: "system",
        text: "Approvd is ready. Ask in plain English — policy decides, the model only proposes.",
      },
    ],
    approvals: [
      {
        id: "ap-demo-1",
        title: "Payout $85 → studio.supplies@mail.test",
        detail: "payee not on allowlist: studio.supplies@mail.test; 85 is above the 50 auto-approve threshold",
        call: { name: "create_payout", args: { amount: 85, receiver: "studio.supplies@mail.test" } },
        status: "pending",
        createdAt: Date.now() - 3600_000,
      },
    ],
    disputes: [
      {
        id: "PP-D-DEMO",
        captureId: "CAP-1001",
        amount: 45,
        reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
        status: "OPEN",
        note: "Buyer claims cracked lid. Refunds on this capture are denied until the dispute closes.",
      },
    ],
    captures: {
      "CAP-1001": { amount: 45, refunded: 0, openDisputeId: "PP-D-DEMO" },
      "CAP-1002": { amount: 60, refunded: 0 },
    },
    outflowLast24h: 85,
    ledger: [],
  };

  const listeners = new Set();
  const emit = () => {
    save(seed);
    listeners.forEach((fn) => fn(seed));
  };

  return {
    get: () => seed,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    addMessage(msg) {
      seed.messages.push({ id: msg.id || `m-${Date.now()}-${seed.messages.length}`, ...msg, at: Date.now() });
      emit();
    },
    setPolicy(patch) {
      seed.policy = { ...seed.policy, ...patch };
      if (patch.payeeAllowlist) seed.policy.payeeAllowlist = [...patch.payeeAllowlist];
      emit();
    },
    proposeAction(call, explanation, source) {
      const capture =
        call.name === "create_refund"
          ? seed.captures[call.args?.captureId || "CAP-1002"]
          : undefined;
      const decision = evaluate(call, seed.policy, {
        outflowLast24h: seed.outflowLast24h,
        capture,
      });
      const entry = {
        id: `led-${Date.now()}`,
        call,
        decision,
        explanation,
        source,
        at: Date.now(),
      };
      seed.ledger.unshift(entry);

      if (decision.verdict === "needs_approval") {
        seed.approvals.unshift({
          id: `ap-${Date.now()}`,
          title: actionTitle(call, decision.amount),
          detail: decision.reasons.join("; "),
          call,
          status: "pending",
          createdAt: Date.now(),
        });
      } else if (decision.verdict === "allow") {
        if (call.name === "create_payout" || call.name === "batch_payout") {
          seed.outflowLast24h = +(seed.outflowLast24h + decision.amount).toFixed(2);
        }
        if (call.name === "create_refund" && capture) {
          capture.refunded = +(capture.refunded + decision.amount).toFixed(2);
        }
      }
      emit();
      return { decision, entry };
    },
    resolveApproval(id, approve) {
      const a = seed.approvals.find((x) => x.id === id);
      if (!a || a.status !== "pending") return null;
      if (!approve) {
        a.status = "rejected";
        a.resolvedAt = Date.now();
        emit();
        return a;
      }
      const decision = evaluate(a.call, seed.policy, { outflowLast24h: seed.outflowLast24h });
      if (decision.verdict === "deny") {
        a.status = "blocked";
        a.detail = decision.reasons.join("; ");
        emit();
        return a;
      }
      a.status = "approved";
      a.resolvedAt = Date.now();
      if (a.call.name === "create_payout" || a.call.name === "batch_payout") {
        seed.outflowLast24h = +(seed.outflowLast24h + decision.amount).toFixed(2);
      }
      emit();
      return a;
    },
    resetDemo() {
      localStorage.removeItem(KEY);
      location.reload();
    },
  };
}
