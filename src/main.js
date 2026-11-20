import { createStore } from "./store.js";
import { warmHybrid, explainAndPropose } from "./hybrid-ai.js";
import { hasFirebaseConfig } from "./firebase.js";

const store = createStore();
const root = document.getElementById("root");
const toasts = document.getElementById("toasts");

let planner = { mode: "mock", deviceReady: false };
let thinking = false;
const seen = new Set();
let lastPending = null;

/* ---------------- icons ---------------- */
const I = {
  logo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 7"/></svg>`,
  chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>`,
  inbox: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5.5 5h13L21 13v6H3v-6z"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>`,
  flag: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></svg>`,
  chip: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>`,
  send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.2 4.2L19 7"/></svg>`,
  x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="5" width="3.5" height="14" rx="1"/><rect x="13.5" y="5" width="3.5" height="14" rx="1"/></svg>`,
  out: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>`,
  back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>`,
  alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.01"/></svg>`,
  gh: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.4 1.1 3 .8.1-.6.3-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2z"/></svg>`,
};

const VERDICT_LABEL = { allow: "Allowed", needs_approval: "Needs approval", deny: "Denied" };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = (n) => `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const timeAgo = (t) => {
  const m = Math.round((Date.now() - (t || Date.now())) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};
const plannerLabel = () =>
  planner.mode === "firebase" ? (planner.deviceReady ? "Gemini Nano · on-device" : "Gemini · cloud") : "Mock planner";
const enterClass = (key) => {
  if (seen.has(key)) return "";
  seen.add(key);
  return "enter";
};

/* ---------------- toasts ---------------- */
function toast(kind, title, body) {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  const icon = kind === "allow" ? I.check : kind === "deny" ? I.x : kind === "needs_approval" ? I.pause : I.check;
  el.innerHTML = `<div class="ti">${icon}</div><div><strong>${esc(title)}</strong><span>${esc(body)}</span></div>`;
  toasts.appendChild(el);
  setTimeout(() => {
    el.classList.add("out");
    setTimeout(() => el.remove(), 340);
  }, 3200);
}

/* ---------------- routing ---------------- */
function route() {
  const h = location.hash.replace(/^#\/?/, "");
  if (!h || h === "home") return { page: "landing" };
  const [, screen = "console"] = h.split("/");
  return { page: "app", screen };
}
let lastRouteKey = "";
window.addEventListener("hashchange", () => render(true));
store.subscribe(() => render(false));

function render(routeChanged) {
  const r = route();
  const key = r.page + ":" + (r.screen || "");
  const changed = routeChanged || key !== lastRouteKey;
  lastRouteKey = key;
  if (r.page === "landing") return renderLanding();
  renderApp(r.screen, changed);
}

/* ---------------- landing ---------------- */
function renderLanding() {
  root.innerHTML = `
  <div class="landing">
    <nav class="l-nav">
      <div class="brand"><div class="logo">${I.logo}</div><span>Approvd</span></div>
      <div class="l-links">
        <a href="#how">How it works</a>
        <a href="#/app/policy">Policy</a>
        <a href="https://github.com/akhilexx/approvd-mobile" target="_blank" rel="noreferrer">GitHub</a>
        <a class="btn ghost" href="#/app/console" data-cta="nav">Open console</a>
      </div>
    </nav>
    <section class="hero">
      <div class="stagger">
        <span class="chip brand lg"><span class="dot"></span>Hybrid AI · Firebase AI Logic</span>
        <h1>AI proposes the money move.<br/><em>Your policy decides.</em></h1>
        <p class="lead">Approvd is a spend-policy console for small online sellers. Ask for payouts and refunds in plain English — every proposal is checked by limits written in code, not in a prompt.</p>
        <div class="ctas">
          <a class="btn lg" href="#/app/console" data-cta="hero">Open the console ${I.send}</a>
          <a class="btn lg ghost" href="https://github.com/akhilexx/approvd-mobile" target="_blank" rel="noreferrer">${I.gh} View source</a>
        </div>
        <p class="fine">Gemini Nano on-device when Chrome has it, cloud Gemini otherwise. This build runs the built-in mock planner; money moves are simulated.</p>
      </div>
      <div class="hero-visual">
        <div class="stack stagger">
          <div class="proposal"><div class="q">“Pay asha@example.com $20”</div><span class="chip allow lg"><span class="dot"></span>Allowed</span><div class="r">Allowlisted payee · under the $50 auto-approve threshold</div></div>
          <div class="proposal"><div class="q">“Pay newvendor@mail.test $120”</div><span class="chip needs_approval lg"><span class="dot"></span>Needs approval</span><div class="r">New payee · above threshold → routed to the Approvals queue</div></div>
          <div class="proposal"><div class="q">“Refund $12 on the disputed capture”</div><span class="chip deny lg"><span class="dot"></span>Denied</span><div class="r">Open dispute on CAP-1001 → answer it in the Resolution Center</div></div>
        </div>
      </div>
    </section>
    <section class="features stagger" id="how">
      <div class="card feature"><div class="ic">${I.chip}</div><h3>Hybrid inference</h3><p>Firebase AI Logic with <span class="mono">PREFER_ON_DEVICE</span>: Gemini Nano runs locally in Chrome when available and falls back to cloud Gemini.</p></div>
      <div class="card feature"><div class="ic">${I.shield}</div><h3>Policy engine in code</h3><p>Per-action limits, a 24-hour outflow cap, a payee allowlist and a dispute guard. The model can only propose — it can never set its own limits.</p></div>
      <div class="card feature"><div class="ic">${I.inbox}</div><h3>Human approvals</h3><p>Anything sensitive lands in a queue. Caps are re-checked at the moment you tap Approve.</p></div>
    </section>
  </div>`;
}

/* ---------------- app shell ---------------- */
const SCREENS = {
  console: { title: "Console", sub: "Ask in plain English. The planner proposes; policy decides.", icon: I.chat },
  approvals: { title: "Approvals", sub: "Sensitive actions wait here. Caps are re-checked when you approve.", icon: I.inbox },
  policy: { title: "Policy", sub: "Hard limits that the model cannot override.", icon: I.shield },
  disputes: { title: "Disputes", sub: "Open cases and the decision ledger.", icon: I.flag },
};

function renderApp(screen, changed) {
  if (!SCREENS[screen]) screen = "console";
  const s = store.get();
  const pending = s.approvals.filter((a) => a.status === "pending").length;
  const bump = lastPending !== null && pending !== lastPending;
  lastPending = pending;
  const meta = SCREENS[screen];

  // Preserve composer draft across re-renders
  const draft = root.querySelector("#q")?.value ?? "";

  root.innerHTML = `
  <div class="shell">
    <aside class="side">
      <a class="brand" href="#/" style="text-decoration:none;color:inherit"><div class="logo">${I.logo}</div><span>Approvd</span></a>
      <nav class="nav" id="nav">
        ${Object.entries(SCREENS)
          .map(
            ([k, v]) => `<button type="button" data-screen="${k}" class="${k === screen ? "active" : ""}">${v.icon}<span>${v.title}</span>${
              k === "approvals" && pending ? `<span class="count ${bump ? "bump" : ""}">${pending}</span>` : ""
            }</button>`,
          )
          .join("")}
      </nav>
      <div class="side-foot"><strong>${esc(plannerLabel())}</strong>${
        planner.mode === "firebase"
          ? "Firebase AI Logic hybrid inference is live."
          : "Firebase AI Logic isn’t configured in this build, so proposals come from the built-in planner. Money moves are simulated."
      }</div>
    </aside>
    <main class="main">
      <header class="top">
        <div><h1>${meta.title}</h1><p>${meta.sub}</p></div>
        <div class="status">
          <span class="chip brand lg"><span class="dot"></span>${esc(plannerLabel())}</span>
          <span class="chip lg">Simulated money moves</span>
        </div>
      </header>
      <section class="content ${changed ? "screen-enter" : ""}" id="screen"></section>
    </main>
  </div>`;

  root.querySelector("#nav").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-screen]");
    if (b) location.hash = `#/app/${b.dataset.screen}`;
  });

  const el = root.querySelector("#screen");
  if (screen === "console") renderConsole(el, s, draft);
  else if (screen === "approvals") renderApprovals(el, s);
  else if (screen === "policy") renderPolicy(el, s);
  else renderDisputes(el, s);
}

