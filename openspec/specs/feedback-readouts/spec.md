# feedback-readouts Specification

## Purpose
Presents output cards, derived readouts, handling balance, response bar, tune check, and warning indicators for computed tune values.
## Requirements
### Requirement: Output cards
The system MUST present calculated alignment, anti-roll bar, spring, damper, brake, and differential values as output cards suitable for entry into Forza tuning menus.

#### Scenario: Show spring and damper cards
- **WHEN** a tune is computed
- **THEN** spring and damper cards show front/rear values and warning states when near game limits

#### Scenario: Show brake and differential cards
- **WHEN** brake and differential recommendations are available
- **THEN** output cards show the values and qualitative balance indicators for those systems

### Requirement: Derived input strips
The system MUST show derived live readouts near relevant inputs so users can understand the physics consequence of entered values, including formulas used for chassis and ride derivations.

#### Scenario: Show chassis derived values
- **WHEN** chassis inputs are present
- **THEN** the app shows corner masses, axle transfer per g, and inner/outer wheel load readouts derived from `cornerMassKg`, `cornerMassKg * cgHeight / trackWidth`, and corner mass plus/minus transfer

#### Scenario: Show ride derived values
- **WHEN** ride inputs are present
- **THEN** the app shows front/rear frequencies, frequency ratio, spring rates, static spring deflection `g / (2 * pi * Hz)^2`, damping classification, and settle-time context

### Requirement: Handling balance bar
The system MUST provide a persistent handling-balance readout combining spring, ARB, differential, brake, and damping contributions into an understeer/oversteer summary using documented contribution signs.

#### Scenario: Calculate spring and ARB contributions
- **WHEN** spring and ARB roll-stiffness totals are available
- **THEN** spring and ARB contributions compare front weight fraction with each subsystem's front roll-stiffness fraction and scale each contribution by that subsystem's share of total roll stiffness

#### Scenario: Sort contributors by magnitude
- **WHEN** multiple balance contributors are present
- **THEN** contributor rows are sorted by absolute magnitude so the dominant driver is easiest to see

#### Scenario: Report neutral target guidance
- **WHEN** total handling balance is near zero
- **THEN** the readout indicates neutral baseline behavior

#### Scenario: Report dominant adjustment tip
- **WHEN** one contributor dominates the balance
- **THEN** the readout provides a concrete adjustment suggestion for that contributor

### Requirement: Mechanical balance and grip bias readouts
The system MUST display visible MECH BALANCE and GRIP BIAS readouts that report the roll-stiffness rear fraction (with tire-width correction) and the physical at-limit load-transfer tendency respectively.

#### Scenario: Show mechanical balance readout
- **WHEN** ARB and chassis calculations are available
- **THEN** the MECH BALANCE readout shows the tire-width-corrected roll-stiffness rear fraction as a 0–1 value

#### Scenario: Show grip bias readout
- **WHEN** load-transfer and tire-sensitivity calculations are available
- **THEN** the GRIP BIAS readout shows the physical at-limit understeer/oversteer tendency separately from mechanical balance

### Requirement: Response bar
The system MUST provide a PLANTED-to-REACTIVE response readout based on spring frequency, damping, toe, caster, and rear/front frequency ratio, using documented normalization and weighting.

#### Scenario: Calculate response score
- **WHEN** response inputs are available
- **THEN** the response score is computed from normalized contributors using `springHzNorm * 0.50 + (1 - dampingNorm) * 0.20 + toeNorm * 0.15 + casterNorm * 0.10 + rearFrontHzNorm * 0.05`

#### Scenario: More reactive setup
- **WHEN** frequency rises, damping resistance decreases, toe-in decreases, caster decreases, or rear/front Hz ratio increases
- **THEN** the response readout moves toward REACTIVE according to its contributor weights

#### Scenario: More planted setup
- **WHEN** the response contributors move in the opposite direction
- **THEN** the response readout moves toward PLANTED

#### Scenario: Preserve response contributor meaning
- **WHEN** response math is documented
- **THEN** spring frequency is the dominant 50% contributor, damping zeta is inverted so lower damping is more reactive, front toe-in and caster reduce reactivity, and rear/front frequency ratio contributes a smaller rotation-response term

### Requirement: Tune Check
The system MUST provide a Tune Check tool that reverse-calculates natural frequency and damping ratios from existing in-game spring and damper values using documented inverse formulas.

#### Scenario: Open tune check
- **WHEN** the user activates CHECK
- **THEN** the app opens inputs for existing spring and damper values

#### Scenario: Reverse-calculate natural frequency
- **WHEN** tune-check spring values and corner masses are entered
- **THEN** spring rates are converted from lb/in to N/m using `LB_IN_TO_NM`, and natural frequency is `sqrt(springRateNm / cornerMassKg) / (2 * pi)`

#### Scenario: Reverse-calculate damping ratios
- **WHEN** tune-check damper values are entered
- **THEN** critical damping is recomputed from wheel rate and corner mass, and rebound/bump zeta estimates are `damperClicks / (DAMPING_CALIBRATION * criticalDamping) * 100`

### Requirement: Warnings and clamps
The system MUST surface warnings when solved values are near limits, clamped, overdamped, or otherwise outside typical guidance.

#### Scenario: Near game limit
- **WHEN** output ARB click values exceed 88% of the game ARB ceiling
- **THEN** the corresponding ARB output card uses a warning state

#### Scenario: Overdamped damping ratio
- **WHEN** rebound damping ratio exceeds 100%
- **THEN** the readout warns that the setup is overdamped

