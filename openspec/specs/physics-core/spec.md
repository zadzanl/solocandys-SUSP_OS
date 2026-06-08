# physics-core Specification

## Purpose
Derives chassis mass distribution, tire sizing, mechanical balance, and grip bias from vehicle geometry and calibration constants.
## Requirements
### Requirement: Chassis mass and load transfer calculations
The system MUST derive per-corner masses and 1g axle load-transfer readouts from vehicle weight, front weight bias, center-of-gravity height, and track widths using documented simplified chassis formulas.

#### Scenario: Calculate equal corner mass for a balanced car
- **WHEN** a car has 50% front weight bias
- **THEN** the front and rear corner masses are equal

#### Scenario: Calculate heavier front corners for front-biased cars
- **WHEN** a car has front weight bias above 50%
- **THEN** the front corner mass is greater than the rear corner mass

#### Scenario: Calculate corner masses from weight bias
- **WHEN** vehicle weight is entered in pounds and front bias is entered as a percentage
- **THEN** total mass is `weightLb / KG_TO_LB`, front corner mass is `totalKg * frontBias / 100 / 2`, and rear corner mass is `totalKg * (1 - frontBias / 100) / 2`

#### Scenario: Calculate lateral transfer per axle
- **WHEN** chassis geometry includes CG height and track width
- **THEN** the front and rear XFER readouts reflect `axleMassKg * cgHeightM / trackWidthM`, a kg/g-style simplified lateral-transfer estimate for each axle

### Requirement: Tire sizing and grip capacity
The system MUST parse Forza tire strings and use tire width as a sub-linear grip-capacity input while using aspect ratio and rim diameter to derive rolling radius.

#### Scenario: Parse valid tire notation
- **WHEN** the user enters a tire size like `265/35R18`
- **THEN** the system extracts width `265`, aspect ratio `35`, rim diameter `18`, diameter, and radius

#### Scenario: Calculate rolling radius from tire notation
- **WHEN** tire width, aspect ratio, and rim diameter are parsed
- **THEN** tire diameter in millimeters is `rimIn * 25.4 + 2 * widthMm * aspectRatio / 100` and radius is half that diameter

#### Scenario: Apply tire-width grip scaling
- **WHEN** front and rear tire widths differ
- **THEN** grip and balance calculations account for the width ratio using `(tireWidth / 265)^WIDTH_GRIP_EXP`, where `WIDTH_GRIP_EXP = 0.4` is an empirical sub-linear grip-capacity exponent rather than a universal tire model

### Requirement: Mechanical balance and grip bias model
The system MUST expose mechanical balance as roll-stiffness rear fraction adjusted by tire-width calibration and MUST expose grip bias as the physical at-limit tendency derived from a documented lateral-load-transfer and tire-load-sensitivity approximation.

#### Scenario: Report neutral mechanical balance baseline
- **WHEN** roll stiffness and tire/chassis inputs produce a neutral setup
- **THEN** the mechanical balance readout is near the neutral midpoint

#### Scenario: Calculate tire-width-corrected mechanical balance
- **WHEN** total front and rear roll stiffnesses are available as `Kf` and `Kr`
- **THEN** rear roll-stiffness fraction is `rsBalance = Kr / (Kf + Kr)`, tire correction is `TIRE_MECH_SCALE * ln(tireWidthRear / tireWidthFront)`, and MECH BALANCE is `clamp01(rsBalance + tireCorr)`

#### Scenario: Calculate grip bias from lateral-load-transfer model
- **WHEN** grip bias is computed for front and rear stiffnesses `Kf` and `Kr`
- **THEN** roll center height is approximated as `cgHeight * 0.20`, roll moment is `totalMass * 9.81 * lateralG * (cgHeight - rollCenterHeight)`, front elastic share is `Kf / (Kf + Kr)`, axle transfer includes elastic plus geometric transfer, and tire force uses `Fy(Fz) = Fz * max(0, 1 - TIRE_LOAD_SENS * (Fz / FzRef - 1))`

#### Scenario: Distinguish grip bias from mechanical balance
- **WHEN** chassis/tire load sensitivity produces at-limit understeer or oversteer tendencies
- **THEN** the GRIP BIAS note reports `0.5 + MECH_BAL_GAIN * (frontCapacity - rearCapacity)` separately from MECH BALANCE

### Requirement: Calibration constants define physics behavior
The system MUST use documented calibration constants for ARB stiffness, damping, tire load sensitivity, tire-width mechanical correction, mechanical-balance gain, tire width exponent, differential contribution, and brake contribution.

#### Scenario: Use calibrated damping scale
- **WHEN** damping clicks are solved from critical damping coefficients
- **THEN** the result applies the calibrated damping conversion factor (DAMPING_CALIBRATION = 0.00135) before game-limit clamping

#### Scenario: Use calibrated ARB scale
- **WHEN** ARB clicks are converted to roll stiffness
- **THEN** the conversion uses the calibrated ARB click-to-roll-stiffness scale (ARB_RS_SCALE = 240)

#### Scenario: Numeric calibration constants with provenance
- **WHEN** the physics engine initializes
- **THEN** the documented unit-conversion constants are `KG_TO_LB = 2.204622622`, `LB_IN_TO_NM = 175.126790921`, and `MPH_TO_MS = 0.44704`, while the documented SUSP.OS empirical calibration constants are `ARB_RS_SCALE = 240`, `DAMPING_CALIBRATION = 0.00135`, `TIRE_LOAD_SENS = 0.15`, `MECH_BAL_GAIN = 1.8`, `WIDTH_GRIP_EXP = 0.4`, `TIRE_MECH_SCALE = 0.08`, `MECH_BALANCE_TARGET = 0.65`, `BRAKE_BIAS_SCALE = 0.20`, and `DIFF_BIAS_SCALE = 0.14`

#### Scenario: Preserve reference damping caveat
- **WHEN** damping calibration is documented
- **THEN** the documentation notes that the local NumberlessMath reference assumes `N/mm/s`, while SUSP.OS uses the empirical `DAMPING_CALIBRATION` scalar to match observed Forza behavior because exact in-game damping-unit scaling is not public

### Requirement: Physics mathematics provenance
The system documentation MUST classify documented physics formulas and calibration constants by provenance so future changes can distinguish standard mechanics, local NumberlessMath references, SUSP.OS implementation contracts, and empirical Forza calibration.

#### Scenario: Cite standard mechanics equations
- **WHEN** a formula comes from standard harmonic-oscillator, damping-ratio, or load-transfer mechanics
- **THEN** the documentation identifies it as standard mechanics and records the equation used by the implementation

#### Scenario: Cite local NumberlessMath references
- **WHEN** a formula is inherited from the NumberlessMath Forza Suspension Calculator reference
- **THEN** the documentation cites the local reference files: `forza-suspension-calculator/Forza Suspension Calculator (Beta) - Forza Suspension Calculator.csv` and/or `forza-suspension-calculator/Beta - Forza Suspension Calculator - Community Content _ Tuning - Official Forza Community Forums (08_06_2026 06.20.14).html`

#### Scenario: Preserve empirical calibration caveats
- **WHEN** a constant is calibrated to observed Forza behavior rather than universal physics
- **THEN** the documentation labels it as empirical and preserves caveats about hidden or title-specific Forza scaling