/* ---------------- console ---------------- */
function decisionHtml(m) {
  const d = m.decision;
  if (!d) return "";
  const call = m.call;
  const what =
    call.name === "create_payout"
      ? `Payout ${money(d.amount)} → ${esc(call.args.receiver)}`
      : call.name === "create_refund"
        ? `Refund ${money(d.amount)} on ${esc(call.args.captureId)}`
        : `${esc(call.name)} ${money(d.amount)}`;
  const outcome =
    d.verdict === "allow" ? "Simulated and recorded in the ledger" : d.verdict === "needs_approval" ? "Sent to the Approvals queue" : "Blocked — nothing was sent";
  return `<div class="decision ${d.verdict}" data-decision="${d.verdict}">
    <div class="dh"><span class="call">${what}</span><span class="chip ${d.verdict} lg"><span class="dot"></span>${VERDICT_LABEL[d.verdict]}</span></div>
    <ul>${d.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
    <div class="foot"><span>${outcome}</span><span>·</span><span>Proposed by ${esc(m.sourceLabel || "mock planner")}</span></div>
  </div>`;
}

function renderConsole(el, s, draft) {
  const p = s.policy;
  const pct = Math.min(100, Math.round((s.outflowLast24h / p.dailyOutflowCap) * 100));
  el.innerHTML = `
  <div class="console-grid">
    <div class="card chat-card">
      <div class="chat" id="chat">
        ${s.messages
          .map((m) => {
            const av = m.role === "user" ? "AP" : I.logo;
            return `<div class="msg ${m.role} ${enterClass("msg:" + m.id)}">
              <div class="avatar">${av}</div>
              <div><div class="bubble">${esc(m.text)}</div>${decisionHtml(m)}</div>
            </div>`;
          })
          .join("")}
        ${thinking ? `<div class="msg assistant enter" id="typing"><div class="avatar">${I.logo}</div><div class="bubble typing"><i></i><i></i><i></i><span class="typing-label">Drafting a proposal…</span></div></div>` : ""}
      </div>
      <div class="composer-wrap">
        <form class="composer" id="composer">
          <input id="q" name="q" placeholder="Ask for a payout or refund…" autocomplete="off" />
          <button class="btn" type="submit" id="send">Send ${I.send}</button>
        </form>
        <div class="suggest">
          <span class="lbl">Try</span>
          <button type="button" data-chip="Pay asha@example.com $20"><span class="dot" style="background:var(--allow)"></span>Safe payout</button>
          <button type="button" data-chip="Pay newvendor@mail.test $120"><span class="dot" style="background:var(--need)"></span>New vendor payout</button>
          <button type="button" data-chip="Refund $12 on the disputed capture"><span class="dot" style="background:var(--deny)"></span>Disputed refund</button>
        </div>
      </div>
    </div>
    <div class="rail">
      <div class="card">
        <div class="card-h"><h3>Policy at a glance</h3><a class="chip" href="#/app/policy" style="text-decoration:none">Edit</a></div>
        <div class="card-b">
          <div class="kv"><span>Max per action</span><strong>${money(p.maxPerAction)}</strong></div>
          <div class="kv"><span>Auto-approve under</span><strong>${money(p.approvalThreshold)}</strong></div>
          <div class="kv" style="border:0"><span>24h outflow</span><strong>${money(s.outflowLast24h)} / ${money(p.dailyOutflowCap)}</strong></div>
          <div class="meter"><i style="width:${pct}%"></i></div>
          <div class="eyebrow" style="margin-top:16px">Allowlisted payees</div>
          <div class="tags">${p.payeeAllowlist.map((x) => `<span class="chip">${esc(x)}</span>`).join("")}</div>
        </div>
      </div>
      <div class="card">
        <div class="card-h"><h3>How a request flows</h3></div>
        <div class="card-b flow">
          <div class="step"><span class="n">1</span><span>${esc(plannerLabel())} turns your message into a proposed tool call.</span></div>
          <div class="step"><span class="n">2</span><span>The policy engine returns allow, needs approval, or deny.</span></div>
          <div class="step"><span class="n">3</span><span>Only allowed moves run. Here they are simulated.</span></div>
        </div>
      </div>
    </div>
  </div>`;

  const chat = el.querySelector("#chat");
  chat.style.scrollBehavior = "auto";
  chat.scrollTop = chat.scrollHeight;
  chat.style.scrollBehavior = "";
  const input = el.querySelector("#q");
  input.value = draft;
  el.querySelector("#composer").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const text = input.value.trim();
    if (!text || thinking) return;
    input.value = "";
    handleUser(text);
  });
  el.querySelectorAll("[data-chip]").forEach((b) => b.addEventListener("click", () => !thinking && handleUser(b.dataset.chip)));
}

