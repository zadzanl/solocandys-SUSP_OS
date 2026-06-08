## Why

SUSP.OS is a brownfield, post-implementation project: the app already ships as a single-file Forza suspension calculator, but the OpenSpec baseline is empty. This change retroactively captures the shipped product behavior in OpenSpec so future work can be proposed against explicit current-state requirements instead of README prose and source-code inspection alone.

## What Changes

- Document the current physics, solver, UI, persistence, feedback, and tooling capabilities as OpenSpec specs.
- Keep the documentation descriptive only; no runtime app behavior changes are planned in this sprint.
- Establish capability boundaries that mirror the app's existing architecture: pure physics functions, React UI modes, local persistence/share codec, and regression tests.

## Capabilities

### New Capabilities
- `physics-core`: Core units, chassis mass/load-transfer calculations, tire parsing, calibration constants, and mechanical/grip balance concepts.
- `ride-damping`: Spring-frequency, rear-Hz derivation, ride reference, spring-rate, and damping-ratio solver behavior.
- `roll-stiffness`: Anti-roll-bar budgeting, balance modes, click limits, manual ARB calibration, and CO-SOLVE behavior.
- `vehicle-controls`: Alignment, differential, brake, game-mode, layout, and build-type recommendation behavior.
- `tune-persistence`: Local save slots, car-aware scaling, share/import codec, legacy-code handling, and reset semantics.
- `guided-ui`: BEG/INT/PRO tiering, tutorials, responsive layout, section visibility, unit toggles, and mobile behavior.
- `feedback-readouts`: Output cards, handling balance, response bar, warnings, derived strips, tune check, and actionable tips.

### Modified Capabilities
- None. This is the initial OpenSpec baseline for already-shipped behavior.

## Impact

- Affected docs: `openspec/changes/document-current-baseline/**`, then archived into `openspec/specs/**`.
- Affected runtime code: none.
- Verification commands: `openspec validate --all --strict --json`, `openspec list --specs --json`, `node tests.js`.