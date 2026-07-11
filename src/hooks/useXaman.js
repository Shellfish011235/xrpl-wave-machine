import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Xaman (formerly XUMM) QR sign-in via the PKCE OAuth2 flow.
 * - Safe to run client-side with only the API KEY (never the secret).
 * - authorize() opens Xaman's own QR overlay; scan with the iPhone app,
 *   approve the SignIn pseudo-transaction, and the r-address comes back
 *   cryptographically proven.
 * - If no API key is configured, the hook degrades gracefully and the UI
 *   falls back to manual r-address entry.
 *
 * Setup: create an app at https://apps.xumm.dev, whitelist your origins
 * (http://localhost:5173 for dev), and set VITE_XAMAN_API_KEY in .env.
 */
export function useXaman(apiKey) {
  const xummRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!apiKey) { setReady(false); return; }
    (async () => {
      try {
        const { Xumm } = await import("xumm");
        if (cancelled) return;
        const sdk = new Xumm(apiKey);
        xummRef.current = sdk;
        setReady(true);
        // Restore an existing session if the user signed in before.
        const existing = await sdk.user.account;
        if (!cancelled && existing) setAccount(existing);
      } catch (e) {
        if (!cancelled) { setError("Xaman SDK failed to load"); setReady(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [apiKey]);

  const signIn = useCallback(async () => {
    if (!xummRef.current) return null;
    setConnecting(true);
    setError("");
    try {
      await xummRef.current.authorize(); // opens the QR — scan with Xaman on your phone
      const addr = await xummRef.current.user.account;
      setAccount(addr || null);
      return addr || null;
    } catch (e) {
      setError(e?.message || "Sign-in was cancelled or failed");
      return null;
    } finally {
      setConnecting(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try { await xummRef.current?.logout(); } catch (e) { /* session already gone */ }
    setAccount(null);
  }, []);

  return { available: !!apiKey && ready, account, connecting, error, signIn, signOut };
}