async function handleUser(text) {
  store.addMessage({ role: "user", text });
  thinking = true;
  render(false);
  const [res] = await Promise.all([explainAndPropose(text, store.get().policy), sleep(1100)]);
  const { explanation, call, source } = res;
  thinking = false;
  const label = source === "on-device" ? "Gemini Nano (on-device)" : source === "cloud" ? "Gemini (cloud)" : "mock planner";
  if (call) {
    const { decision } = store.proposeAction(call, explanation, source);
    const lead =
      decision.verdict === "allow"
        ? "Within policy — I’ve recorded it."
        : decision.verdict === "needs_approval"
          ? "This one needs a human. I’ve queued it for approval."
          : "Policy blocks this, so I won’t send it.";
    store.addMessage({ role: "assistant", text: lead, call, decision, sourceLabel: label });
    const t = {
      allow: ["Payout allowed", `${money(decision.amount)} recorded (simulated)`],
      needs_approval: ["Sent to Approvals", "A human has to confirm this one"],
      deny: ["Blocked by policy", decision.reasons[decision.reasons.length - 1]],
    }[decision.verdict];
    toast(decision.verdict, t[0], t[1]);
  } else {
    store.addMessage({ role: "assistant", text: explanation, sourceLabel: label });
  }
}

/* ---------------- approvals ---------------- */
function approvalItem(a, actionable) {
  return `<div class="item ${enterClass("ap:" + a.id + ":" + a.status)}" data-id="${a.id}">
    <div class="ic">${I.out}</div>
    <div>
      <div class="t"><span>${esc(a.title)}</span><span class="chip ${a.status}"><span class="dot"></span>${a.status === "pending" ? "Pending" : a.status[0].toUpperCase() + a.status.slice(1)}</span></div>
      <div class="d">${esc(a.detail)} · ${timeAgo(a.resolvedAt || a.createdAt)}</div>
    </div>
    <div class="actions">${
      actionable
        ? `<button class="btn subtle" data-act="reject" data-id="${a.id}">Reject</button><button class="btn success" data-act="approve" data-id="${a.id}">${I.check} Approve</button>`
        : ""
    }</div>
  </div>`;
}

