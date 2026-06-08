## Purpose
Derives chassis mass distribution, tire sizing, mechanical balance, and grip bias from vehicle geometry and calibration constants.

## ADDED Requirements

### Requirement: Chassis mass and load transfer calculations
The system MUST derive per-corner masses and 1g axle load-transfer readouts from vehicle weight, front weight bias, center-of-gravity height, and track widths.

#### Scenario: Calculate equal corner mass for a balanced car
- **WHEN** a car has 50% front weight bias
- **THEN** the front and rear corner masses are equal

#### Scenario: Calculate heavier front corners for front-biased cars
- **WHEN** a car has front weight bias above 50%
- **THEN** the front corner mass is greater than the rear corner mass

#### Scenario: Calculate lateral transfer per axle
- **WHEN** chassis geometry includes CG height and track width
- **THEN** the front and rear XFER readouts reflect axle mass times CG height divided by each axle's track width

### Requirement: Tire sizing and grip capacity
The system MUST parse Forza tire strings and use tire width as a sub-linear grip-capacity input while using aspect ratio and rim diameter to derive rolling radius.

#### Scenario: Parse valid tire notation
- **WHEN** the user enters a tire size like `265/35R18`
- **THEN** the system extracts width, aspect ratio, rim diameter, diameter, and radius

#### Scenario: Apply tire-width grip scaling
- **WHEN** front and rear tire widths differ
- **THEN** grip and balance calculations account for the width ratio without treating width as a linear grip multiplier

### Requirement: Mechanical balance and grip bias model
The system MUST expose mechanical balance as roll-stiffness rear fraction adjusted by tire-width calibration and MUST expose grip bias as the physical at-limit tendency derived from lateral-load-transfer and tire-load-sensitivity calculations.

#### Scenario: Report neutral mechanical balance baseline
- **WHEN** roll stiffness and tire/chassis inputs produce a neutral setup
- **THEN** the mechanical balance readout is near the neutral midpoint

#### Scenario: Distinguish grip bias from mechanical balance
- **WHEN** chassis/tire load sensitivity produces at-limit understeer or oversteer tendencies
- **THEN** the GRIP BIAS note reports the physical tendency separately from MECH BALANCE

### Requirement: Calibration constants define physics behavior
The system MUST use documented calibration constants for ARB stiffness, damping, tire load sensitivity, tire-width mechanical correction, mechanical-balance gain, tire width exponent, differential contribution, and brake contribution.

#### Scenario: Use calibrated damping scale
- **WHEN** damping clicks are solved from critical damping coefficients
- **THEN** the result applies the calibrated damping conversion factor (DAMPING_CALIBRATION = 0.00135) before game-limit clamping

#### Scenario: Use calibrated ARB scale
- **WHEN** ARB clicks are converted to roll stiffness
- **THEN** the conversion uses the calibrated ARB click-to-roll-stiffness scale (ARB_RS_SCALE = 240)

#### Scenario: Numeric calibration constants
- **WHEN** the physics engine initializes
- **THEN** the following constants are used: ARB_RS_SCALE = 240, DAMPING_CALIBRATION = 0.00135, TIRE_LOAD_SENS = 0.15, MECH_BAL_GAIN = 1.8, WIDTH_GRIP_EXP = 0.4, TIRE_MECH_SCALE = 0.08, MECH_BALANCE_TARGET = 0.65, BRAKE_BIAS_SCALE = 0.20, DIFF_BIAS_SCALE = 0.14