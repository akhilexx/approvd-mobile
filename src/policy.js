/**
 * Spend-policy engine (model proposes; code decides).
 * Ported as ideas from the Approvd web agent — no PayPal credentials or sandbox secrets.
 */

export const DEFAULT_POLICY = Object.freeze({
  maxPerAction: 500,
  approvalThreshold: 50,
  dailyOutflowCap: 1000,
  payeeAllowlist: ["asha@example.com", "ravi@example.com"],
  blockedTools: [],
});

const rank = { allow: 0, needs_approval: 1, deny: 2 };

export function allowlisted(email, allow) {
  const e = String(email || "").trim().toLowerCase();
  return allow.map((x) => x.toLowerCase()).includes(e);
}

/**
 * @param {{ name: string, args?: Record<string, unknown> }} call
 * @param {typeof DEFAULT_POLICY} policy
 * @param {{ outflowLast24h?: number, capture?: { amount: number, refunded: number, openDisputeId?: string } }} ctx
 */
export function evaluate(call, policy = DEFAULT_POLICY, ctx = {}) {
  const reasons = [];
  let verdict = "allow";
  const bump = (v, reason) => {
    if (rank[v] > rank[verdict]) verdict = v;
    reasons.push(reason);
  };

  const amount = Number(call.args?.amount ?? call.args?.total ?? 0) || 0;
  const name = call.name;

  if (policy.blockedTools.includes(name)) {
    bump("deny", `${name} is blocked by policy`);
  }

  if (name === "create_refund") {
    const c = ctx.capture;
    if (!c) bump("deny", "capture not found, so the refundable amount is unknown");
    else {
      const remaining = +(c.amount - c.refunded).toFixed(2);
      if (amount > remaining + 1e-9) {
        bump("deny", `refund ${amount} exceeds refundable balance ${remaining}`);
      }
      if (c.refunded > 0) {
        bump("needs_approval", `capture already refunded ${c.refunded} before`);
      }
      if (c.openDisputeId) {
        bump(
          "deny",
          `capture has an open dispute ${c.openDisputeId}; answer it in the Resolution Center instead of refunding here`,
        );
      }
    }
  }

  if (name === "create_payout" || name === "batch_payout") {
    const receivers = call.args?.receivers || (call.args?.receiver ? [call.args.receiver] : []);
    const outside = receivers.filter((r) => !allowlisted(r, policy.payeeAllowlist));
    if (outside.length) {
      bump("needs_approval", `payee not on allowlist: ${outside.join(", ")}`);
    }
  }

  if (["create_payout", "batch_payout", "create_refund", "capture_order"].includes(name) && amount > 0) {
    if (amount > policy.maxPerAction) {
      bump("deny", `${amount} is above the hard ${policy.maxPerAction} per-action limit`);
    }
    const outflow = ctx.outflowLast24h ?? 0;
    if (outflow + amount > policy.dailyOutflowCap) {
      bump(
        "deny",
        `would exceed the 24h outflow cap (${outflow} already + ${amount} > ${policy.dailyOutflowCap})`,
      );
    }
    if (amount > policy.approvalThreshold) {
      bump("needs_approval", `${amount} is above the ${policy.approvalThreshold} auto-approve threshold`);
    }
  }

  if (reasons.length === 0) reasons.push("within policy");
  return { verdict, reasons, amount };
}

export function policySummary(p = DEFAULT_POLICY) {
  return [
    `Hard max per action: $${p.maxPerAction}.`,
    `Auto-approve under: $${p.approvalThreshold}.`,
    `24h outflow cap: $${p.dailyOutflowCap}.`,
    `Payout allowlist: ${p.payeeAllowlist.length ? p.payeeAllowlist.join(", ") : "(empty: every payout needs approval)"}.`,
    `Open disputes: refunds on disputed captures are denied (answer in Resolution Center).`,
  ].join(" ");
}