function renderApprovals(el, s) {
  const pending = s.approvals.filter((a) => a.status === "pending");
  const done = s.approvals.filter((a) => a.status !== "pending").sort((x, y) => (y.resolvedAt || 0) - (x.resolvedAt || 0));
  const p = s.policy;
  el.innerHTML = `
    <div class="stats">
      <div class="card stat"><div class="eyebrow">Waiting on you</div><div class="v">${pending.length}</div><div class="sub">pending approvals</div></div>
      <div class="card stat"><div class="eyebrow">24h outflow</div><div class="v">${money(s.outflowLast24h)}</div><div class="sub">of ${money(p.dailyOutflowCap)} cap</div></div>
      <div class="card stat"><div class="eyebrow">Auto-approve under</div><div class="v">${money(p.approvalThreshold)}</div><div class="sub">anything above waits here</div></div>
    </div>
    <div class="split approvals">
      <div class="card">
        <div class="card-h"><h3>Pending</h3><span class="chip pending">${pending.length} waiting</span></div>
        <div class="list" style="margin-top:12px" id="pending">
          ${pending.length ? pending.map((a) => approvalItem(a, true)).join("") : `<div class="empty enter"><div class="ic">${I.check}</div><strong>You’re all caught up</strong>New proposals that need a human will appear here.</div>`}
        </div>
      </div>
      <div class="card">
        <div class="card-h"><h3>Recently resolved</h3></div>
        <div class="list" style="margin-top:12px">
          ${done.length ? done.slice(0, 6).map((a) => approvalItem(a, false)).join("") : `<div class="empty"><strong>Nothing resolved yet</strong>Approved and rejected items show up here.</div>`}
        </div>
      </div>
    </div>`;
  el.querySelectorAll("[data-act]").forEach((b) =>
    b.addEventListener("click", () => {
      const id = b.dataset.id;
      const approve = b.dataset.act === "approve";
      const row = el.querySelector(`.item[data-id="${id}"]`);
      row?.classList.add("leaving");
      setTimeout(() => {
        const a = store.resolveApproval(id, approve);
        if (!a) return;
        if (a.status === "approved") toast("allow", "Approved", `${a.title} · simulated`);
        else if (a.status === "blocked") toast("deny", "Blocked on re-check", a.detail);
        else toast("info", "Rejected", a.title);
      }, 300);
    }),
  );
}

