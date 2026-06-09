## Context

SUSP.OS currently ships as a single static `index.html` containing React 18 UMD/CDN dependencies, Babel standalone, inline CSS, the JSX application source, and a runtime Babel transform/eval bootstrap. This keeps distribution simple but makes the file difficult to review safely: physics formulas, solver logic, persistence, telemetry capture, and UI components are all coupled in one ~4,700-line file.

The repository has a dependency-free Node test suite (`node tests.js`) that covers important physics and telemetry behavior, but much of the physics logic is mirrored in the test file instead of imported from the browser implementation. That protects known formulas but leaves gaps around app-level outputs, persistence/share compatibility, and browser mount behavior.

External references reviewed for this design:
- Babel standalone supports browser-side compilation of `type="text/babel"` / `type="text/jsx"` script tags and supports module mode via `data-type="module"`.
- Babel documentation cautions that production apps normally transpile ahead of time with a build system, so continuing runtime Babel is a deliberate compatibility trade-off rather than a modernization endpoint.
- Playwright supports visual and text snapshots, but dependency-free browser automation is out of scope for this change unless separately approved. Browser smoke verification will start as a documented manual checklist.

## Goals / Non-Goals

**Goals:**
- Preserve current calculator behavior, formulas, constants, defaults, ranges, rounding, persistence semantics, telemetry behavior, and UI workflows.
- Modularize `index.html` into smaller files (CSS, physics solvers, codecs, and components) to make them readable and maintainable.
- Support direct-open via the `file://` protocol and static hosting (GitHub Pages) for the final entry point without requiring any local server or runtime dependencies.
- Establish baseline regression coverage of 100+ cases before changing application structure or moving code.
- Share extracted physics and solver code (`src/physics.js`) between the browser app and the Node.js test suite, eliminating mirrored test logic.
- Keep developer workflows simple: ensure local modifications are automatically assembled when launching or running tests.

**Non-Goals:**
- No physics recalibration or tuning formula changes.
- No UI redesign, tier behavior change, new tuning feature, or control rename.
- No replacement of React, no framework migration, and no bundler (Webpack/Vite/Rollup) setup.
- No required runtime backend or local dev server.
- No npm dependencies added to `package.json` for compilation or testing; keep the repository dependency-free.

## Decisions

### Decision 1: Use Build-Time Assembly to bypass CORS restrictions
Modern browsers block fetching external files via Babel Standalone (XHR/fetch) and block ES module imports under the `file://` protocol due to null-origin CORS restrictions. To allow developer file-splitting while keeping the app directly openable via double-click, we will use a **Build-Time Assembly** approach:
- Source code is split into logical components, stylesheets, and solvers under a `src/` directory.
- A zero-dependency script `assemble.js` runs in Node.js, reads the template `src/index.template.html`, injects stylesheets and scripts, and writes a single consolidated `index.html` to the root.
- The compiled root `index.html` is committed directly to the repository and is the authoritative shipped artifact for end users.
- The shipped `index.html` must inline local CSS and app source generated from `src/`; it may keep the existing CDN references for React, ReactDOM, and Babel, but it must not depend on browser loading of local `src/` files.

### Decision 2: Keep the build tool dependency-free using Node.js built-ins
The assembly tool `assemble.js` will be written in standard Node.js using only native modules. This avoids introducing any `node_modules` directory, `package.json` packages, or external dependencies, keeping the repository extremely lightweight.

The assembler must expose a reusable helper, for example `assembleIndexHtml()`, so `tests.js` can generate the candidate artifact in memory using the exact same code path as `node assemble.js`. Output must be deterministic: stable file ordering, stable template markers, stable newline handling, and UTF-8 output.

### Decision 3: Define shared module contracts before extraction

The split source layout must define an explicit contract for shared deterministic modules before implementation moves formulas:
- `src/physics.js` owns constants, unit conversions, chassis math, ride/damping/ARB solvers, and exported calculator functions needed by tests.
- `src/codec.js` owns share/import encode/decode and compatibility helpers.
- Shared files use a tiny UMD-style wrapper or equivalent dependency-free pattern so the same file can attach to a browser namespace and export through CommonJS in Node.
- Assembly order must inject shared modules before JSX application code.
- Browser globals must be namespaced to avoid leaking many top-level symbols; tests must import the CommonJS exports from the same files.

### Decision 4: Add Sandbox-based Automated Snapshot fixtures
Before extracting any logic, we will write a script `tests/generate-regression-fixtures.js` that extracts or adapts the current deterministic solver/codec API from `index.html`, evaluates it in a Node.js sandbox, and evaluates a matrix of **100+ input cases** (varying weights, biases, tyre sizes, feel stiffnesses, presets, layouts).
- The calculated outputs are saved to `tests/fixtures/regression_suite.json`.
- The fixture schema must be defined before generation: case inputs, output fields, comparison mode per field, source implementation metadata, and generator version.
- The generator must fail if required extraction markers or APIs are missing rather than silently producing partial fixtures.
- Post-refactor, `tests/regression-runner.js` imports the extracted modules (`src/physics.js`, `src/codec.js`) and compares calculations against the JSON baseline with field-specific comparison rules.

