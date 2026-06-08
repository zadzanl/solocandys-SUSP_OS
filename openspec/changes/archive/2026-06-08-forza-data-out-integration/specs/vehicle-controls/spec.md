# vehicle-controls Specification

## Purpose
Manages build type, drivetrain layout, alignment, differential, brake, and game-mode controls that adapt solver recommendations and output limits.

## MODIFIED Requirements

### Requirement: Build type and drivetrain layout
The system MUST let the user select build type and drivetrain layout and MUST use those selections to adjust alignment, differential, brake, and balance guidance, allowing these inputs to be overridden or auto-populated by live telemetry.

#### Scenario: Select build type
- **WHEN** the user selects STREET, TRACK, or DRIFT
- **THEN** recommendation ranges and automatic control heuristics update for that build style

#### Scenario: Select drivetrain layout
- **WHEN** the user selects FWD, RWD, or AWD
- **THEN** differential controls and handling-balance contribution labels adapt to that layout

#### Scenario: Override drivetrain layout with telemetry
- **WHEN** drivetrain layout is auto-detected and pushed via telemetry and the field is locked/synced
- **THEN** the UI updates the selected layout accordingly and adapts differential controls and handling-balance contribution labels

#### Scenario: Decouple inputs from telemetry manual override
- **WHEN** the user unlocks/decouples a telemetry-synced input field (such as drivetrain layout, weight, front weight bias, power, or max RPM)
- **THEN** the input accepts manual user input and ignores future telemetry updates for that field
