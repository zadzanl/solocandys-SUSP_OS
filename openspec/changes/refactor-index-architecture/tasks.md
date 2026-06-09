## 1. OpenSpec proposal review

- [x] 1.1 Create OpenSpec change scaffold for `refactor-index-architecture`.
- [x] 1.2 Draft proposal, design, and `app-architecture` capability spec.
- [x] 1.3 Validate the OpenSpec change with `openspec validate refactor-index-architecture --strict`.
- [ ] 1.4 Pause for user review/approval of proposal, design, scope gates, and dependency/tooling policy before implementation.

## 2. Baseline regression safeguards & sandbox

- [ ] 2.1 Run and record the current baseline for `node tests.js` before changing app structure.
- [ ] 2.2 Define the regression fixture schema, baseline API surface, required extraction markers/polyfills, output fields, and per-field comparison rules.
- [ ] 2.3 Create `tests/generate-regression-fixtures.js` to extract or adapt and evaluate the current `index.html` deterministic physics/solver/codec behavior in a Node.js sandbox.
- [ ] 2.4 Generate `tests/fixtures/regression_suite.json` covering 100+ representative cases (varying weights, front bias, track widths, wheelbase, tyre widths, CG heights, ride stiffness, target speed, rear Hz modes, damping bias, ARB limits, FWD/RWD/AWD layouts, presets, and share-code encode/decode cases).
- [ ] 2.5 Create `tests/regression-runner.js` with a pre-refactor mode or disabled post-refactor module mode until `src/physics.js` and `src/codec.js` exist.
- [ ] 2.6 Verify baseline generation fails loudly if required APIs/markers are missing and passes on the current implementation.

## 3. AOT Assembly & Spikes

- [ ] 3.1 Implement a zero-dependency build-time assembly script `assemble.js` using Node built-ins only and exporting a reusable in-memory assembly helper for tests.
- [ ] 3.2 Create `src/index.template.html` and define explicit injection placeholders for CSS, shared modules, app JSX/source, and bootstrap code.
- [ ] 3.3 Define deterministic assembly rules: stable file order, UTF-8 output, normalized newlines, no timestamps, and identical bytes from CLI write vs test in-memory generation.
- [ ] 3.4 Verify that running `node assemble.js` compiles split files into a self-contained, directly-openable `index.html` that does not reference local `src/` assets at runtime.
- [ ] 3.5 Modify `launch.bat` to automatically execute `node assemble.js` before opening `index.html` when Node is installed.
- [ ] 3.6 Ensure `launch.bat` preserves current no-Node behavior by opening committed `index.html` with a warning, but fails closed if Node exists and assembly fails.

## 4. Mechanical file extraction & safeguards

- [ ] 4.1 Extract inline CSS mechanically into `src/styles.css` with selector order preserved.
- [ ] 4.2 Define shared module contracts for `src/physics.js` and `src/codec.js`: exported names, browser namespace, CommonJS export shape, and assembly order.
- [ ] 4.3 Extract physics solvers and codecs into the shared modules and update tests to consume the same implementation where practical.
- [ ] 4.4 Extract React components and sub-elements into modular JSX files under `src/components/`, keeping assembly order explicit and behavior unchanged.
- [ ] 4.5 Add an out-of-sync safeguard in `tests.js` that calls the shared assembler helper in memory and asserts exact deterministic match with `index.html` on disk.
- [ ] 4.6 Enable `tests/regression-runner.js` against the new shared modules and include it in the normal `node tests.js` verification path.
- [ ] 4.7 Verify `node tests.js`, the regression runner, and direct-open manual browser smoke tests pass after extraction.

## 5. Shared deterministic logic extraction

- [ ] 5.1 Extract constants, unit conversions, physics helpers, and solver helpers into shared source where practical.
- [ ] 5.2 Update tests to consume shared deterministic implementation where practical instead of mirrored copies.
- [ ] 5.3 Preserve existing formulas, constants, rounding, input limits, and migration behavior.
- [ ] 5.4 Verify fixture snapshots and `node tests.js` after each extraction step.

## 6. UI and state decomposition

- [ ] 6.1 Split React UI in coarse reviewable sections before any fine-grained component reorganization.
- [ ] 6.2 Extract persistence/share/import helpers only after compatibility fixtures are in place.
- [ ] 6.3 Extract telemetry/data-out UI or hooks only after existing telemetry parser/state-machine coverage remains green.
- [ ] 6.4 Verify tier toggles, unit toggle, output cards, save slots, share/import, and telemetry connection UI manually or via approved browser smoke tests.

## 7. Dependency-free browser smoke verification

- [ ] 7.1 Do not add npm/browser automation dependencies in this change.
- [ ] 7.2 Define a required manual browser smoke checklist covering direct-open startup, preload replacement, visible startup errors, core panel rendering, tier toggle, unit toggle, share/import with a representative fixture, save slot interaction, and launch.bat app/bridge startup.
- [ ] 7.3 Complete and record the manual browser smoke checklist before final verification.

## 8. Documentation and final verification

- [ ] 8.1 Review and update `README.md` for changed file layout, `node assemble.js`, canonical `node tests.js`, regression fixture generation/update policy, launch.bat behavior, and manual browser smoke checklist.
- [ ] 8.2 Run final verification: `openspec validate refactor-index-architecture --strict`, `node tests.js`, and browser direct-open smoke.
- [ ] 8.3 Review diff for unintended behavior or documentation drift.
- [ ] 8.4 Pause for user confirmation before archiving the OpenSpec change.
