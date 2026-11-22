// Route API and alerts calls to the same origin when served over HTTP/HTTPS,
// while preserving empty fallback values for file:// and Capacitor shells.
const sameOrigin = location.protocol.startsWith("http") ? window.location.origin : "";
window.HOME_DASHBOARD_API_ORIGIN = sameOrigin;
window.HOME_DASHBOARD_ALERTS_ORIGIN = sameOrigin;
