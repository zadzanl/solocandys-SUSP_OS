## ADDED Requirements

### Requirement: Static browser entry point
The system MUST preserve a static browser entry point for SUSP.OS while allowing implementation source and styles to be maintained in smaller files that are assembled into a committed root `index.html` artifact.

#### Scenario: Open app from index
- **WHEN** a user opens `index.html` directly in a browser
- **THEN** the app mounts successfully without requiring a backend, bundler, or local development server

#### Scenario: Serve app from static hosting
- **WHEN** the repository is served from static hosting such as GitHub Pages
- **THEN** the app loads the same calculator UI and runtime dependencies needed by the current shipped app

#### Scenario: Keep entry point thin
- **WHEN** implementation files are split out of `index.html`
- **THEN** source files live under `src/` and the committed root `index.html` is generated from them while preserving document metadata, runtime dependency loading, the root mount element, startup error fallback, and app bootstrap behavior

#### Scenario: Ship self-contained local source artifact
- **WHEN** the committed root `index.html` is opened from disk
- **THEN** it does not need to fetch local `src/` CSS or JavaScript files at runtime, because local source content has been assembled into the artifact

### Requirement: Behavior-preserving refactor
The system MUST preserve existing calculator behavior across architecture changes unless a separate OpenSpec change explicitly modifies product behavior.

#### Scenario: Preserve tuning outputs
- **WHEN** representative baseline vehicle and feel fixtures are evaluated before and after the refactor
- **THEN** computed spring, damper, anti-roll-bar, alignment, brake, differential, balance, and response outputs match the approved baseline within existing rounding tolerances

#### Scenario: Preserve UI controls
- **WHEN** the refactored app renders
- **THEN** existing tiers, sections, controls, labels, default values, input limits, help affordances, warnings, and output cards remain available with unchanged semantics

#### Scenario: Preserve runtime integrations
- **WHEN** telemetry bridge, share/import, unit toggle, save slots, and section reset workflows are exercised after the refactor
- **THEN** each workflow remains compatible with the current shipped behavior and data shapes

### Requirement: Baseline regression safeguards
The system MUST establish baseline regression safeguards before moving large blocks of application logic or UI code.

#### Scenario: Existing tests remain required
- **WHEN** any refactor phase changes application structure or shared logic
- **THEN** the canonical dependency-free verification command `node tests.js` passes before the phase is considered complete

#### Scenario: Fixture drift is detected
- **WHEN** deterministic baseline fixtures or snapshots exist
- **THEN** `node tests.js` fails if current output differs from the committed baseline according to the documented per-field comparison rules unless the fixture update command is run intentionally

#### Scenario: Browser startup is checked
- **WHEN** the app-loading strategy changes
- **THEN** verification includes a dependency-free manual browser smoke checklist that confirms React mounts, the preload fallback is replaced, core panels render, and no visible startup error is shown

#### Scenario: Compatibility fixtures cover persistence
- **WHEN** persistence or share/import source is moved
- **THEN** at least one localStorage-shaped save fixture and at least one share/import fixture continue to decode and apply without data loss

### Requirement: Reviewable extraction phases
The system MUST split the refactor into small, reviewable phases with explicit rollback and verification points.

#### Scenario: Validate loading strategy first
- **WHEN** JSX or application source is moved out of inline `index.html`
- **THEN** implementation uses the approved dependency-free assembly strategy and proves the generated root `index.html` preserves direct-open and static-hosting usage before broad extraction continues

#### Scenario: Move CSS without semantic edits
- **WHEN** CSS is first extracted from `index.html`
- **THEN** selectors and declarations are moved mechanically with order preserved before any style reorganization is attempted

#### Scenario: Extract deterministic logic before deep UI splitting
- **WHEN** app code is split beyond a single source file
- **THEN** pure physics, solver, conversion, codec, and compatibility helpers are prioritized for extraction before fine-grained React component splitting

#### Scenario: Define shared module contracts
- **WHEN** deterministic helpers are extracted for reuse by browser and Node tests
- **THEN** the shared modules define their browser namespace, CommonJS export shape, exported function names, and assembly order before tests are updated to consume them

### Requirement: Deterministic assembly safeguards
The system MUST provide a deterministic, dependency-free assembly process that prevents source/generated artifact drift.

#### Scenario: Assemble with Node built-ins
- **WHEN** `node assemble.js` runs
- **THEN** it uses Node built-ins only, reads the approved `src/` source files, and writes the committed root `index.html` artifact

#### Scenario: Detect out-of-sync artifact
- **WHEN** `node tests.js` runs after the assembler exists
- **THEN** it generates `index.html` in memory using the same assembly helper and fails if the generated bytes differ from the committed `index.html`

#### Scenario: Preserve launch workflow
- **WHEN** `launch.bat` runs on a machine with Node installed
- **THEN** it runs `node assemble.js` before opening `index.html` and stops with a clear error if assembly fails

#### Scenario: Preserve no-Node fallback
- **WHEN** `launch.bat` runs on a machine without Node installed
- **THEN** it preserves the current fallback behavior by warning the user, opening the committed `index.html`, and skipping telemetry bridge startup

#### Scenario: Document workflow changes
- **WHEN** the final architecture changes file layout, run workflow, test workflow, or snapshot/update commands
- **THEN** `README.md` is reviewed and updated in the same change
