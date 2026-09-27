/**
 * Registers the shell-only service worker. Skipped in dev, inside iframes (editor preview)
 * and on preview hosts, where a worker would serve stale builds.
 */
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const inIframe = window.self !== window.top;
  const previewHost = /(^|\.)id-preview--|lovableproject\.com$|localhost/.test(location.hostname);
  if (import.meta.env.DEV || inIframe || previewHost) {
    navigator.serviceWorker
      .getRegistrations()
      .then((rs) => rs.forEach((r) => r.unregister()))
      .catch(() => {});
    return;
  }
  navigator.serviceWorker
    .register("/sw.js")
    .catch((e) => console.warn("[pwa] register failed", e?.name));
}
