## ADDED Requirements

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
