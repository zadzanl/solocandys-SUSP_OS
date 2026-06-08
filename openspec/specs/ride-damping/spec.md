# ride-damping Specification

## Purpose
Solves spring frequencies, spring rates, and damper click outputs from ride-stiffness inputs with front/rear Hz derivation modes and damping bias support.
## Requirements
### Requirement: Spring frequency operating band
The system MUST treat ride stiffness as spring frequency in the supported 0.80 Hz to 5.50 Hz operating band, including direct Hz entry and legacy save migration.

#### Scenario: Clamp frequency below minimum
- **WHEN** a frequency input is below 0.80 Hz
- **THEN** the system clamps the stored ride stiffness to 0.80 Hz

#### Scenario: Clamp frequency above maximum
- **WHEN** a frequency input is above 5.50 Hz
- **THEN** the system clamps the stored ride stiffness to 5.50 Hz

#### Scenario: Preserve genuine high-Hz values during migration
- **WHEN** a saved ride stiffness is 5.50 or below
- **THEN** the system treats it as a direct Hz value rather than an old 0-100 slider value

### Requirement: Ride reference controls slider meaning
The system MUST let the user choose whether the ride stiffness slider controls front Hz, rear Hz, or the shared average while preserving the actual front and rear frequencies when switching reference.

#### Scenario: Select front reference
- **WHEN** Ride Ref is FRONT
- **THEN** the primary ride stiffness value represents front frequency and the rear frequency is derived by the selected rear-Hz mode

#### Scenario: Select shared reference
- **WHEN** Ride Ref is SHARED
- **THEN** the primary ride stiffness value represents the average of front and rear frequencies

#### Scenario: Select rear reference
- **WHEN** Ride Ref is REAR
- **THEN** the primary ride stiffness value represents rear frequency and the front frequency is derived by the selected rear-Hz mode

#### Scenario: Switch reference without changing solved frequencies
- **WHEN** the user switches Ride Ref
- **THEN** the stored slider value is recalculated so the existing solved front and rear frequencies remain stable

### Requirement: Rear-Hz derivation modes
The system MUST support FLAT RIDE, MULTIPLIER, MECH, and INDEPENDENT rear-Hz modes unless CO-SOLVE hides and overrides the selector, and MUST document the frequency formulas used by solver-driven modes.

#### Scenario: Derive rear Hz with flat ride
- **WHEN** rear-Hz mode is FLAT RIDE and target speed is below the OFF threshold
- **THEN** the system computes speed as `mph * MPH_TO_MS`, travel time as `wheelbase / speed`, and rear frequency as `1 / (1 / frontHz - 2 * travelTime)` when the denominator is usable, capping rear frequency at `HZ_MAX = 5.50 Hz` when the formula overshoots

#### Scenario: Use low-speed flat-ride fallback
- **WHEN** flat-ride speed is too low or the rear-frequency denominator is not usable
- **THEN** the system uses `frontHz * 1.2` as the fallback rear frequency before clamping

#### Scenario: Disable flat ride at high target speed
- **WHEN** target speed reaches the flat-ride OFF threshold of 200 mph
- **THEN** the derived rear frequency equals the referenced front frequency without setting a clamp warning

#### Scenario: Derive shared flat ride from average frequency
- **WHEN** Ride Ref is SHARED and rear-Hz mode is FLAT RIDE
- **THEN** the system solves the quadratic `t * frontHz^2 - frontHz * (1 + 2 * avgHz * t) + avgHz = 0` and uses the smaller valid root as front frequency before deriving rear frequency from the flat-ride formula

#### Scenario: Derive rear Hz with multiplier
- **WHEN** rear-Hz mode is MULTIPLIER
- **THEN** rear frequency equals front frequency multiplied by the selected multiplier

#### Scenario: Allow independent rear frequency
- **WHEN** rear-Hz mode is INDEPENDENT
- **THEN** the user can set rear frequency directly within the supported frequency band

#### Scenario: Derive rear Hz from mechanical balance target
- **WHEN** rear-Hz mode is MECH
- **THEN** the rear/front frequency ratio is solved from the target roll-stiffness rear fraction using `ratio = sqrt((target / (1 - target)) * frontCornerMass * trackF^2 / (rearCornerMass * trackR^2))`, adjusted for ARB budget dilution when WEIGHT ARBs are active

### Requirement: Spring and damper outputs
The system MUST compute spring rates from solved frequency, corner mass, and motion ratio assumptions, and MUST compute rebound and bump damper clicks from documented damping-ratio equations with game-mode limits.

#### Scenario: Compute spring rates from frequency
- **WHEN** solved front and rear frequencies are available
- **THEN** angular frequency is `omega = 2 * pi * Hz`, wheel rate is `omega^2 * cornerMassKg`, and spring rate is `wheelRate / motionRatio^2 / LB_IN_TO_NM` in lb/in before optional display conversion to N/mm

#### Scenario: Compute rebound from damping ratio
- **WHEN** a rebound damping ratio is selected
- **THEN** critical damping is `cc = 2 * sqrt(wheelRate * cornerMassKg)`, damping coefficient is `cc * zeta / 100`, and damper click estimate is `coefficient * DAMPING_CALIBRATION` before game-limit clamping

#### Scenario: Compute bump by ratio or independent damping
- **WHEN** damping mode is BUMP RATIO
- **THEN** bump damping follows the selected percentage of rebound damping and is capped at the current rebound zeta so bump never exceeds rebound
- **WHEN** damping mode is INDEPENDENT
- **THEN** bump damping follows its own damping-ratio input

#### Scenario: Preserve front/rear damper ratios near limits
- **WHEN** raw front/rear damper click estimates would exceed game limits or fall below the minimum
- **THEN** the system applies proportional scaling to each axle pair before rounding and clamping so the front/rear relationship is preserved as far as practical

#### Scenario: Compute damping settle time
- **WHEN** damping ratio and solved frequency are available
- **THEN** settle time is reported as `ln(10) / ((zeta / 100) * 2 * pi * Hz)`, approximated in the implementation as `2.302 / ((zeta / 100) * 2 * pi * Hz)`

### Requirement: Damping bias
The system MUST apply a damping bias offset that shifts rebound and bump damping ratios between front and rear axles before critical-damping click conversion, producing a front-heavy or rear-heavy damping split.

#### Scenario: Positive damping bias shifts toward front
- **WHEN** damping bias is positive
- **THEN** front axle rebound and bump zeta remain at the base ratio while rear axle zeta is reduced by the bias split, producing a front-heavy damping split

#### Scenario: Negative damping bias shifts toward rear
- **WHEN** damping bias is negative
- **THEN** rear axle rebound and bump zeta remain at the base ratio while front axle zeta is reduced by the bias split, producing a rear-heavy damping split

#### Scenario: Treat damping bias as tuning model
- **WHEN** damping bias is documented
- **THEN** the documentation identifies it as a SUSP.OS handling-feel model layered on top of standard damping-ratio math rather than a separate external physics reference

