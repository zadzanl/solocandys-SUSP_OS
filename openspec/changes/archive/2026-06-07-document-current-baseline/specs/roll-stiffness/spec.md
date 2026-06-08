## Purpose
Computes anti-roll-bar click outputs and front/rear split using budget modes, balance solvers, and game-specific limits.

## ADDED Requirements

### Requirement: ARB stiffness budget modes
The system MUST support AUTO, ROLL °, and SHARE % modes for sizing the total anti-roll-bar contribution.

#### Scenario: Auto-size ARB budget
- **WHEN** ARB mode is AUTO
- **THEN** the system derives ARB contribution from the car's natural roll tendency

#### Scenario: Target body roll angle
- **WHEN** ARB mode is ROLL °
- **THEN** the user-selected roll-angle target determines the ARB stiffness required at 1g

#### Scenario: Target ARB share
- **WHEN** ARB mode is SHARE %
- **THEN** the user-selected share determines ARB contribution as a fraction of total roll stiffness

### Requirement: ARB balance modes
The system MUST support WEIGHT, MECH, CO-SOLVE, and MAN balance modes for splitting or entering ARB values.

#### Scenario: Split ARBs by weight
- **WHEN** balance mode is WEIGHT
- **THEN** the front/rear ARB split follows weight distribution with any selected ARB bias offset

#### Scenario: Solve ARBs to mechanical balance target
- **WHEN** balance mode is MECH
- **THEN** the ARB split is solved to hit the selected Mech Balance Target when physically reachable

#### Scenario: Co-solve rear spring and ARB split
- **WHEN** balance mode is CO-SOLVE
- **THEN** the system solves rear spring frequency and ARB split together using Spring / ARB Mix to distribute correction effort

#### Scenario: Accept manual ARB clicks
- **WHEN** balance mode is MAN
- **THEN** the user can enter front and rear ARB click values directly and observe the predicted mechanical balance

### Requirement: Game limits and clamp warnings
The system MUST enforce game-specific ARB click ceilings and warn when solved values approach or exceed practical limits.

#### Scenario: Horizon ARB limit
- **WHEN** game mode is Horizon
- **THEN** ARB click values are clamped to the Horizon ARB ceiling of 65 clicks

#### Scenario: Motorsport ARB limit
- **WHEN** game mode is Motorsport
- **THEN** ARB click values are clamped to the Motorsport ARB ceiling of 40 clicks

#### Scenario: Report unreachable roll target
- **WHEN** the requested roll angle or balance target cannot be achieved within limits
- **THEN** the output surfaces a clamp warning rather than silently exceeding game limits

### Requirement: ARB output transparency
The system MUST show front and rear ARB click outputs and expose solved split/readout context for solver-driven modes.

#### Scenario: Show solved ARB split
- **WHEN** balance mode is MECH or CO-SOLVE
- **THEN** the ARB section shows the solved front/rear split percentage

#### Scenario: Show solved rear Hz during CO-SOLVE
- **WHEN** balance mode is CO-SOLVE
- **THEN** the ARB section shows the rear frequency solved by the combined spring/ARB solver

### Requirement: ARB floor and ceiling range controls
The system MUST allow the user to configure an ARB floor and ceiling that further constrains the click output range below the game limit, with the floor defaulting to 1 and the ceiling defaulting to the game-specific ARB limit.

#### Scenario: Constrain output to floor and ceiling
- **WHEN** the user sets an ARB floor and ceiling
- **THEN** solved ARB click values are clamped to the user-defined floor/ceiling range in addition to the game limit