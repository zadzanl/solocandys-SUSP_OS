## Purpose
Presents output cards, derived readouts, handling balance, response bar, tune check, and warning indicators for computed tune values.

## ADDED Requirements

### Requirement: Output cards
The system MUST present calculated alignment, anti-roll bar, spring, damper, brake, and differential values as output cards suitable for entry into Forza tuning menus.

#### Scenario: Show spring and damper cards
- **WHEN** a tune is computed
- **THEN** spring and damper cards show front/rear values and warning states when near game limits

#### Scenario: Show brake and differential cards
- **WHEN** brake and differential recommendations are available
- **THEN** output cards show the values and qualitative balance indicators for those systems

### Requirement: Derived input strips
The system MUST show derived live readouts near relevant inputs so users can understand the physics consequence of entered values.

#### Scenario: Show chassis derived values
- **WHEN** chassis inputs are present
- **THEN** the app shows corner masses, axle transfer per g, and inner/outer wheel load readouts

#### Scenario: Show ride derived values
- **WHEN** ride inputs are present
- **THEN** the app shows front/rear frequencies, frequency ratio, spring rates, spring deflection, damping classification, and settle-time context

### Requirement: Handling balance bar
The system MUST provide a persistent handling-balance readout combining spring, ARB, differential, brake, and damping contributions into an understeer/oversteer summary.

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
The system MUST provide a PLANTED-to-REACTIVE response readout based on spring frequency, damping, toe, caster, and rear/front frequency ratio.

#### Scenario: More reactive setup
- **WHEN** frequency rises, damping resistance decreases, toe-in decreases, caster decreases, or rear/front Hz ratio increases
- **THEN** the response readout moves toward REACTIVE according to its contributor weights

#### Scenario: More planted setup
- **WHEN** the response contributors move in the opposite direction
- **THEN** the response readout moves toward PLANTED

### Requirement: Tune Check
The system MUST provide a Tune Check tool that reverse-calculates natural frequency and damping ratios from existing in-game spring and damper values.

#### Scenario: Open tune check
- **WHEN** the user activates CHECK
- **THEN** the app opens inputs for existing spring and damper values

#### Scenario: Reverse-calculate damping ratios
- **WHEN** tune-check values are entered
- **THEN** the tool reports frequency and rebound/bump damping-ratio estimates

### Requirement: Warnings and clamps
The system MUST surface warnings when solved values are near limits, clamped, overdamped, or otherwise outside typical guidance.

#### Scenario: Near game limit
- **WHEN** output ARB click values exceed 88% of the game ARB ceiling
- **THEN** the corresponding ARB output card uses a warning state

#### Scenario: Overdamped damping ratio
- **WHEN** rebound damping ratio exceeds 100%
- **THEN** the readout warns that the setup is overdamped