/* ---------------- policy ---------------- */
function renderPolicy(el, s) {
  const p = s.policy;
  el.innerHTML = `
  <div class="split" style="grid-template-columns: 1.4fr 1fr">
    <div class="card">
      <div class="card-h"><h3>Limits</h3><span class="chip">Enforced in code</span></div>
      <div class="card-b">
        <form class="form" id="policy-form">
          <div class="field"><label for="maxPerAction">Max per action</label><div class="prefix"><span>$</span><input id="maxPerAction" name="maxPerAction" type="number" min="1" value="${p.maxPerAction}" /></div><div class="help">Anything above is denied.</div></div>
          <div class="field"><label for="approvalThreshold">Auto-approve under</label><div class="prefix"><span>$</span><input id="approvalThreshold" name="approvalThreshold" type="number" min="0" value="${p.approvalThreshold}" /></div><div class="help">Above this, a human approves.</div></div>
          <div class="field"><label for="dailyOutflowCap">24h outflow cap</label><div class="prefix"><span>$</span><input id="dailyOutflowCap" name="dailyOutflowCap" type="number" min="1" value="${p.dailyOutflowCap}" /></div><div class="help">Rolling 24-hour total.</div></div>
          <div class="field full"><label for="payeeAllowlist">Payee allowlist</label><textarea id="payeeAllowlist" name="payeeAllowlist" rows="2">${esc(p.payeeAllowlist.join(", "))}</textarea><div class="help">Comma-separated. New payees always need approval.</div></div>
          <div class="form-actions"><button class="btn ghost" type="button" id="reset">Reset demo data</button><button class="btn" type="submit" id="save">Save policy</button></div>
        </form>
      </div>
    </div>
    <div class="card" id="rules">
      <div class="card-h"><h3>Active rules</h3></div>
      <div class="card-b">
        <div class="rule"><span class="chip deny">Deny</span><span>Any single action above <strong>${money(p.maxPerAction)}</strong></span></div>
        <div class="rule"><span class="chip deny">Deny</span><span>Anything that would push 24h outflow past <strong>${money(p.dailyOutflowCap)}</strong></span></div>
        <div class="rule"><span class="chip deny">Deny</span><span>Refunds on a capture with an open dispute</span></div>
        <div class="rule"><span class="chip needs_approval">Approve</span><span>Amounts above <strong>${money(p.approvalThreshold)}</strong>, or payees not on the allowlist</span></div>
        <div class="rule"><span class="chip allow">Allow</span><span>Everything else — still simulated in this build</span></div>
      </div>
    </div>
  </div>`;
  el.querySelector("#policy-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    store.setPolicy({
      maxPerAction: Number(fd.get("maxPerAction")),
      approvalThreshold: Number(fd.get("approvalThreshold")),
      dailyOutflowCap: Number(fd.get("dailyOutflowCap")),
      payeeAllowlist: String(fd.get("payeeAllowlist")).split(",").map((x) => x.trim()).filter(Boolean),
    });
    root.querySelector("#rules")?.classList.add("flash");
    toast("allow", "Policy saved", "Every new proposal is checked against these limits");
  });
  el.querySelector("#reset").onclick = () => store.resetDemo();
}

