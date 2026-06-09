# tune-persistence Specification

## Purpose
Provides persistent save slots, preset loading with car-aware scaling, Base64 share/import codec, and app/section reset behavior.
## Requirements
### Requirement: Save slots
The system MUST provide six persistent tune slots with names, notes, overwrite, clear, and default-preset behavior.

#### Scenario: Load a saved slot
- **WHEN** the user activates a saved slot name
- **THEN** the saved feel settings load into the current session

#### Scenario: Rename and annotate a slot
- **WHEN** the user edits a slot name or notes
- **THEN** the updated metadata persists locally with the slot

#### Scenario: Protect destructive slot actions
- **WHEN** the user overwrites, clears, or resets a slot
- **THEN** the action requires a two-tap confirmation within the configured confirmation window

#### Scenario: Save to first empty slot with auto name
- **WHEN** the user activates SAVE on an empty slot
- **THEN** the current tune is saved into that slot and automatically named in the format `{BUILD} {Hz}` (e.g. `TRACK 2.29`)

### Requirement: Car-aware slot scaling
The system MUST scale saved ride stiffness when loading onto a different-weight car using saved reference corner mass and current corner mass.

#### Scenario: Load onto heavier car
- **WHEN** a slot saved on a lighter car is loaded onto a heavier car
- **THEN** ride stiffness scales downward by the square root of saved mass divided by current mass

#### Scenario: Load onto same-mass car
- **WHEN** a slot is loaded onto a car with the same reference corner mass
- **THEN** ride stiffness remains unchanged apart from normal clamping

#### Scenario: Built-in presets also scale by car mass
- **WHEN** a built-in preset is loaded
- **THEN** ride stiffness is scaled by the square root of the preset's reference corner mass divided by the current corner mass, using the same formula as saved slots

### Requirement: Load-mode toggle
The system MUST provide a toggle between FE (feel-only) and FE+DR (feel plus drivetrain) load modes when loading a slot or preset.

#### Scenario: FE+DR load mode
- **WHEN** load mode is FE+DR
- **THEN** the slot's drivetrain state is loaded alongside the feel state

#### Scenario: FE load mode
- **WHEN** load mode is FE
- **THEN** only the slot's feel state is loaded and the current drivetrain state is preserved

### Requirement: Share and import codec
The system MUST encode the full tune state as a compact Base64 string and MUST import valid tune strings into chassis, feel, drivetrain, and brake state.

#### Scenario: Share current tune
- **WHEN** the user activates SHARE
- **THEN** the app generates a Base64 code containing chassis, feel, drivetrain, ARB, brake, and solver-mode values

#### Scenario: Import valid tune
- **WHEN** the user pastes a valid tune code
- **THEN** the decoded and sanitized values replace the current tune state

#### Scenario: Reject invalid tune
- **WHEN** the user pastes an invalid tune code
- **THEN** the app reports an invalid-code error instead of applying partial state

### Requirement: Legacy compatibility and sanitization
The system MUST decode older tune formats safely and MUST clamp imported values to supported ranges.

#### Scenario: Decode legacy JSON tune
- **WHEN** an imported code decodes to the legacy JSON payload format
- **THEN** the system maps the payload into current chassis, feel, drivetrain, and brake structures

#### Scenario: Default missing newer fields
- **WHEN** an imported code lacks fields added in newer versions
- **THEN** the system supplies current defaults for those fields

#### Scenario: Clamp unsafe imported values
- **WHEN** imported numeric values are outside supported ranges
- **THEN** sanitizeTune clamps them before applying state

### Requirement: Reset behavior
The system MUST support app-level and section-level resets without deleting saved slots unless the specific slot action is used.

#### Scenario: Reset a section
- **WHEN** a section reset is confirmed
- **THEN** only that section's state returns to defaults

#### Scenario: Reset app defaults
- **WHEN** the app reset flow is confirmed
- **THEN** selected tune and/or tutorial state resets while saved slots are preserved

#### Scenario: Beginner tier coerces rear Hz mode on load
- **WHEN** a slot or preset is loaded while the active tier is BEG
- **THEN** the rear Hz mode is coerced to MULTIPLIER if it was INDEPENDENT, preserving Beginner-tier simplicity

### Requirement: Capture provenance persistence
The system MUST preserve confirmed capture provenance metadata where supported without requiring that metadata for save-slot loading, sharing, importing, or legacy compatibility.

#### Scenario: Persist confirmed capture source metadata
- **WHEN** the user applies snapshot candidates to calculator inputs and those inputs are persisted locally
- **THEN** the system stores available source metadata such as source type, confidence, captured-at timestamp, and field-level confirmation state alongside the confirmed values where supported

#### Scenario: Restore confirmed values with provenance
- **WHEN** persisted confirmed values with capture provenance are restored
- **THEN** the system identifies them as restored confirmed values and does not treat raw live telemetry as current calculator input

#### Scenario: Load legacy tune without provenance
- **WHEN** a saved slot or imported tune does not include capture provenance metadata
- **THEN** the system loads and sanitizes the tune normally using existing defaults and does not require telemetry metadata

#### Scenario: Do not persist raw telemetry as calculator state
- **WHEN** live telemetry packets are received but their values have not been explicitly applied by the user
- **THEN** the system does not save those raw packet values as confirmed calculator inputs

