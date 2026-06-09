## MODIFIED Requirements

### Requirement: Build type and drivetrain layout
The system MUST let the user select build type and drivetrain layout and MUST use those selections to adjust alignment, differential, brake, and balance guidance. Telemetry capture snapshots MAY provide candidate values, but calculator inputs MUST only change when the user explicitly applies a snapshot or edits fields manually.

#### Scenario: Select build type
- **WHEN** the user selects STREET, TRACK, or DRIFT
- **THEN** recommendation ranges and automatic control heuristics update for that build style

#### Scenario: Select drivetrain layout
- **WHEN** the user selects FWD, RWD, or AWD
- **THEN** differential controls and handling-balance contribution labels adapt to that layout

#### Scenario: Apply captured drivetrain layout
- **WHEN** a telemetry capture snapshot includes a drivetrain layout candidate and the user explicitly applies it
- **THEN** the UI updates the selected layout once and adapts differential controls and handling-balance contribution labels

#### Scenario: Decouple inputs from telemetry manual override
- **WHEN** the user manually edits a capture-assisted input field such as drivetrain layout, weight, front weight bias, power, or max RPM
- **THEN** the input accepts the manual user value and ignores future telemetry packets until the user explicitly captures and applies a new snapshot for that field

#### Scenario: No continuous vehicle-control mutation
- **WHEN** telemetry packets continue arriving after a snapshot has been applied or dismissed
- **THEN** build type, drivetrain layout, weight, front bias, power, and max RPM remain unchanged unless the user edits them manually or applies a new snapshot
