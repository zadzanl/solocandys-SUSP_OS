## Purpose
Implements complexity tiers, responsive layout, tutorials, unit toggles, and collapsible section controls for the tuning UI.

## ADDED Requirements

### Requirement: Complexity tiers
The system MUST provide BEG, INT, and PRO UI tiers that progressively reveal controls while preserving a valid tune state.

#### Scenario: Beginner tier
- **WHEN** BEG is selected
- **THEN** the UI shows minimal inputs, auto-scales chassis geometry, and uses CO-SOLVE behavior for combined spring/ARB balance

#### Scenario: Intermediate tier
- **WHEN** INT is selected
- **THEN** the UI exposes springs, damping, ARBs, balance modes, presets, and drivetrain controls without requiring manual chassis geometry

#### Scenario: Pro tier
- **WHEN** PRO is selected
- **THEN** the UI exposes complete chassis geometry, manual alignment, brakes, manual differential controls, balance guide, and cross-solver readouts

### Requirement: Guided first-run tutorials
The system MUST provide short tier-specific guides that can open automatically on first entry and be reopened by the user.

#### Scenario: First entry into tier
- **WHEN** the user enters a tier for the first time
- **THEN** the app can show the guide for that tier

#### Scenario: Reopen guide
- **WHEN** the user activates the help control
- **THEN** the guide for the active tier opens again

### Requirement: Unit toggles
The system MUST support imperial and metric display/input modes while storing canonical internal values consistently.

#### Scenario: Toggle to metric
- **WHEN** the user selects MET
- **THEN** weight, spring-rate, and target-speed readouts use metric units where applicable

#### Scenario: Toggle to imperial
- **WHEN** the user selects IMP
- **THEN** weight, spring-rate, and target-speed readouts use imperial units where applicable

### Requirement: Responsive layout
The system MUST adapt layout for desktop, tablet/phone, and small-phone breakpoints.

#### Scenario: Desktop layout
- **WHEN** viewport width is at least 768px
- **THEN** the app uses the full sidebar and output layout

#### Scenario: Mobile drawer layout
- **WHEN** viewport width is below 768px
- **THEN** the input sidebar behaves as a slide-out drawer with mobile-appropriate header controls

#### Scenario: Phone portrait layout
- **WHEN** viewport width is below 480px
- **THEN** the app uses native zoom, tighter numeric inputs, stacked narrow cards, and a collapsed pinned balance footer that can expand

### Requirement: Section visibility and controls
The system MUST organize inputs into collapsible sections with section reset controls and tier-based dimming/hiding of unavailable controls.

#### Scenario: Collapse section
- **WHEN** the user toggles a sidebar section closed
- **THEN** that section's controls are hidden without changing their underlying values

#### Scenario: Tier hides controls
- **WHEN** a control is outside the active tier's surface area
- **THEN** the UI hides or dims it while solver defaults maintain a valid tune

### Requirement: Two-tap section reset
Each collapsible section MUST provide a reset control that uses a two-tap confirmation to return that section's inputs to defaults without affecting other sections.

#### Scenario: Reset a section via two-tap
- **WHEN** the user taps the section reset control and confirms within the confirmation window
- **THEN** only that section's inputs return to their default values

### Requirement: Balance Guide panel
The system MUST display a Balance Guide panel in the ARB section that shows the chassis's natural mechanical balance as a Δ=0 baseline, a car-specific recommended range band, and the user's target Δ offset.

#### Scenario: Show natural balance baseline
- **WHEN** chassis geometry is available
- **THEN** the Balance Guide displays the natural roll-stiffness balance as the zero-reference point

#### Scenario: Show recommended range for layout and build
- **WHEN** drivetrain layout and build type are selected
- **THEN** the Balance Guide shows a recommended Δ range computed from layout and build type anchored to the chassis's natural balance

#### Scenario: Show target Δ from natural
- **WHEN** the user sets a Mech Balance Target
- **THEN** the Balance Guide indicates how far the target is from the natural balance as a Δ value