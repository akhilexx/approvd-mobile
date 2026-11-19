# Approvd (mobile / Web-Chrome hybrid)

**Spend-policy AI for small merchants — on-device when Nano is available, cloud when it is not.**

Built for **[#BuildHybridAI 2026](https://firebasehybridaihackathon.devpost.com/)** (Google Firebase AI Logic).  
Track target: **Best Web/Chrome App**. Apache-2.0. Local package only until the owner makes the repo public.

> This is a **significantly updated** product surface of the earlier Approvd web agent (PayPal AI Hackathon): same policy ideas (caps, allowlist, approval queue, **deny refund on open dispute**), new hybrid Firebase AI Logic path, and a mobile-first responsive UI. No PayPal secrets or sandbox credentials are included.

## Why Web/Chrome (not Flutter / native first)

| Option | Pros | Cons for this deadline |
|---|---|---|
| **Web + Vite (chosen)** | Real Firebase AI Logic hybrid on Chrome Desktop; demo without Apple/Google paid accounts; Capacitor can wrap later; matches Best Web/Chrome $3k | On-device Nano needs Chrome ≥139 + flag |
| Flutter | Nice phones | Extra toolchain; hybrid web path is the hackathon’s clearest Nano demo |
| Pure Capacitor iOS/Android | Store-ish | Signing / developer accounts block a free demo |

## How hybrid on-device vs cloud works

```text
User message
    │
    ▼
Firebase AI Logic  getGenerativeModel({ mode: PREFER_ON_DEVICE })
    │
    ├─ Gemini Nano (Chrome Prompt API)  ──► inferenceSource = on-device
    │        (single-turn text / JSON; free, private, offline-capable)
    │
    └─ if Nano unavailable / unsupported feature ──► cloud Gemini
             (Firebase AI Logic / Gemini Developer API)
    │
    ▼
Proposed tool call (payout / refund / …)
    │
    ▼
Spend-policy engine (code)  →  allow | needs_approval | deny
    │
    └─ model cannot override caps, allowlist, or dispute guard
```

- Implementation: `src/firebase.js` + `src/hybrid-ai.js` (Firebase is **imported and called** when `VITE_AI_MODE` ≠ `mock` and config is present).
- Offline default: `VITE_AI_MODE=mock` uses a deterministic planner so judges can run without keys.
- App Check is wired (debug token via env). Replace the reCAPTCHA site key before production.

## Screens

1. **Console** — chat; demos safe payout, needs-approval payout, dispute-blocked refund  
2. **Approvals** — queue; Approve re-checks caps  
3. **Policy** — edit max / threshold / 24h cap / allowlist  
4. **Disputes** — stub list + ledger of policy verdicts  

## Setup

```bash
cd approvd-mobile
cp .env.example .env   # leave mock mode, or fill Firebase web config
npm install
npm run dev            # http://127.0.0.1:5173
npm test               # policy unit tests
npm run build && npm run preview
```

### Live hybrid (Chrome)

1. Chrome Desktop ≥ 139  
2. Enable `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` and restart  
3. Create a Firebase project → Web app → AI Logic + App Check (debug token OK for the hackathon)  
4. Put config in `.env`, set `VITE_AI_MODE=firebase`  
5. First on-device call may download Nano; UI badge shows **on-device** vs **cloud**

## What is mocked (honest)

| Piece | Status |
|---|---|
| Spend policy / approvals / dispute deny | **Real code** in the browser (`src/policy.js`) |
| PayPal / money movement | **Mocked** — no live PayPal calls in this repo |
| Disputes list | **Stub** demo row |
| LLM planner | **Mock** by default; **Firebase AI Logic hybrid** when configured |
| App Check reCAPTCHA site key | Placeholder until a Firebase project exists |
| Auth / Firestore | Not required for the demo; encouraged later |

## Demo script (~90 s)

1. Open Console → badge shows `AI: offline mock planner` (or on-device/cloud).  
2. Chip **safe payout** → `[allow]`.  
3. Chip **needs approval** → appears under Approvals → Approve.  
4. Chip **dispute deny** → `[deny]` with open-dispute reason.  
5. Policy tab → raise threshold → retry a mid-size payout.  
6. (Optional, live Firebase) show badge flipping to on-device vs cloud.

## Devpost

Paste-ready answers: [`devpost-draft.md`](./devpost-draft.md).  
Hackathon research: [`../sources/buildhybridai/HACKATHON-2026-11-19.md`](../sources/buildhybridai/HACKATHON-2026-11-19.md).

## License

Apache License 2.0 — see [`LICENSE`](./LICENSE).
