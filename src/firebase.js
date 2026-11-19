/**
 * Firebase init — placeholders only. Real keys come from .env (never committed).
 * App Check is required by #BuildHybridAI; debug tokens are OK for submissions.
 */

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "",
};

export function hasFirebaseConfig() {
  return Boolean(cfg.apiKey && cfg.projectId && cfg.appId && !cfg.apiKey.includes("REPLACE"));
}

export function getFirebaseConfig() {
  return { ...cfg };
}

/**
 * Lazily load firebase when configured. Returns null in mock mode / missing keys.
 */
export async function initFirebaseAI() {
  if (!hasFirebaseConfig()) return null;
  const { initializeApp } = await import("firebase/app");
  const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import("firebase/app-check");
  const { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } = await import("firebase/ai");

  const app = initializeApp(cfg);

  // App Check: use debug token when provided (hackathon accepts debug tokens).
  if (typeof self !== "undefined") {
    // eslint-disable-next-line no-undef
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true;
  }
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider("REPLACE_SITE_KEY"),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    console.warn("App Check init skipped/failed (expected without real site key):", err?.message || err);
  }

  const ai = getAI(app, { backend: new GoogleAIBackend() });
  const model = getGenerativeModel(ai, {
    model: import.meta.env.VITE_CLOUD_MODEL || "gemini-3.5-flash-lite",
    mode: InferenceMode.PREFER_ON_DEVICE,
  });

  return { app, ai, model, InferenceMode };
}
