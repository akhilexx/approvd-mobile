import { createStore } from "./store.js";
import { warmHybrid, explainAndPropose, sourceLabel } from "./hybrid-ai.js";
import { hasFirebaseConfig } from "./firebase.js";
import { policySummary } from "./policy.js";

const store = createStore();
const screenEl = document.getElementById("screen");
const aiBadge = document.getElementById("ai-badge");
const modeBadge = document.getElementById("mode-badge");
let current = "console";
let lastSource = "mock";

async function boot() {
  modeBadge.textContent = hasFirebaseConfig() && import.meta.env.VITE_AI_MODE !== "mock"
    ? "Mode: Firebase hybrid"
    : "Mode: mock";
  const warm = await warmHybrid();
  lastSource = warm.mode === "firebase" ? (warm.deviceReady ? "on-device" : "cloud") : "mock";
  aiBadge.textContent = sourceLabel(lastSource);
  if (warm.mode === "firebase") aiBadge.classList.add("live");
  render();
}

document.getElementById("nav").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-screen]");
  if (!btn) return;
  current = btn.dataset.screen;
  document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("active", b === btn));
  render();
});

store.subscribe(() => render());

function render() {
  const s = store.get();
  if (current === "console") renderConsole(s);
  else if (current === "approvals") renderApprovals(s);
  else if (current === "policy") renderPolicy(s);
  else renderDisputes(s);
}

function renderConsole(s) {
  screenEl.innerHTML = `
    <h2>Console</h2>
    <div class="chat" id="chat"></div>
    <form class="composer" id="composer">
      <input name="q" placeholder='Try “Pay asha@example.com $20” or “Refund $12 on the disputed capture”' autocomplete="off" />
      <button type="submit">Send</button>
    </form>
    <p class="hint">Demo chips:
      <button type="button" class="btn ghost" data-chip="Pay asha@example.com $20">safe payout</button>
      <button type="button" class="btn ghost" data-chip="Pay newvendor@mail.test $120">needs approval</button>
      <button type="button" class="btn ghost" data-chip="Refund $12 on the disputed capture">dispute deny</button>
    </p>
  `;
  const chat = screenEl.querySelector("#chat");
  for (const m of s.messages) {
    const div = document.createElement("div");
    div.className = `bubble ${m.role}`;
    div.textContent = m.text;
    chat.appendChild(div);
  }
  chat.scrollTop = chat.scrollHeight;

  screenEl.querySelector("#composer").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const input = ev.target.q;
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    await handleUser(text);
  });
  screenEl.querySelectorAll("[data-chip]").forEach((b) => {
    b.addEventListener("click", () => handleUser(b.dataset.chip));
  });
}

async function handleUser(text) {
  store.addMessage({ role: "user", text });
  aiBadge.textContent = "AI: thinking…";
  const { explanation, call, source } = await explainAndPropose(text, store.get().policy);
  lastSource = source;
  aiBadge.textContent = sourceLabel(source);
  if (source !== "mock") aiBadge.classList.add("live");

  let reply = explanation;
  if (call) {
    const { decision } = store.proposeAction(call, explanation, source);
    reply += `\n\n[${decision.verdict}] ${decision.reasons.join("; ")}`;
  }
  store.addMessage({ role: "assistant", text: reply });
}

function renderApprovals(s) {
  const pending = s.approvals.filter((a) => a.status === "pending");
  const others = s.approvals.filter((a) => a.status !== "pending");
  screenEl.innerHTML = `
    <h2>Pending approvals</h2>
    <p class="hint">Caps are re-checked when you approve. The model cannot force an allow.</p>
    <div class="list" id="pending"></div>
    <h3 style="margin-top:1.2rem">Recent</h3>
    <div class="list" id="recent"></div>
  `;
  const pend = screenEl.querySelector("#pending");
  if (!pending.length) pend.innerHTML = `<p class="hint">Queue is empty.</p>`;
  for (const a of pending) {
    pend.appendChild(approvalRow(a, true));
  }
  const recent = screenEl.querySelector("#recent");
  for (const a of others.slice(0, 8)) recent.appendChild(approvalRow(a, false));
}

