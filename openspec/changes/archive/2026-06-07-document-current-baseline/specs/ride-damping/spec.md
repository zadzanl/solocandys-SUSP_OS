## Purpose
Solves spring frequencies, spring rates, and damper click outputs from ride-stiffness inputs with front/rear Hz derivation modes and damping bias support.

## ADDED Requirements

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
The system MUST support FLAT RIDE, MULTIPLIER, MECH, and INDEPENDENT rear-Hz modes unless CO-SOLVE hides and overrides the selector.

#### Scenario: Derive rear Hz with flat ride
- **WHEN** rear-Hz mode is FLAT RIDE and target speed is below the OFF threshold
- **THEN** rear frequency is derived from front frequency, wheelbase, and target speed and clamped to the frequency ceiling when necessary

#### Scenario: Disable flat ride at high target speed
- **WHEN** target speed reaches the flat-ride OFF threshold
- **THEN** the derived rear frequency equals the referenced front frequency without setting a clamp warning

#### Scenario: Derive rear Hz with multiplier
- **WHEN** rear-Hz mode is MULTIPLIER
- **THEN** rear frequency equals front frequency multiplied by the selected multiplier

#### Scenario: Allow independent rear frequency
- **WHEN** rear-Hz mode is INDEPENDENT
- **THEN** the user can set rear frequency directly within the supported frequency band

#### Scenario: Derive rear Hz from mechanical balance target
- **WHEN** rear-Hz mode is MECH
- **THEN** the rear spring frequency is solved from the mechanical balance target, chassis roll-stiffness moments, and ARB balance mode to reach the desired front/rear roll-stiffness ratio

### Requirement: Spring and damper outputs
The system MUST compute spring rates from solved frequency, corner mass, and motion ratio assumptions, and MUST compute rebound and bump damper clicks from damping ratios with game-mode limits.

#### Scenario: Compute spring rates from frequency
- **WHEN** solved front and rear frequencies are available
- **THEN** the SPRINGS output card shows corresponding front and rear spring rates in the selected unit system

#### Scenario: Compute rebound from damping ratio
- **WHEN** a rebound damping ratio is selected
- **THEN** rebound clicks are solved from critical damping and clamped to the selected game's damper limit

#### Scenario: Compute bump by ratio or independent damping
- **WHEN** damping mode is BUMP RATIO
- **THEN** bump damping follows the selected percentage of rebound damping
- **WHEN** damping mode is INDEPENDENT
- **THEN** bump damping follows its own damping-ratio input

### Requirement: Damping bias
The system MUST apply a damping bias offset that shifts rebound and bump damping ratios between front and rear axles, producing a front-heavy or rear-heavy damping split.

#### Scenario: Positive damping bias shifts toward front
- **WHEN** damping bias is positive
- **THEN** front axle rebound and bump zeta remain at the base ratio while rear axle zeta is reduced, producing a front-heavy damping split

#### Scenario: Negative damping bias shifts toward rear
- **WHEN** damping bias is negative
- **THEN** rear axle rebound and bump zeta remain at the base ratio while front axle zeta is reduced, producing a rear-heavy damping split

#### Scenario: Bump-ratio zeta capped at rebound zeta
- **WHEN** damping mode is BUMP RATIO
- **THEN** the computed bump zeta is capped at the current rebound zeta so bump never exceeds rebound