## Purpose
Manages build type, drivetrain layout, alignment, differential, brake, and game-mode controls that adapt solver recommendations and output limits.

## ADDED Requirements

### Requirement: Build type and drivetrain layout
The system MUST let the user select build type and drivetrain layout and MUST use those selections to adjust alignment, differential, brake, and balance guidance.

#### Scenario: Select build type
- **WHEN** the user selects STREET, TRACK, or DRIFT
- **THEN** recommendation ranges and automatic control heuristics update for that build style

#### Scenario: Select drivetrain layout
- **WHEN** the user selects FWD, RWD, or AWD
- **THEN** differential controls and handling-balance contribution labels adapt to that layout

### Requirement: Alignment recommendations
The system MUST provide automatic camber, toe, and caster recommendations from build type, layout, chassis geometry, solved roll angle, and spring frequencies, with manual override available.

#### Scenario: Use automatic alignment
- **WHEN** alignment is not in manual mode
- **THEN** the output card shows recommended front/rear camber, front/rear toe, and caster

#### Scenario: Override alignment manually
- **WHEN** alignment is in manual mode
- **THEN** the output card reflects the user's manual camber, toe, and caster values

### Requirement: Differential recommendations
The system MUST provide automatic differential recommendations for FWD, RWD, and AWD layouts and MUST allow manual lock percentages in Pro-level control surfaces.

#### Scenario: Auto differential for two-wheel-drive layouts
- **WHEN** layout is FWD or RWD and differential mode is automatic
- **THEN** Corner Exit and Corner Entry intent drive accel/decel lock recommendations for the driven axle

#### Scenario: Auto differential for AWD
- **WHEN** layout is AWD and differential mode is automatic
- **THEN** the system exposes center split and front exit-push behavior in addition to axle lock recommendations

#### Scenario: Match differential to chassis intent
- **WHEN** Match Chassis is enabled in automatic mode
- **THEN** differential exit/entry intent is biased toward the selected Mech Balance Target without overriding explicit slider input

### Requirement: Brake recommendations
The system MUST provide automatic brake balance recommendations and manual brake balance/pressure controls where exposed.

#### Scenario: Auto brake bias
- **WHEN** brakes are in automatic mode
- **THEN** recommended brake balance derives from front weight bias and selected build type

#### Scenario: Manual brake controls
- **WHEN** brakes are in manual mode
- **THEN** the user can set brake balance from 45% to 70% front and brake pressure from 50% to 200%

### Requirement: Game mode limits
The system MUST support Horizon and Motorsport game modes and MUST use the selected mode to set damper and ARB click ceilings.

#### Scenario: Select Horizon mode
- **WHEN** game mode is Horizon
- **THEN** output click values use Horizon damper and ARB limits

#### Scenario: Select Motorsport mode
- **WHEN** game mode is Motorsport
- **THEN** output click values use Motorsport damper and ARB limits