function approvalRow(a, actionable) {
  const row = document.createElement("div");
  row.className = "row";
  row.innerHTML = `
    <div>
      <div><span class="verdict needs_approval">${a.status}</span><strong>${a.title}</strong></div>
      <div class="meta">${a.detail}</div>
    </div>
    <div class="actions"></div>
  `;
  if (actionable) {
    const actions = row.querySelector(".actions");
    const yes = document.createElement("button");
    yes.className = "btn";
    yes.textContent = "Approve";
    yes.onclick = () => store.resolveApproval(a.id, true);
    const no = document.createElement("button");
    no.className = "btn ghost";
    no.textContent = "Reject";
    no.onclick = () => store.resolveApproval(a.id, false);
    actions.append(yes, no);
  }
  return row;
}

function renderPolicy(s) {
  const p = s.policy;
  screenEl.innerHTML = `
    <h2>Policy editor</h2>
    <p class="hint">${policySummary(p)}</p>
    <form class="form-grid" id="policy-form">
      <label>Max per action ($)
        <input name="maxPerAction" type="number" min="1" value="${p.maxPerAction}" />
      </label>
      <label>Auto-approve under ($)
        <input name="approvalThreshold" type="number" min="0" value="${p.approvalThreshold}" />
      </label>
      <label>24h outflow cap ($)
        <input name="dailyOutflowCap" type="number" min="1" value="${p.dailyOutflowCap}" />
      </label>
      <label style="grid-column:1/-1">Payee allowlist (comma-separated)
        <textarea name="payeeAllowlist" rows="2">${p.payeeAllowlist.join(", ")}</textarea>
      </label>
      <div style="grid-column:1/-1" class="actions">
        <button class="btn" type="submit">Save policy</button>
        <button class="btn ghost" type="button" id="reset">Reset demo data</button>
      </div>
    </form>
    <p class="hint">24h outflow so far (demo): $${s.outflowLast24h}</p>
  `;
  screenEl.querySelector("#policy-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    store.setPolicy({
      maxPerAction: Number(fd.get("maxPerAction")),
      approvalThreshold: Number(fd.get("approvalThreshold")),
      dailyOutflowCap: Number(fd.get("dailyOutflowCap")),
      payeeAllowlist: String(fd.get("payeeAllowlist"))
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    });
  });
  screenEl.querySelector("#reset").onclick = () => store.resetDemo();
}

function renderDisputes(s) {
  screenEl.innerHTML = `
    <h2>Returns & disputes (stub)</h2>
    <p class="hint">Refunds on captures with an open dispute are <strong>denied</strong> by policy — answer them in the Resolution Center instead.</p>
    <div class="list" id="dlist"></div>
    <h3 style="margin-top:1.2rem">Ledger (latest)</h3>
    <div class="list" id="ledger"></div>
  `;
  const dlist = screenEl.querySelector("#dlist");
  for (const d of s.disputes) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div>
        <div><span class="verdict deny">${d.status}</span><strong>${d.id}</strong> · $${d.amount}</div>
        <div class="meta">${d.reason}<br/>${d.note}</div>
      </div>`;
    dlist.appendChild(row);
  }
  const ledger = screenEl.querySelector("#ledger");
  for (const e of s.ledger.slice(0, 10)) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div>
        <div><span class="verdict ${e.decision.verdict}">${e.decision.verdict}</span>
          ${e.call.name} $${e.decision.amount} · <em>${e.source}</em></div>
        <div class="meta">${e.decision.reasons.join("; ")}</div>
      </div>`;
    ledger.appendChild(row);
  }
  if (!s.ledger.length) ledger.innerHTML = `<p class="hint">No actions yet — use the console.</p>`;
}

boot();
