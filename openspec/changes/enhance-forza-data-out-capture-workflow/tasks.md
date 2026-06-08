## 1. Telemetry State Model

- [ ] 1.1 Replace the single telemetry connection state with separate bridge, packet, capture, and snapshot states in `index.html`
- [ ] 1.2 Track packet diagnostics including packet count, last packet timestamp, packet rate, packet length, and detected/parser format where available
- [ ] 1.3 Add stale/paused packet detection when the bridge remains connected but packets stop arriving
- [ ] 1.4 Ensure manual calculator inputs remain editable when no applied capture is controlling them

## 2. Bridge Parser Diagnostics

- [ ] 2.1 Refactor `forza-bridge.js` packet parsing into named parser profiles for supported Horizon and Motorsport formats
- [ ] 2.2 Prevent dashboard-only reads from unsupported packet formats such as Motorsport Sled packets
- [ ] 2.3 Include parser metadata and packet-format warnings in the SSE payload
- [ ] 2.4 Keep the bridge limited to transport/parsing/diagnostics and avoid calculator-state logic in Node

## 3. Bounded First-Drive Capture

- [ ] 3.1 Start a bounded first-drive capture when valid driving packets arrive after connecting and no current snapshot exists
- [ ] 3.2 Add an explicit recapture control that starts a new bounded capture without replacing confirmed inputs until apply
- [ ] 3.3 Stop collecting candidate input values when the capture reaches its default short duration target of about 5–10 seconds, sample target, cancellation, timeout, or insufficient-data result
- [ ] 3.4 Allow visible diagnostics to continue after capture closes without mutating calculator inputs

## 4. Snapshot Candidate Generation

- [ ] 4.1 Generate parsed candidates for direct telemetry fields such as `CarOrdinal`, `DrivetrainType`, RPM, speed, power, and torque when parser confidence is sufficient
- [ ] 4.2 Generate lookup candidates from `CAR_DATABASE` with stock/baseline provenance rather than direct telemetry provenance
- [ ] 4.3 Reframe weight estimation as a capture-only candidate with confidence metadata and insufficient-sample handling
- [ ] 4.4 Mark unavailable direct fields such as front bias, installed upgrades, tune settings, spring rates, damping, ARBs, brake balance, and diff settings as manual-required unless a non-telemetry source supplies them

## 5. Review and Apply Workflow

- [ ] 5.1 Add a pending snapshot review UI showing each candidate value, source, confidence, and explanation
- [ ] 5.2 Add apply controls that update only user-selected calculator fields once
- [ ] 5.3 Add keep-current/cancel behavior that leaves existing calculator inputs unchanged
- [ ] 5.4 Ensure telemetry packets after apply do not alter weight, front bias, layout, power, or max RPM until another explicit capture is applied

## 6. Field Source and Persistence

- [ ] 6.1 Add field-level source metadata for capture-assisted inputs such as manual, parsed, lookup, estimated, restored, or unavailable
- [ ] 6.2 Show concise source/confidence markers next to relevant vehicle controls without blocking manual editing
- [ ] 6.3 Persist confirmed source/provenance metadata where supported while keeping raw telemetry out of confirmed calculator state
- [ ] 6.4 Preserve legacy save/import compatibility when provenance metadata is missing

## 7. Tests and Verification

- [ ] 7.1 Add unit tests for parser profile selection and unsupported packet-format handling
- [ ] 7.2 Add tests for capture lifecycle transitions including first-drive capture, timeout, insufficient data, apply, cancel, stale packets, and recapture
- [ ] 7.3 Add regression tests proving telemetry does not continuously mutate calculator inputs after capture closes or a snapshot is applied
- [ ] 7.4 Run `node tests.js` and confirm all tests pass
- [ ] 7.5 Run `openspec validate --strict` and confirm all specs pass

## 8. Documentation

- [ ] 8.1 Update `README.md` to describe Data Out as a driving-only capture aid rather than a continuous auto-fill source
- [ ] 8.2 Document that weight, front bias, installed upgrades, and tune settings are not directly provided by Data Out
- [ ] 8.3 Document the bridge/packet/capture status meanings and common troubleshooting steps
- [ ] 8.4 Review README consistency with changed UI controls, input behavior, and telemetry workflow
