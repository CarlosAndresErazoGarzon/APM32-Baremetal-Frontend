# Vendored: dapjs 2.3.0

`dap.umd.js`, fetched from `https://cdn.jsdelivr.net/npm/dapjs@2.3.0/dist/dap.umd.js`
and committed here instead of loaded from an unpinned CDN URL.

This is the direct fix for how this session's flashing bug started: the
app used to load `dapjs` via `https://cdn.jsdelivr.net/npm/dapjs/dist/dap.umd.js`
with no version pin, which silently resolves to whatever's newest. A
class the code called (`DAPjs.WebSerialTransport`) never actually existed
in any published version -- easy to not notice when the exact bundle
being served can drift under you. Pinning + vendoring means "it works
today" stays true tomorrow regardless of what jsDelivr/npm serve next.

Confirmed exports in this exact file: `ADI`, `CmsisDAP`, `CortexM`,
`DAPLink`, `DEFAULT_CLOCK_FREQUENCY`, `HID`, `USB`, `WebUSB` -- this app
uses `WebUSB` (transport) and `CortexM` (the DAP/SWD command layer),
in `frontend/js/blocs/DapBloc.js`.

To update: fetch a newer pinned version the same way, replace this file,
and re-check the export list above still holds (`grep -oE
'[A-Za-z]*Transport|CortexM|WebUSB' dap.umd.js`).
