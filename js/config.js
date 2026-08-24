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
    API_URL: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '')
        ? window.location.origin
        : 'https://apm32-baremetal-backend.onrender.com'
};
