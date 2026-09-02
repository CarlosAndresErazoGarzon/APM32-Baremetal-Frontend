// Manual override for pointing a LOCALLY-served frontend at a specific
// backend for one-off review, without touching the default localhost
// behavior every e2e test relies on (see CONFIG.API_URL's own comment --
// each test boots its own scratch server and expects window.location.origin
// to mean THAT server, not something external). Opt in with either:
//   http://localhost:3000/index.html?backend=https://your-url
//   localStorage.setItem('apm32_backend_override', 'https://your-url')
// The query param wins if both are set, and persists into localStorage so
// it survives a plain reload without needing to retype the URL. Clear it
// with `localStorage.removeItem('apm32_backend_override')` (or just
// ?backend=) to fall back to the normal localhost/production split.
function resolveBackendOverride() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('backend');
    if (fromQuery) {
        try { localStorage.setItem('apm32_backend_override', fromQuery); } catch {}
        return fromQuery;
    }
    try { return localStorage.getItem('apm32_backend_override'); } catch { return null; }
}

export const CONFIG = {
    // Locally, the frontend's own origin -- server.js always serves both
    // the static frontend AND the API from the same Express app on the
    // same port, so this is correct whether that's the default 3000, a
    // scratch test server's ephemeral port, or anything else someone runs
    // it on. The OLD hardcoded 'http://localhost:3000' broke silently the
    // moment nothing happened to be listening there: every Playground/
    // Learn-grading request failed with "Failed to fetch", with no
    // connection at all to whatever page was actually being tested --
    // confirmed as the real cause of a batch of e2e test failures once a
    // leftover process on port 3000 (unrelated to any given test run)
    // finally went away.
    API_URL: resolveBackendOverride() || (
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '')
            ? window.location.origin
            : 'https://apm32-baremetal-backend.onrender.com'
    )
};
