# vehicle-controls Specification

## Purpose
Manages build type, drivetrain layout, alignment, differential, brake, and game-mode controls that adapt solver recommendations and output limits.
## Requirements
### Requirement: Build type and drivetrain layout
The system MUST let the user select build type and drivetrain layout and MUST use those selections to adjust alignment, differential, brake, and balance guidance.

#### Scenario: Select build type
- **WHEN** the user selects STREET, TRACK, or DRIFT
- **THEN** recommendation ranges and automatic control heuristics update for that build style

#### Scenario: Select drivetrain layout
- **WHEN** the user selects FWD, RWD, or AWD
- **THEN** differential controls and handling-balance contribution labels adapt to that layout

### Requirement: Alignment recommendations
The system MUST provide automatic camber, toe, and caster recommendations from build type, layout, chassis geometry, solved roll angle, spring frequencies, and front weight bias, with manual override available.

#### Scenario: Use automatic alignment
- **WHEN** alignment is not in manual mode
- **THEN** the output card shows recommended front/rear camber, front/rear toe, and caster

#### Scenario: Calculate camber from roll and geometry
- **WHEN** automatic alignment computes camber
- **THEN** camber gain is `clamp(0.55, 0.85, 1.05 - cgHeight * 0.8)`, rear gain is reduced by drivetrain layout, and recommended camber offsets build-specific optimal camber by solved roll angle and layout terms

#### Scenario: Calculate toe from build, bias, and frequency
- **WHEN** automatic alignment computes toe
- **THEN** front toe starts from the build-type base table and is adjusted by `(frontBias - 50) * -0.003` and `(frontHz - 1.8) * 0.010`, while rear toe starts from the build/layout base table and is adjusted by `((1 - frontBias / 100) - 0.5) * 0.20 + max(0, rearHz - frontHz) * -0.03` before clamping

#### Scenario: Calculate caster from build, frequency, and bias
- **WHEN** automatic alignment computes caster
- **THEN** caster starts from the build-type base value and is adjusted by `(frontHz - 1.8) * 0.4`, `(frontBias - 50) * 0.04`, and `-0.5` for FWD layouts before clamping to 4.0–7.5 degrees

#### Scenario: Override alignment manually
- **WHEN** alignment is in manual mode
- **THEN** the output card reflects the user's manual camber, toe, and caster values

### Requirement: Differential recommendations
The system MUST provide automatic differential recommendations for FWD, RWD, and AWD layouts and MUST allow manual lock percentages in Pro-level control surfaces, while documenting contribution math used by the handling-balance readout.

#### Scenario: Auto differential for two-wheel-drive layouts
- **WHEN** layout is FWD or RWD and differential mode is automatic
- **THEN** Corner Exit and Corner Entry intent drive accel/decel lock recommendations for the driven axle

#### Scenario: Auto differential for AWD
- **WHEN** layout is AWD and differential mode is automatic
- **THEN** the system exposes center split and front exit-push behavior in addition to axle lock recommendations

#### Scenario: Match differential to chassis intent
- **WHEN** Match Chassis is enabled in automatic mode
- **THEN** differential exit/entry intent is biased toward the selected Mech Balance Target without overriding explicit slider input

#### Scenario: Calculate differential balance contribution
- **WHEN** differential contribution is shown in the handling balance
- **THEN** axle lock percentages are scaled by axle load, AWD center split where applicable, and `DIFF_BIAS_SCALE = 0.14`, with rear lock contributing toward oversteer and front lock contributing toward understeer

### Requirement: Brake recommendations
The system MUST provide automatic brake balance recommendations and manual brake balance/pressure controls where exposed, with documented contribution math for handling balance.

#### Scenario: Auto brake bias
- **WHEN** brakes are in automatic mode
- **THEN** recommended brake balance derives from front weight bias and selected build type

#### Scenario: Manual brake controls
- **WHEN** brakes are in manual mode
- **THEN** the user can set brake balance from 45% to 70% front and brake pressure from 50% to 200%

#### Scenario: Calculate brake balance contribution
- **WHEN** brake contribution is shown in the handling balance
- **THEN** brake balance deviation from neutral is scaled by `BRAKE_BIAS_SCALE = 0.20`, with additional front brake bias contributing toward entry understeer

### Requirement: Game mode limits
The system MUST support Horizon and Motorsport game modes and MUST use the selected mode to set damper and ARB click ceilings.

#### Scenario: Select Horizon mode
- **WHEN** game mode is Horizon
- **THEN** output click values use Horizon damper and ARB limits

#### Scenario: Select Motorsport mode
- **WHEN** game mode is Motorsport
- **THEN** output click values use Motorsport damper and ARB limits

