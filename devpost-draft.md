# Devpost draft — Approvd (#BuildHybridAI)

**Do not submit until King Bot / Jyothish OK the public repo, video, and legal acceptances.**

## Project name
Approvd

## Tagline
Hybrid on-device + cloud AI that proposes merchant money moves — and a spend policy the model cannot override.

## Platform track(s)
- **Primary:** Best Web/Chrome App  
- Optional later: Android / iOS via Capacitor if multi-platform Grand Prize chase is approved

## Built with
Firebase AI Logic (hybrid inference), Gemini Nano (Chrome Prompt API), Gemini cloud (Firebase), Vite, vanilla JS, App Check (debug token), (planned) Firestore / Remote Config if time

## Elevator / description (paste)

**Approvd** is a mobile-first web console for small online sellers who want an AI helper for payouts and refunds without giving a chatbot unrestricted access to money.

You type plain English (“pay Asha $20”, “refund $12 for a cracked lid”). Firebase AI Logic runs the prompt **on-device with Gemini Nano when Chrome has the model**, and **falls back to cloud Gemini** when it doesn’t — one SDK, hybrid by design. The model only **proposes** a tool call. A **spend-policy engine in code** then returns `allow`, `needs_approval`, or `deny` using hard per-action limits, a 24-hour outflow cap, a payee allowlist, and a **deny-refund-on-open-dispute** guard. Anything sensitive lands in an Approvals queue; caps are re-checked when a human taps Approve.

**Why hybrid matters here:** routine explanations and small decisions can stay private and free on-device; longer or tool-heavy reasoning can use the cloud; the merchant’s experience stays the same either way. The policy path never trusts the model to set its own limits.

**What we built during the submission period:** this Web/Chrome hybrid shell, Firebase AI Logic `PREFER_ON_DEVICE` wiring, App Check hooks, the four-screen console (chat, approvals, policy editor, disputes stub), and the dispute-aware policy tests. Live PayPal settlement stays out of this entry (mocked) so the demo focuses on hybrid AI + policy UX.

**Value proposition:** merchants get agent speed with auditor-grade guardrails, and judges see Firebase AI Logic actually imported and called at runtime — not only named in a README.

## How we used Firebase AI Logic (short)
- `getAI` + `GoogleAIBackend` + `getGenerativeModel({ mode: InferenceMode.PREFER_ON_DEVICE })`
- `initializeDeviceModel()` before first on-device call
- UI badge surfaces `inferenceSource` (on-device vs cloud) or honest mock mode
- App Check initialized (debug tokens accepted per hackathon rules)

## Demo video notes (for King Bot)
- ≤ 3:00, English, public YouTube  
- Show Console chips: allow → needs_approval → dispute deny  
- Show AI badge (mock and, if available, on-device/cloud)  
- Show Policy editor  
- Optional: Chrome flags + Nano download progress  

## Repo requirements checklist
- [ ] Public GitHub/GitLab  
- [ ] Apache-2.0 LICENSE visible  
- [ ] Firebase AI Logic import + call in source  
- [ ] README with setup + honest mocks  
- [ ] Hosted preview URL (encouraged)  
