# wasm-clang (vendored)

Real Clang + LLD, compiled to WebAssembly, running entirely client-side.
Used by [`WasmToolchain.js`](../../js/core/WasmToolchain.js) to compile+run
plain host C for Learn mode and Playground, in-browser, no backend round
trip -- see that file's own header comment for the full story of why this
exists (client-side compilation), and why it's vendored here specifically
instead of loaded from a CDN.

## Why vendored, not CDN-loaded

The first working version of this feature used Wasmer's `clang.wasm`
package (`@wasmer/sdk`'s `Wasmer.fromRegistry('clang/clang')`), fetched
live from `registry.wasmer.io` on every first use. That registry went
unreachable mid-session (confirmed independently from two different
network paths, and from a real user's own browser -- not a one-off local
network quirk), taking the whole feature down with it even though nothing
in our own code was wrong. Same lesson as `vendor/dapjs/`: a live
third-party fetch at runtime is a single point of failure this app
shouldn't depend on for something this central.

`binji/wasm-clang` (<https://github.com/binji/wasm-clang>, live demo at
<https://binji.github.io/wasm-clang/>) ships its compiled `clang`/`lld`
binaries as plain static files with no registry/API involved at all --
confirmed working with a real compile+link+run before adopting it. Once
downloaded into this folder, the whole toolchain is a normal part of this
app's own static assets, same as everything else `express.static` serves.

## Files here

- `clang` (~31MB), `lld` (~19MB) -- the actual compiler/linker, as WASM.
- `memfs` (~340KB) -- the in-memory filesystem module they both run against.
- `sysroot.tar` (~9MB) -- libc/libc++ headers and prebuilt static libs.
- `shared.js` -- the JS orchestration layer (the `API` class: write files
  into the virtual FS, invoke clang/lld, capture stdout/stdin). **Patched**
  from upstream in three small, clearly-commented spots (see the file's own
  top-of-file comment): `compile()` gained `lang`/`includeDirs` options
  (upstream hardcodes `-x c++` and has no way to pass extra `-I` flags --
  this app compiles plain C, sometimes across multiple files/directories);
  a new `linkMulti()` method (upstream's `link()` only accepts one object
  file, since its own demo only ever compiles one); and a `window.WasmClangAPI`
  export at the very end (upstream only ever loads this via
  `importScripts()` inside its own dedicated Worker, where the top-level
  `const API` it declares is already directly in scope for the sibling
  script that uses it -- loaded here as a plain `<script>` from an ES
  module instead, which needs an explicit handoff).
- `LICENSE` -- upstream's own license file (Apache-2.0).

## Known limitations (inherited from upstream, not something we can fix
without forking further)

- stdout and stderr are **not separated** -- both funnel through the same
  `hostWrite` callback as one interleaved string. Fine for grading
  exercises that only ever print to stdout (the overwhelming majority);
  something to watch for if an exercise's expected output starts including
  stderr-only diagnostics.
- Everything runs on the **main thread**, not a Worker -- upstream's own
  `worker.js`/`web.js` (not vendored here) show how to move this off-thread
  via `postMessage`, worth doing later if compile times ever visibly
  block the UI for larger exercises.

## Updating

Re-fetch `clang`/`lld`/`memfs`/`sysroot.tar`/`shared.js`/`LICENSE` from
<https://binji.github.io/wasm-clang/>, then re-apply the same three
`shared.js` patches described above (diff against upstream's copy to see
exactly what changed).