### Decision 5: Implement Out-of-Sync Safeguard in tests.js and launch.bat
To prevent developers from committing changes to files in `src/` without assembling the final page, we implement two checks:
- **Test sync check**: `node tests.js` will compile the source files in-memory through the assembler helper and assert that it matches the current `index.html` on disk. If they differ, the test suite fails and instructs the developer to run `node assemble.js`.
- **Canonical verification**: `node tests.js` becomes the dependency-free command that runs existing unit tests, artifact sync checks, and regression fixtures once the runner is enabled.
- **Launch auto-assemble**: `launch.bat` is modified to run `node assemble.js` automatically if Node is installed, before opening `index.html`.
- **Launch failure behavior**: if Node is not installed, `launch.bat` preserves the current behavior and still opens the committed `index.html` while warning that telemetry/assembly are unavailable. If Node is installed but `assemble.js` fails, the launcher fails closed: print the assembler error, pause, and do not start the browser or telemetry bridge, because launching a stale generated artifact would hide developer drift.

### Decision 6: Keep browser smoke verification dependency-free

No browser automation dependency will be added in this change. Browser verification will be a required manual smoke checklist documented in `README.md` and/or implementation notes. The checklist must verify direct-open startup, preload replacement, no visible startup error, core panels render, tier/unit toggles respond, share/import works with a representative fixture, and `launch.bat` still starts the app/bridge path.

---

## Risks / Trade-offs

- **External JSX fails under file://** → Mitigated completely by compile-time assembly (`assemble.js`) that produces a fully self-contained `index.html`.
- **Out-of-sync source/compiled files** → Mitigated by the in-memory compiler check in `tests.js` that fails tests on developer drift.
- **Tuning formulas change during refactor** → Mitigated by the sandbox-based regression suite verifying 100+ cases with documented per-field comparison rules.
- **Mirrored tests pass while app logic drifts** → Mitigated by sharing `src/physics.js` and `src/codec.js` (using a UMD wrapper) directly with `tests.js` so they run on the same implementation.
- **Regression fixtures miss behavior because baseline extraction is incomplete** → Mitigated by requiring explicit API markers/schema and failing generation if required functions cannot be found.
- **Exact artifact comparison is noisy across Windows/Linux newline handling** → Mitigated by making the assembler helper the single source of generated bytes and normalizing output deterministically before both write and comparison.
- **Automatic assembly in `launch.bat` hides errors by launching stale HTML** → Mitigated by failing closed when Node exists but assembly fails.

---

## Migration Plan

1. **Pre-Refactor Baseline**: Define the regression fixture schema and baseline API, then write `tests/generate-regression-fixtures.js` to extract or adapt and run the current deterministic solvers/codecs. Run it to generate `tests/fixtures/regression_suite.json`.
2. **Setup Assembler**: Write `assemble.js` and `src/index.template.html`, including reusable in-memory assembly helper and deterministic output rules.
3. **Mechanical Extraction**:
   - Extract CSS to `src/styles.css`.
   - Extract physics solvers to `src/physics.js` with UMD module wrapper.
   - Extract share codecs to `src/codec.js` with UMD module wrapper.
   - Extract JSX UI components to `src/components/` (e.g. `App.jsx`, `Cards.jsx`, `HandlingVerdict.jsx`, `PresetSlots.jsx`).
4. **Wire Assembly**: Run `node assemble.js` to compile the split files and assert that the generated `index.html` preserves the approved baseline behavior and matches the deterministic in-memory assembly output.
5. **Integrate Verification**: 
   - Write `tests/regression-runner.js` to run the regression assertions.
   - Add the sync safeguard check to `tests.js`.
   - Make `node tests.js` the canonical command that runs existing tests, sync guard, and enabled regression assertions.
   - Update `launch.bat` to run `node assemble.js` before launch.
6. **Documentation**: Update `README.md` to document the new `src/` file layout, `node assemble.js`, `node tests.js`, snapshot generation/update policy, manual browser smoke checklist, and launcher behavior.

---

## Open Questions

All open questions have been resolved:
- **Tooling**: Node.js built-ins only; no npm packages.
- **CORS file:// mitigation**: Build-time assembly (`assemble.js`) is adopted.
- **Regression test policy**: Automated JSON snapshot fixtures committed and verified in tests.
- **Syncing**: Auto-run assembly in `launch.bat` and assert parity in `tests.js`.
