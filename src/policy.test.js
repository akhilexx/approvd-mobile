import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate, DEFAULT_POLICY } from "./policy.js";

test("small allowlisted payout allows", () => {
  const r = evaluate(
    { name: "create_payout", args: { amount: 20, receiver: "asha@example.com" } },
    DEFAULT_POLICY,
    { outflowLast24h: 0 },
  );
  assert.equal(r.verdict, "allow");
});

test("new payee needs approval", () => {
  const r = evaluate(
    { name: "create_payout", args: { amount: 20, receiver: "new@mail.test" } },
    DEFAULT_POLICY,
    { outflowLast24h: 0 },
  );
  assert.equal(r.verdict, "needs_approval");
});

test("hard max denies", () => {
  const r = evaluate(
    { name: "create_payout", args: { amount: 900, receiver: "asha@example.com" } },
    DEFAULT_POLICY,
    { outflowLast24h: 0 },
  );
  assert.equal(r.verdict, "deny");
});

test("dispute blocks refund", () => {
  const r = evaluate(
    { name: "create_refund", args: { amount: 12 } },
    DEFAULT_POLICY,
    { capture: { amount: 45, refunded: 0, openDisputeId: "PP-D-1" } },
  );
  assert.equal(r.verdict, "deny");
  assert.match(r.reasons.join(" "), /dispute/);
});

test("partial refund within balance allows under threshold", () => {
  const r = evaluate(
    { name: "create_refund", args: { amount: 12 } },
    DEFAULT_POLICY,
    { capture: { amount: 45, refunded: 0 }, outflowLast24h: 0 },
  );
  assert.equal(r.verdict, "allow");
});
