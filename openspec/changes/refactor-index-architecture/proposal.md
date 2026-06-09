## Why

`index.html` has grown into a ~4,700-line single-file application, making unrelated physics, persistence, telemetry, and UI changes risky to review and easy to regress. Refactoring the app into a modular, split-source development layout now will lower maintenance risk while preserving the zero-dependency, download-and-open local file workflow.

## What Changes

- Split the current inline CSS, React/Babel components, physics solvers, and codecs out of `index.html` into structured local development files under a `src/` directory.
- Implement a zero-dependency, build-time Node.js assembly script (`assemble.js` using built-in Node modules only, primarily `fs` and `path`) that compiles the modular sources into a single self-contained, committed `index.html` artifact.
- Keep the committed `index.html` in the root directory so end-users can continue to double-click and run the app locally via `file://` or launch it via `launch.bat` with no dependencies or local server.
- Automatically trigger `assemble.js` on `launch.bat` if Node is installed, ensuring local changes are automatically built on launch.
- Extract deterministic physics/solver and codec code into reusable UMD modules (`src/physics.js` and `src/codec.js`) that can be consumed directly by both the browser app and the Node.js test suite, eliminating mirrored test formulas.
- Add baseline anti-regression safeguards:
  - Generate a regression fixture (`tests/fixtures/regression_suite.json`) containing outputs for 100+ representative cases (vehicles, tiers, modes, units, share codes) evaluated by the pre-refactor implementation in a Node.js sandbox or explicitly extracted baseline harness.
  - Implement a regression test runner (`tests/regression-runner.js`) that compares the refactored code against the baseline using per-field comparison rules: exact matches for strings/enums/booleans/share payloads, numeric tolerances for raw solver values, and existing rounding tolerances for UI-facing values.
  - Add an out-of-sync safeguard in `tests.js` that uses the same assembly helper as `assemble.js` to check if the compiled `index.html` exactly matches the committed artifact after deterministic newline/encoding handling.
- Document any new file layout and verification workflow in `README.md`.
- No intentional changes to tuning formulas, UI controls, input ranges, persistence semantics, telemetry behavior, or generated values.

## Capabilities

### New Capabilities
- `app-architecture`: Defines the build-time assembly architecture, module boundaries, and regression-safety requirements for maintaining the browser app without changing calculator behavior.

### Modified Capabilities
- None. This change is intended to be behavior-preserving; existing product capabilities should keep their current requirements.

## Impact

- Affected code: `index.html`, `launch.bat`, `tests.js`; new `src/` directory (for modularized CSS, physics, codecs, and JSX components); new `assemble.js` script; new regression tests (`tests/generate-regression-fixtures.js`, `tests/regression-runner.js`, `tests/fixtures/regression_suite.json`).
- Affected docs: `README.md` to document the source layout, `node assemble.js` command, and testing workflow.
- Dependencies: Zero new runtime or development dependencies. The assembler and test helpers run purely using Node.js built-ins, keeping the repository dependency-free.
- Compatibility: Existing direct browser usage (via `file://`), share/import codes, localStorage saves, telemetry bridge integration, and static hosting on GitHub Pages must remain 100% compatible.