/* ---------------- disputes ---------------- */
function renderDisputes(el, s) {
  el.innerHTML = `
  <div class="card" style="margin-bottom:24px">
    ${s.disputes
      .map(
        (d) => `<div class="dispute">
          <div>
            <div style="display:flex;gap:12px;align-items:center"><span class="chip OPEN lg"><span class="dot"></span>Open dispute</span><span class="mono muted">${esc(d.id)} · ${esc(d.captureId)}</span></div>
            <h3 style="margin-top:12px;font-size:20px">${esc(d.reason.replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()))}</h3>
            <p class="muted" style="margin:6px 0 0">${esc(d.note)}</p>
          </div>
          <div style="text-align:right"><div class="eyebrow">Disputed amount</div><div class="amt">${money(d.amount)}</div></div>
          <div class="notice">${I.alert}<span>Refunds on <strong>${esc(d.captureId)}</strong> are denied by policy while this dispute is open. Respond in the Resolution Center instead.</span></div>
        </div>`,
      )
      .join("")}
  </div>
  <div class="card">
    <div class="card-h"><h3>Decision ledger</h3><span class="chip">${s.ledger.length} entries</span></div>
    <div style="margin-top:12px">
      ${
        s.ledger.length
          ? `<table class="table"><thead><tr><th>Decision</th><th>Action</th><th>Why</th><th>Planner</th></tr></thead><tbody>
            ${s.ledger
              .slice(0, 8)
              .map(
                (e) => `<tr class="${enterClass("led:" + e.id)}"><td><span class="chip ${e.decision.verdict}"><span class="dot"></span>${VERDICT_LABEL[e.decision.verdict]}</span></td>
                <td><strong>${e.call.name === "create_payout" ? "Payout" : e.call.name === "create_refund" ? "Refund" : esc(e.call.name)} ${money(e.decision.amount)}</strong><div class="d">${esc(e.call.args?.receiver || e.call.args?.captureId || "")}</div></td>
                <td>${esc(e.decision.reasons.join("; "))}</td><td class="muted">${esc(e.source === "mock" ? "mock planner" : e.source)}</td></tr>`,
              )
              .join("")}
          </tbody></table>`
          : `<div class="empty"><strong>No decisions yet</strong>Proposals from the console are logged here with the policy’s reasons.</div>`
      }
    </div>
  </div>`;
}

/* ---------------- boot ---------------- */
async function boot() {
  render(true);
  planner = await warmHybrid();
  if (!(hasFirebaseConfig() && import.meta.env.VITE_AI_MODE !== "mock")) planner = { mode: "mock", deviceReady: false };
  render(false);
}
boot();
