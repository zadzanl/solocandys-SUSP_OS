## Why

The current Forza Data Out integration behaves like a continuous live-sync source for calculator inputs, but Forza only streams Data Out while driving and does not directly expose key setup values such as upgraded weight, front weight bias, installed upgrades, or tuning-screen settings. This makes the feature feel flaky and can create false confidence when estimated or lookup-derived values silently replace user-entered calculator inputs.

This change reframes Data Out as a bounded first-drive capture aid: parse a short telemetry window, present snapshot candidates with clear provenance and confidence, and apply selected values only after explicit user confirmation.

## What Changes

- Replace continuous telemetry-driven calculator mutation with an explicit capture workflow:
  - connect to the local bridge,
  - wait for the first valid driving packets or an explicit recapture command,
  - collect a short bounded telemetry window,
  - summarize parsed, lookup-derived, estimated, and unavailable values,
  - let the user apply selected candidates once.
- Distinguish bridge connectivity from UDP packet availability and capture status, including waiting/stale/insufficient-data states.
- Treat parsed Data Out values as snapshot evidence, not as an always-live source of truth for calculator fields.
- Label every suggested field with provenance such as parsed telemetry, stock lookup, estimated, manual, restored, or unavailable.
- Disclose Forza Data Out limitations in the UI/docs: it streams only while driving and does not directly provide weight, front bias, upgrade state, or tune settings.
- Preserve manual-first operation: user edits remain authoritative until the user explicitly captures and applies another snapshot.
- Persist confirmed calculator inputs and optional capture provenance metadata without restoring raw telemetry as calculator state.
- No new package manager, bundler, or third-party runtime dependency is introduced.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `forza-data-out`: Replace continuous live auto-sync semantics with bounded first-drive/explicit recapture snapshots, bridge/packet diagnostics, provenance-labeled candidates, and no continuous calculator mutation after capture closes.
- `vehicle-controls`: Replace live telemetry override behavior with explicit snapshot apply behavior; manual drivetrain, weight, front bias, power, and max-RPM edits remain authoritative after apply.
- `tune-persistence`: Preserve confirmed input source/provenance metadata where supported while keeping legacy tunes and manual operation unaffected.

## Impact

- `index.html`: Future implementation will adjust telemetry state, UI copy, field source labels, capture/review/apply flow, manual override behavior, and local persistence metadata.
- `forza-bridge.js`: Future implementation may add packet-size/format diagnostics and safer parser metadata, but the bridge should remain a transport/parser and should not own calculator state.
- `tests.js`: Future implementation should add parser/status/capture-state tests and guards that telemetry does not continuously mutate calculator inputs after snapshot apply.
- `README.md`: Documentation must be updated to describe the capture workflow and Data Out limitations instead of promising continuous auto-fill.
- OpenSpec specs affected: `forza-data-out`, `vehicle-controls`, and `tune-persistence`.
- Backward compatibility: Manual calculator usage remains first-class. Existing saved/imported tunes without capture metadata continue to load normally.
