# Devpost draft — Approvd (#BuildHybridAI)

**Ready for King Bot / Jyothish to paste after video review.**  
Repo (public, Apache-2.0): https://github.com/akhilexx/approvd-mobile  
Demo video: local file for user review first — do **not** upload until Jyothish OK.

## Project name
Approvd

## Tagline
Hybrid on-device + cloud AI that proposes merchant money moves — and a spend policy the model cannot override.

## Platform track(s)
- **Primary:** Best Web/Chrome App

## Built with
Firebase AI Logic (hybrid inference — **imported and wired**, `InferenceMode.PREFER_ON_DEVICE`), Gemini Nano (Chrome Prompt API path), Vite, vanilla JS, App Check hooks (debug-token ready). Live Firebase project / App Check token **not configured** for this submission; demo uses the mock planner. Money moves are mocked.

## Elevator / description (paste)

**Approvd** is a mobile-first web console for small online sellers who want an AI helper for payouts and refunds without giving a chatbot unrestricted access to money.

**Hybrid design (code is in the repo):** Firebase AI Logic is imported in `src/firebase.js` and called via `getAI` + `getGenerativeModel({ mode: InferenceMode.PREFER_ON_DEVICE })` with `initializeDeviceModel()` before the first on-device call. When Chrome has Gemini Nano and a Firebase project + App Check are configured, the planner prefers on-device Nano and falls back to cloud Gemini. **For this Devpost submission we intentionally left Firebase unset** (no live project keys, no App Check token). The UI therefore runs the **deterministic mock planner** (`src/hybrid-ai.js`) and shows badges **AI: offline mock planner** / **Mode: mock**. The hybrid path activates when you fill `.env` from `.env.example` and set `VITE_AI_MODE=firebase`.

Regardless of planner source, the model only **proposes** a tool call. A **spend-policy engine in code** (`src/policy.js`) returns `allow`, `needs_approval`, or `deny` using hard per-action limits, a 24-hour outflow cap, a payee allowlist, and a **deny-refund-on-open-dispute** guard. Sensitive actions land in an Approvals queue; caps are re-checked when a human taps Approve. Money movement (PayPal etc.) is **mocked** so the demo focuses on hybrid AI wiring + policy UX.

**Why hybrid matters here:** routine explanations and small decisions can stay private and free on-device; longer or tool-heavy reasoning can use the cloud; the merchant’s experience stays the same either way. The policy path never trusts the model to set its own limits.

**What we shipped:** Web/Chrome hybrid shell, Firebase AI Logic `PREFER_ON_DEVICE` integration code, App Check hooks, the four-screen console (chat, approvals, policy editor, disputes stub), dispute-aware policy tests, and a public Apache-2.0 repo. We chose to submit without wiring a live Firebase project so judges can run `npm install && npm run dev` with zero secrets.

## How we used Firebase AI Logic (short — honest)
- Source imports: `getAI`, `GoogleAIBackend`, `getGenerativeModel`, `InferenceMode.PREFER_ON_DEVICE` in `src/firebase.js`
- `initializeDeviceModel()` in `src/hybrid-ai.js` before first on-device call
- UI badge surfaces `inferenceSource` (on-device / cloud / mock)
- App Check initialized when config is present (debug tokens accepted per hackathon rules)
- **This submission:** Firebase **not configured**; runtime path is **mock planner**. Integration code is present and ready.

## Demo video notes
- ≤ 3:00, English AI female voice (en-US-AvaNeural) with on-screen “voice is AI-generated” disclosure
- Shows Console chips: allow → needs_approval → dispute deny
- Shows Mode: mock / offline mock planner badge
- Shows Approvals queue, Policy editor, Disputes stub
- Spoken disclosure that Firebase is not configured for the submission and money moves are mocked

## Links
- GitHub: https://github.com/akhilexx/approvd-mobile
- LICENSE: Apache-2.0

## Repo requirements checklist
- [x] Public GitHub
- [x] Apache-2.0 LICENSE visible
- [x] Firebase AI Logic import + call in source (activates when configured)
- [x] README with setup + honest mocks
- [ ] Hosted preview URL (optional; local `npm run preview` works)
